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

messaging.onBackgroundMessage((payload) => {
  console.log("📩 Push recibido en background SW:", payload);

  const title = payload?.data?.title || "Gestión Mdekot";
  const body = payload?.data?.body || "";
  const link = payload?.data?.link || "https://gestion-mdekot.vercel.app";
  const grupoId = payload?.data?.grupoId || "";
  const ts = payload?.data?.ts || String(Date.now());

  return self.registration.showNotification(title, {
    body,
    icon: "/vite.svg",
    badge: "/vite.svg",
    data: { link, grupoId, ts },
    tag: `gasto-${grupoId}-${ts}`,
    renotify: false,
    requireInteraction: false
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification?.data?.link || "https://gestion-mdekot.vercel.app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const urlOk =
          client.url.includes("gestion-mdekot.vercel.app") ||
          client.url.includes("localhost");

        if (urlOk && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(link);
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});