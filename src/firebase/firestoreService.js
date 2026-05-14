import {
  collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

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
  const { password: _, ...safe } = payload;
  const ref = await addDoc(col("users"), { ...safe, createdAt: serverTimestamp() });
  return { id: ref.id, ...safe };
}

export async function updateUser(id, payload) {
  const { password: _, ...safe } = payload;
  await updateDoc(doc(db, "users", id), safe);
  return { id, ...safe };
}

export async function updateUserStatus(id, payload) {
  await updateDoc(doc(db, "users", id), payload);
}

// --- transactions (also deducts stock for each item sold) ---
export const fetchTransactions = () =>
  getDocs(query(col("transactions"), orderBy("createdAt", "desc"))).then(toList);

export async function createTransaction(payload) {
  const ref = await addDoc(col("transactions"), { ...payload, createdAt: serverTimestamp() });

  const updatedProducts = [];
  for (const item of payload.items || []) {
    const pRef = doc(db, "products", String(item.productId));
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      const newStock = Math.max(0, (pSnap.data().stock || 0) - item.qty);
      await updateDoc(pRef, { stock: newStock });
      updatedProducts.push({ id: item.productId, ...serialize(pSnap.data()), stock: newStock });
    }
  }

  return { id: ref.id, ...payload, updatedProducts };
}

// --- stock movements (also increments product stock) ---
export const fetchStockMovements = () => getDocs(col("stockMovements")).then(toList);

export async function createStockMovement(payload) {
  const ref = await addDoc(col("stockMovements"), { ...payload, createdAt: serverTimestamp() });

  const pRef = doc(db, "products", String(payload.productId));
  const pSnap = await getDoc(pRef);
  let updatedProduct = null;
  if (pSnap.exists()) {
    const newStock = (pSnap.data().stock || 0) + Number(payload.qty);
    await updateDoc(pRef, { stock: newStock });
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
  await setDoc(doc(db, "settings", "global"), payload, { merge: true });
  return payload;
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
export const fetchAuditLogs = () =>
  getDocs(query(col("auditLogs"), orderBy("createdAt", "desc"))).then(toList);
