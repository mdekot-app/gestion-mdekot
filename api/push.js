// api/push.js
import admin from "firebase-admin";

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY || "";
  // Vercel guarda saltos de línea como \n
  return key.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey()
    })
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { title, body, link } = req.body || {};
    const t = title || "Gestión Mdekot";
    const b = body || "Notificación";
    const l = link || "https://gestion-mdekot.vercel.app";

    const snap = await db.collection("pushTokens").get();
    const tokens = [];

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const tok = data.token || doc.id;
      if (tok && typeof tok === "string") tokens.push(tok);
    });

    const uniqTokens = [...new Set(tokens)];

    if (uniqTokens.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, msg: "No hay tokens en pushTokens" });
    }

    const message = {
      notification: { title: t, body: b },
      webpush: { fcmOptions: { link: l } }
    };

    const result = await admin.messaging().sendEachForMulticast({
      tokens: uniqTokens,
      ...message
    });

    return res.status(200).json({
      ok: true,
      tokens: uniqTokens.length,
      success: result.successCount,
      failure: result.failureCount
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}