import {
  collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, runTransaction, increment,
} from "firebase/firestore";
import { db } from "./config";
import { createAuthUser } from "./authService";

// --- helpers ---
const col = (name) => collection(db, name);

// Convert Firestore Timestamps to ISO date strings so React can render them
function serialize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = (v && typeof v.toDate === 'function') ? v.toDate().toISOString().slice(0, 10) : v;
  }
  return out;
}
const toList = (snap) => snap.docs.map(d => ({ id: d.id, ...serialize(d.data()) }));

// --- products ---                     
export const fetchProducts = () => getDocs(col("products")).then(toList);

export async function createProduct(payload) {
  const ref = await addDoc(col("products"), { ...payload, createdAt: serverTimestamp() });
  return { id: ref.id, ...payload };
}

export async function updateProduct(id, payload) {
  await updateDoc(doc(db, "products", id), payload);
  return { id, ...payload };
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, "products", id));
}

// --- categories (name is the document ID for easy lookup/delete) ---
export const fetchCategories = () =>
  getDocs(col("categories")).then(snap => snap.docs.map(d => d.data().name || d.id));

export async function createCategory(name) {
  await setDoc(doc(db, "categories", name), { name });
  return { name };
}

export async function deleteCategory(name) {
  await deleteDoc(doc(db, "categories", name));
}

// --- users ---
export const fetchUsers = () => getDocs(col("users")).then(toList);

export async function createUser(payload) {
  // Derive a synthetic email so Firebase Auth has something to work with.
  // Users only ever log in with their username — the email is internal.
  const email = `${payload.username.toLowerCase().replace(/[^a-z0-9._-]/g, '.')}@carrensstore.internal`;
  await createAuthUser(email, payload.password);
  const { password: _, ...safe } = payload;
  const ref = await addDoc(col("users"), { ...safe, email, createdAt: serverTimestamp() });
  return { id: ref.id, ...safe, email };
}

export async function updateUser(id, payload) {
  const { password: _, ...safe } = payload;
  await updateDoc(doc(db, "users", id), safe);
  return { id, ...safe };
}

export async function updateUserStatus(id, payload) {
  await updateDoc(doc(db, "users", id), payload);
  const snap = await getDoc(doc(db, "users", id));
  return { id, ...serialize(snap.data()) };
}

export async function deleteUser(id) {
  await deleteDoc(doc(db, "users", id));
}

// --- OR number counter (atomic sequential, zero-padded 7 digits) ---
async function getNextOrNumber() {
  const counterRef = doc(db, 'counters', 'orNumber');
  let newCount;
  await runTransaction(db, async (txn) => {
    const snap = await txn.get(counterRef);
    newCount = (snap.exists() ? (snap.data().count || 0) : 0) + 1;
    txn.set(counterRef, { count: newCount });
  });
  return String(newCount).padStart(10, '0');
}

// --- transactions (also deducts stock for each item sold) ---
export const fetchTransactions = () =>
  getDocs(query(col("transactions"), orderBy("createdAt", "desc"))).then(toList);

