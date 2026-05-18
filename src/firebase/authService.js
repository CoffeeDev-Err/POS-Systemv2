import { initializeApp, getApps } from "firebase/app";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  getAuth,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import app, { auth, db } from "./config";

// Secondary Firebase app — used to create new Auth users without signing out the current admin
function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === 'secondary');
  if (existing) return getAuth(existing);
  return getAuth(initializeApp(app.options, 'secondary'));
}

/** Creates a Firebase Auth account for a new POS user. Uses a secondary app so the admin session is preserved. */
export async function createAuthUser(email, password) {
  const secondaryAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await signOut(secondaryAuth);
  return cred.user.uid;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  const userData = snap.exists() ? snap.data() : {};
  return { uid: cred.user.uid, email: cred.user.email, ...userData };
}

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/** Admin: update another user's Firebase Auth password via the secondary app (requires their current password stored in Firestore). */
export async function updateAuthUserPassword(email, currentPassword, newPassword) {
  const secondaryAuth = getSecondaryAuth();
  try {
    const cred = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword);
    await updatePassword(cred.user, newPassword);
  } finally {
    await signOut(secondaryAuth);
  }
}
