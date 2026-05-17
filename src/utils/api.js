// Firebase-backed API — same interface as the old REST API so no other files change.
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { loginWithEmail, logout as fbLogout, changePassword as fbChangePassword } from "../firebase/authService";
import * as fs from "../firebase/firestoreService";

// ---- auth token helpers (store Firebase UID as "token") ----
export function getAuthToken() {
  return localStorage.getItem('pos_token');
}
export function setAuthToken(uid) {
  localStorage.setItem('pos_token', uid);
}
export function clearAuthToken() {
  localStorage.removeItem('pos_token');
  fbLogout().catch(() => {});
}

function waitForCurrentUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

// ---- auth ----
export async function login(username, password) {
  const snap = await getDocs(query(collection(db, "users"), where("username", "==", username)));
  if (snap.empty) throw new Error("Invalid username or password.");
  const userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
  if (userData.active === false) throw new Error("This account has been deactivated.");

  // Use stored email, or fall back to the synthetic email format used during account creation
  const email = userData.email || `${username.toLowerCase().replace(/[^a-z0-9._-]/g, '.')}@carrensstore.internal`;
  await loginWithEmail(email, password);
  const user = { id: userData.id, ...userData };
  delete user.password;

  return { user, token: user.id };
}

export async function fetchMe() {
  const fbUser = await waitForCurrentUser();
  if (!fbUser) throw Object.assign(new Error("Not authenticated"), { status: 401 });

  const snap = await getDocs(query(collection(db, "users"), where("email", "==", fbUser.email)));
  if (snap.empty) throw Object.assign(new Error("User not found"), { status: 404 });
  const data = snap.docs[0].data();
  const user = { id: snap.docs[0].id, ...data };
  delete user.password;
  return { user };
}

// ---- products ----
export const fetchProducts = fs.fetchProducts;
export const createProduct = fs.createProduct;
export const updateProduct = fs.updateProduct;
export const deleteProduct = fs.deleteProduct;

// ---- categories ----
export const fetchCategories = fs.fetchCategories;
export const createCategory = (name) => fs.createCategory(name);
export const deleteCategory = (id) => fs.deleteCategory(id);

// ---- users ----
export const fetchUsers = fs.fetchUsers;
export const createUser = fs.createUser;
export const updateUser = fs.updateUser;
export const updateUserStatus = fs.updateUserStatus;
export const deleteUser = fs.deleteUser;

// ---- transactions ----
export const fetchTransactions = fs.fetchTransactions;
export async function createTransaction(payload) {
  const { updatedProducts, credit, ...transaction } = await fs.createTransaction(payload);
  return { transaction, updatedProducts, credit: credit || null };
}

// ---- stock movements ----
export const fetchStockMovements = fs.fetchStockMovements;
export async function createStockMovement(payload) {
  const { updatedProduct, ...movement } = await fs.createStockMovement(payload);
  return { movement, product: updatedProduct };
}

// ---- settings ----
export const fetchSettings = fs.fetchSettings;
export const updateSettings = fs.updateSettings;

// ---- expenses ----
export const fetchExpenses = (from, to) => fs.fetchExpenses(from, to);
export const createExpense = fs.createExpense;

// ---- audit logs ----
export const fetchAuditLogs = fs.fetchAuditLogs;
export const addAuditLog = fs.addAuditLog;

// ---- orders ----
export const fetchOrders = fs.fetchOrders;
export const createOrder = fs.createOrder;
export const updateOrder = fs.updateOrder;

// ---- credits ----
export const fetchCredits = fs.fetchCredits;
export const createCredit = fs.createCredit;
export const addCreditPayment = fs.addCreditPayment;
export const updateCreditDueDate = fs.updateCreditDueDate;

// ---- void transaction ----
export async function voidTransaction(id, voidReason) {
  const { updatedProducts, ...transaction } = await fs.voidTransaction(id, voidReason);
  return { transaction, updatedProducts };
}

// ---- one-time OR number migration ----
export const migrateOrNumbers = fs.migrateOrNumbers;

// ---- password ----
export const changePassword = (currentPassword, newPassword) => fbChangePassword(currentPassword, newPassword);
