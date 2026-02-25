// api/push.js
import admin from "firebase-admin";

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY || "";
  return key.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // ✅ PARSEO ROBUSTO DEL BODY (vercel dev / curl / prod)
    let payloadIn = req.body;

    if (typeof payloadIn === "string") {
      try {
        payloadIn = JSON.parse(payloadIn);
      } catch {
        payloadIn = {};
      }
    }

    if (!payloadIn || Object.keys(payloadIn).length === 0) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        payloadIn = raw ? JSON.parse(raw) : {};
      } catch {
        payloadIn = {};
      }
    }

    const { title, body, link } = payloadIn || {};
    const t = title || "Gestión Mdekot";
    const b = body || "Notificación";
    const l = link || "https://gestion-mdekot.vercel.app";

    // 1) Cargar SOLO tokens mobile
    const snap = await db.collection("pushTokens").get();
    const tokens = [];
    const tokenDocs = [];

    snap.forEach((docu) => {
      const data = docu.data() || {};
      const platform = String(data.platform || "").toLowerCase();
      if (platform !== "mobile") return; // ✅ SOLO MOBILE

      const tok = data.token || docu.id;
      if (tok && typeof tok === "string") {
        tokens.push(tok);
        tokenDocs.push({ id: docu.id, token: tok });
      }
    });

    const uniqTokens = [...new Set(tokens)];

    if (uniqTokens.length === 0) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        msg: "No hay tokens MOBILE en pushTokens (platform: mobile)",
      });
    }

    // 2) Payload (solo móvil; android ayuda a prioridad)
    const payload = {
      notification: { title: t, body: b },
      android: {
        priority: "high",
        notification: { title: t, body: b },
      },
      data: {
        link: l,
      },
    };

    const result = await admin.messaging().sendEachForMulticast({
      tokens: uniqTokens,
      ...payload,
    });

    // 3) Limpiar tokens inválidos (solo los mobile usados)
    const invalid = [];
    result.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-argument")
        ) {
          invalid.push(uniqTokens[idx]);
        }
      }
    });

    if (invalid.length) {
      const toDelete = tokenDocs
        .filter((d) => invalid.includes(d.token))
        .map((d) => d.id);

      await Promise.all(
        toDelete.map((id) => db.collection("pushTokens").doc(id).delete())
      );
    }

    return res.status(200).json({
      ok: true,
      tokens: uniqTokens.length,
      success: result.successCount,
      failure: result.failureCount,
      invalidRemoved: invalid.length,
      target: "mobile",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}