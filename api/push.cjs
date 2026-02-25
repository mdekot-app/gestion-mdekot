// api/push.cjs
const admin = require("firebase-admin");

// 1) Lee service account desde ENV (JSON o base64)
function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");

  // Puede venir como JSON directo o base64
  let jsonStr = raw;
  if (!raw.trim().startsWith("{")) {
    jsonStr = Buffer.from(raw, "base64").toString("utf8");
  }
  return JSON.parse(jsonStr);
}

// 2) Inicializa admin una sola vez (reutilizable en serverless)
function getAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = getServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { title, body, link } = req.body || {};
    const t = title || "Gestión Mdekot";
    const b = body || "Nuevo evento";
    const l = link || "https://gestion-mdekot.vercel.app";

    const adm = getAdmin();
    const db = adm.firestore();

    const snap = await db.collection("pushTokens").get();
    const tokens = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const tk = data.token || doc.id;
      if (tk && typeof tk === "string") tokens.push(tk);
    });

    const uniqTokens = [...new Set(tokens)];
    if (uniqTokens.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, msg: "No tokens" });
    }

    const message = {
      notification: { title: t, body: b },
      webpush: { fcmOptions: { link: l } }
    };

    const out = await adm.messaging().sendEachForMulticast({
      tokens: uniqTokens,
      ...message
    });

    return res.status(200).json({
      ok: true,
      tokens: uniqTokens.length,
      success: out.successCount,
      failure: out.failureCount
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
};