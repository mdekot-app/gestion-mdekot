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

    // Si viene como string, parseamos
    if (typeof payloadIn === "string") {
      try {
        payloadIn = JSON.parse(payloadIn);
      } catch {
        payloadIn = {};
      }
    }

    // Si viene vacío, leemos del stream
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

    // 1) Cargar tokens
    const snap = await db.collection("pushTokens").get();
    const tokens = [];
    const tokenDocs = []; // para poder borrar inválidos

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const tok = data.token || doc.id;
      if (tok && typeof tok === "string") {
        tokens.push(tok);
        tokenDocs.push({ id: doc.id, token: tok });
      }
    });

    const uniqTokens = [...new Set(tokens)];

    if (uniqTokens.length === 0) {
      return res
        .status(200)
        .json({ ok: true, sent: 0, msg: "No hay tokens en pushTokens" });
    }

    // 2) Mensaje multi-plataforma (web + android)
    const payload = {
      notification: { title: t, body: b },

      // Web (PC / Chrome / PWA)
      webpush: {
        fcmOptions: { link: l },
        notification: {
          title: t,
          body: b,
        },
      },

      // Android (mejora entrega/visualización)
      android: {
        priority: "high",
        notification: {
          title: t,
          body: b,
        },
      },

      // Data (por si quieres manejar clicks/lógica en SW/app)
      data: {
        link: l,
      },
    };

    const result = await admin.messaging().sendEachForMulticast({
      tokens: uniqTokens,
      ...payload,
    });

    // 3) Limpiar tokens inválidos (muy recomendable)
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
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}