export async function createTransaction(payload) {
  // Normalize transaction shape: compute date, time, subtotal, and lookup cashierName
  const now = new Date();
  
  // Use LOCAL timezone for date, not UTC
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`; // YYYY-MM-DD format in local timezone
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const time = `${hours}:${minutes}`; // HH:MM format
  
  // Calculate subtotal from items
  const subtotal = (payload.items || []).reduce((sum, item) => sum + (item.total || 0), 0);
  
  // Lookup cashierName from users collection
  let cashierName = "Unknown";
  if (payload.cashierId) {
    const userSnap = await getDoc(doc(db, "users", payload.cashierId));
    if (userSnap.exists()) {
      cashierName = userSnap.data().name || "Unknown";
    }
  }

  // Generate sequential OR number
  const orNumber = await getNextOrNumber();

  // Create normalized transaction doc
  const docPayload = {
    ...payload,
    date,
    time,
    subtotal,
    cashierName,
    orNumber,
    cash: Number(payload.cash) || 0,
    change: Number(payload.change) || 0,
    cashierId: payload.cashierId || "",
    createdAt: serverTimestamp()
  };
  
  const ref = await addDoc(col("transactions"), docPayload);

  const updatedProducts = [];
  for (const item of payload.items || []) {
    const pRef = doc(db, "products", String(item.productId));
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      // conversionRate: how many base units (pcs) are deducted per selling unit.
      // e.g. selling 2 trays where 1 tray = 30 pcs → deduct 60 pcs from stock.
      const conversionRate = Number(item.conversionRate) || 1;
      const baseQtyToDeduct = item.qty * conversionRate;
      const newStock = Math.max(0, (pSnap.data().stock || 0) - baseQtyToDeduct);
      await updateDoc(pRef, { stock: newStock });
      updatedProducts.push({ id: item.productId, ...serialize(pSnap.data()), stock: newStock });
    }
  }

  // Auto-create credit ledger entry for credit-payment transactions
  let credit = null;
  if (payload.paymentMethod === 'credit') {
    const customer = payload.customer || {};
    credit = await createCredit({
      transactionId: ref.id,
      orNumber,
      customerName: customer.name || '',
      customerContact: customer.contact || '',
      customerAddress: customer.address || '',
      items: payload.items || [],
      totalAmount: subtotal,
      dueDate: payload.dueDate || '',
      cashierId: payload.cashierId || '',
      cashierName,
    });
  }

  return { id: ref.id, ...docPayload, cashierName, updatedProducts, credit };
}

// --- stock movements (also increments product stock atomically) ---
export const fetchStockMovements = () => getDocs(col("stockMovements")).then(toList);

export async function createStockMovement(payload) {
  const ref = await addDoc(col("stockMovements"), { ...payload, createdAt: serverTimestamp() });

  const pRef = doc(db, "products", String(payload.productId));
  const pSnap = await getDoc(pRef);
  let updatedProduct = null;
  if (pSnap.exists()) {
    // Use increment() so concurrent writes (e.g. two cashiers) don't race
    await updateDoc(pRef, { stock: increment(Number(payload.qty)) });
    const newStock = (pSnap.data().stock || 0) + Number(payload.qty);
    updatedProduct = { id: payload.productId, ...serialize(pSnap.data()), stock: newStock };
  }

  return { id: ref.id, ...payload, updatedProduct };
}

// --- settings ---
export async function fetchSettings() {
  const snap = await getDoc(doc(db, "settings", "global"));
  return snap.exists() ? snap.data() : {};
}

export async function updateSettings(payload) {
  // Remove undefined fields to avoid Firestore "unsupported field value: undefined" errors
  const safe = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (v !== undefined) safe[k] = v;
  }
  if (Object.keys(safe).length === 0) {
    // Nothing to update; return current settings
    const snap = await getDoc(doc(db, "settings", "global"));
    return snap.exists() ? snap.data() : {};
  }

  await setDoc(doc(db, "settings", "global"), safe, { merge: true });
  const snap = await getDoc(doc(db, "settings", "global"));
  return snap.exists() ? snap.data() : safe;
}

// --- expenses ---
export async function fetchExpenses(from, to) {
  let q = col("expenses");
  if (from && to) {
    q = query(q, where("date", ">=", from), where("date", "<=", to));
  }
  return getDocs(q).then(toList);
}

export async function createExpense(payload) {
  const ref = await addDoc(col("expenses"), { ...payload, createdAt: serverTimestamp() });
  return { id: ref.id, ...payload };
}

// --- audit logs ---
export async function addAuditLog(user, action) {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  await addDoc(col('auditLogs'), { user, action, timestamp, createdAt: serverTimestamp() });
}

export const fetchAuditLogs = () =>
  getDocs(query(col("auditLogs"), orderBy("createdAt", "desc"))).then(toList);

// --- orders ---
export const fetchOrders = () =>
  getDocs(query(col("orders"), orderBy("createdAt", "desc"))).then(toList);

export async function createOrder(payload) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const time = `${hours}:${minutes}`;

  let cashierName = 'Unknown';
  if (payload.cashierId) {
    const userSnap = await getDoc(doc(db, 'users', payload.cashierId));
    if (userSnap.exists()) cashierName = userSnap.data().name || 'Unknown';
  }

  const subtotal = (payload.items || []).reduce((sum, item) => sum + (item.total || 0), 0);

  const docPayload = {
    status: 'pending',
    ...payload,
    date,
    time,
    subtotal,
    cashierName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(col('orders'), docPayload);
  return { id: ref.id, ...docPayload, createdAt: date, updatedAt: date };
}

export async function updateOrder(id, updates) {
  await updateDoc(doc(db, 'orders', id), { ...updates, updatedAt: serverTimestamp() });
  const snap = await getDoc(doc(db, 'orders', id));
  return { id, ...serialize(snap.data()) };
}

// --- credits ---
export const fetchCredits = () =>
  getDocs(query(col('credits'), orderBy('createdAt', 'desc'))).then(toList);

export async function createCredit(payload) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const docPayload = {
    ...payload,
    amountPaid: 0,
    remainingBalance: payload.totalAmount || 0,
    status: 'unpaid',
    payments: [],
    startDate: payload.startDate || date,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(col('credits'), docPayload);
  return { id: ref.id, ...docPayload, createdAt: date, updatedAt: date };
}

export async function addCreditPayment(id, amount, note = '') {
  const credSnap = await getDoc(doc(db, 'credits', id));
  if (!credSnap.exists()) throw new Error('Credit not found');
  const data = credSnap.data();
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const newAmountPaid = (data.amountPaid || 0) + Number(amount);
  const newRemaining = Math.max(0, (data.totalAmount || 0) - newAmountPaid);
  const newStatus = newRemaining <= 0 ? 'paid' : 'partial';
  const newPayments = [...(data.payments || []), { amount: Number(amount), date, note }];

  const updates = {
    amountPaid: newAmountPaid,
    remainingBalance: newRemaining,
    status: newStatus,
    payments: newPayments,
    updatedAt: serverTimestamp(),
  };
  if (newStatus === 'paid') updates.paidAt = serverTimestamp();

  await updateDoc(doc(db, 'credits', id), updates);
  const updated = await getDoc(doc(db, 'credits', id));
  return { id, ...serialize(updated.data()) };
}

export async function updateCreditDueDate(id, dueDate) {
  await updateDoc(doc(db, 'credits', id), { dueDate, updatedAt: serverTimestamp() });
  const snap = await getDoc(doc(db, 'credits', id));
  return { id, ...serialize(snap.data()) };
}

// --- one-time migration: assign sequential OR numbers to old transactions ---
export async function migrateOrNumbers() {
  // Fetch ALL transactions sorted oldest-first, then re-assign 0000000001, 0000000002, ...
  const snap = await getDocs(query(col('transactions'), orderBy('createdAt', 'asc')));
  const allTxns = snap.docs;

  if (allTxns.length === 0) return 0;

  let seq = 0;
  for (const txnDoc of allTxns) {
    seq++;
    const newOrNumber = String(seq).padStart(10, '0');
    const txnData = txnDoc.data();

    await updateDoc(doc(db, 'transactions', txnDoc.id), { orNumber: newOrNumber });

    // Propagate to linked credit record
    const creditSnap = await getDocs(query(col('credits'), where('transactionId', '==', txnDoc.id)));
    for (const creditDoc of creditSnap.docs) {
      await updateDoc(doc(db, 'credits', creditDoc.id), { orNumber: newOrNumber });
    }

    // Propagate to linked order record
    if (txnData.orderId) {
      const orderRef = doc(db, 'orders', txnData.orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        await updateDoc(orderRef, { orNumber: newOrNumber });
      }
    }
  }

  // Reset the counter to match the highest assigned number
  await setDoc(doc(db, 'counters', 'orNumber'), { count: seq });

  return seq;
}

// --- void transaction (marks void + restores stock) ---
export async function voidTransaction(id, voidReason) {
  const txnRef = doc(db, 'transactions', id);
  const txnSnap = await getDoc(txnRef);
  if (!txnSnap.exists()) throw new Error('Transaction not found');
  const txnData = txnSnap.data();
  if (txnData.status === 'void') throw new Error('Transaction is already voided');

  const now = new Date();
  const voidedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  await updateDoc(txnRef, { status: 'void', voidReason, voidedAt });

  const updatedProducts = [];
  for (const item of txnData.items || []) {
    const pRef = doc(db, 'products', String(item.productId));
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      const conversionRate = Number(item.conversionRate) || 1;
      const baseQtyToRestore = item.qty * conversionRate;
      const newStock = (pSnap.data().stock || 0) + baseQtyToRestore;
      await updateDoc(pRef, { stock: newStock });
      updatedProducts.push({ id: item.productId, stock: newStock });
    }
  }

  return { id, ...serialize(txnData), status: 'void', voidReason, voidedAt, updatedProducts };
}
