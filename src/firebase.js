import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCdBs0olnhVkLa4CxHQKnKXzpES2to_IZs",
  authDomain: "gestion-by-mdekot.firebaseapp.com",
  projectId: "gestion-by-mdekot",
  storageBucket: "gestion-by-mdekot.firebasestorage.app",
  messagingSenderId: "925024945706",
  appId: "1:925024945706:web:34dbd94fe0d03dfbe6e553"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
