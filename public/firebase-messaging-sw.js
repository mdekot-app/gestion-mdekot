/* eslint-disable no-undef */
// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// ✅ MISMA CONFIG de tu firebase.js
firebase.initializeApp({
  apiKey: "AIzaSyCdBs0olnhVkLa4CxHQKnKXzpES2to_IZs",
  authDomain: "gestion-by-mdekot.firebaseapp.com",
  projectId: "gestion-by-mdekot",
  storageBucket: "gestion-by-mdekot.firebasestorage.app",
  messagingSenderId: "925024945706",
  appId: "1:925024945706:web:34dbd94fe0d03dfbe6e553"
});

const messaging = firebase.messaging();

// ✅ Esto hace que se vea la notificación aunque la app esté cerrada (cuando llegue un push)
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Gestión Mdekot";
  const body = payload?.notification?.body || "";
  const data = payload?.data || {};

  self.registration.showNotification(title, {
    body,
    icon: "/vite.svg",
    badge: "/vite.svg",
    data
  });
});
