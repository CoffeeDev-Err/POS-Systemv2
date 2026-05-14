import {
  collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

// --- helpers ---
const col = (name) => collection(db, name);
const toList = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

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

// --- categories ---
export const fetchCategories = () => getDocs(col("categories")).then(toList);

export async function createCategory(name) {
  const ref = await addDoc(col("categories"), { name });
  return { id: ref.id, name };
}

export async function deleteCategory(id) {
  await deleteDoc(doc(db, "categories", id));
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

// --- transactions ---
export const fetchTransactions = () =>
  getDocs(query(col("transactions"), orderBy("createdAt", "desc"))).then(toList);

export async function createTransaction(payload) {
  const ref = await addDoc(col("transactions"), { ...payload, createdAt: serverTimestamp() });
  return { id: ref.id, ...payload };
}

// --- stock movements ---
export const fetchStockMovements = () => getDocs(col("stockMovements")).then(toList);

export async function createStockMovement(payload) {
  const ref = await addDoc(col("stockMovements"), { ...payload, createdAt: serverTimestamp() });
  return { id: ref.id, ...payload };
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
