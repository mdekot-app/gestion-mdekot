// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCdBs0olnhVkLa4CxHQKnKXzpES2to_IZs",
  authDomain: "gestion-by-mdekot.firebaseapp.com",
  projectId: "gestion-by-mdekot",
  storageBucket: "gestion-by-mdekot.firebasestorage.app",
  messagingSenderId: "925024945706",
  appId: "1:925024945706:web:34dbd94fe0d03dfbe6e553"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ✅ VAPID KEY (Web Push)
// Ponlo en Vercel y en local como variable de entorno:
// VITE_FIREBASE_VAPID_KEY="TU_VAPID_KEY"
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

// ✅ Messaging (solo si el navegador lo soporta)
export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};
