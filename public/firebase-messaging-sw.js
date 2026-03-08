/* eslint-disable no-undef */
// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCdBs0olnhVkLa4CxHQKnKXzpES2to_IZs",
  authDomain: "gestion-by-mdekot.firebaseapp.com",
  projectId: "gestion-by-mdekot",
  storageBucket: "gestion-by-mdekot.firebasestorage.app",
  messagingSenderId: "925024945706",
  appId: "1:925024945706:web:34dbd94fe0d03dfbe6e553"
});

const messaging = firebase.messaging();

// ✅ Mostrar UNA notificación cuando la app está en segundo plano o móvil bloqueado
messaging.onBackgroundMessage((payload) => {
  const title = payload?.data?.title || "Gestión Mdekot";
  const body = payload?.data?.body || "";
  const link = payload?.data?.link || "https://gestion-mdekot.vercel.app";

  self.registration.showNotification(title, {
    body,
    icon: "/vite.svg",
    badge: "/vite.svg",
    data: { link }
  });
});

// ✅ Abrir la app al tocar la notificación
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification?.data?.link || "https://gestion-mdekot.vercel.app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("gestion-mdekot") && "focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(link);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});