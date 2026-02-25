// push-test.js
// Enviar notificación FCM a TODOS los tokens guardados en Firestore (pushTokens)

const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  const title = process.argv[2] || "PRUEBA";
  const body = process.argv[3] || "Si ves esto, funciona el envío a todos.";
  const link = process.argv[4] || "https://gestion-mdekot.vercel.app";

  const snap = await db.collection("pushTokens").get();
  const tokens = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    // Tu docId es el token, pero también guardas data.token. Cogemos el que exista.
    const t = data.token || doc.id;
    if (t && typeof t === "string") tokens.push(t);
  });

  const uniqTokens = [...new Set(tokens)];
  console.log("Tokens encontrados:", uniqTokens.length);

  if (uniqTokens.length === 0) {
    console.log("❌ No hay tokens en Firestore (colección pushTokens).");
    process.exit(0);
  }

  // En web push es buena idea poner webpush.fcmOptions.link
  const message = {
    notification: { title, body },
    webpush: {
      fcmOptions: { link }
    }
  };

  // Si hay más de 500 tokens, hay que trocear. (De momento lo dejamos simple)
  const res = await admin.messaging().sendEachForMulticast({
    tokens: uniqTokens,
    ...message
  });

  console.log("✅ Enviados OK:", res.successCount);
  console.log("❌ Fallos:", res.failureCount);

  if (res.failureCount > 0) {
    res.responses.forEach((r, i) => {
      if (!r.success) {
        console.log("Error token", i, uniqTokens[i], r.error?.message || r.error);
      }
    });
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});