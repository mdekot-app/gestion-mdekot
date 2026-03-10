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

    const { title, body, link, grupoId } = payloadIn || {};

    const t = title || "Gestión Mdekot";
    const b = body || "Notificación";
    const l = link || "https://gestion-mdekot.vercel.app";
    const g = String(grupoId || "").trim();

    if (!g) {
      return res.status(400).json({
        ok: false,
        error: "Falta grupoId",
      });
    }

    const snap = await db
      .collection("pushTokens")
      .where("grupoId", "==", g)
      .get();

    const tokens = [];
    const tokenDocs = [];

    snap.forEach((docu) => {
      const data = docu.data() || {};
      const platform = String(data.platform || "").toLowerCase();
      const enabled = data.notificationsEnabled !== false;

      if (platform !== "mobile") return;
      if (!enabled) return;

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
        msg: "No hay tokens MOBILE activos para este grupo",
        grupoId: g,
      });
    }

    const payload = {
      data: {
        title: String(t),
        body: String(b),
        link: String(l),
        grupoId: g,
      },
      android: {
        priority: "high",
      },
      webpush: {
        headers: {
          Urgency: "high",
        },
      },
    };

    const result = await admin.messaging().sendEachForMulticast({
      tokens: uniqTokens,
      ...payload,
    });

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
      grupoId: g,
      tokens: uniqTokens.length,
      success: result.successCount,
      failure: result.failureCount,
      invalidRemoved: invalid.length,
      target: "mobile_enabled_only_group_filtered",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}