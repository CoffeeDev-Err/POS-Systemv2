import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCC6NfJJepx8CMr-pqlFOVww6XEyQJPpVw",
  authDomain: "bsitdownloadwebsite.firebaseapp.com",
  projectId: "bsitdownloadwebsite",
  storageBucket: "bsitdownloadwebsite.firebasestorage.app",
  messagingSenderId: "1027671434855",
  appId: "1:1027671434855:web:da5ab9a0312961657516c2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
