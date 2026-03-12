// api/push.js
import { admin, db } from "./_firebaseAdmin.js";
const DEFAULT_LINK = "https://gestion-mdekot.vercel.app";

function getBearerToken(authHeader = "") {
  const value = String(authHeader || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) return "";
  return value.slice(7).trim();
}

function normalizeLink(link) {
  try {
    const url = new URL(String(link || DEFAULT_LINK).trim() || DEFAULT_LINK);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_LINK;
    return url.toString();
  } catch {
    return DEFAULT_LINK;
  }
}

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
    const token = getBearerToken(req.headers.authorization);

    const t = String(title || "Gestion Mdekot").trim().slice(0, 120);
    const b = String(body || "Notificacion").trim().slice(0, 500);
    const l = normalizeLink(link);
    const g = String(grupoId || "").trim();
    const ts = String(Date.now());

    if (!g) {
      return res.status(400).json({
        ok: false,
        error: "Falta grupoId",
      });
    }

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Falta token de autenticacion",
      });
    }

    let decoded = null;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({
        ok: false,
        error: "Token invalido",
      });
    }

    const uid = String(decoded?.uid || "").trim();
    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: "Token invalido",
      });
    }

    const userSnap = await db.collection("usuarios").doc(uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({
        ok: false,
        error: "Usuario sin perfil",
      });
    }

    const userData = userSnap.data() || {};
    const userGroupId = String(userData.grupoId || "").trim();

    if (!userGroupId || userGroupId !== g) {
      return res.status(403).json({
        ok: false,
        error: "No autorizado para este grupo",
      });
    }

    const snap = await db.collection("pushTokens").where("grupoId", "==", g).get();

    const tokens = [];
    const tokenDocs = [];

    snap.forEach((docu) => {
      const data = docu.data() || {};
      const enabled = data.notificationsEnabled !== false;
      const tok = data.token || docu.id;

      if (!enabled) return;
      if (!tok || typeof tok !== "string") return;

      tokens.push(tok);
      tokenDocs.push({ id: docu.id, token: tok });
    });

    const uniqTokens = [...new Set(tokens)];

    if (uniqTokens.length === 0) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        msg: "No hay tokens activos para este grupo",
        grupoId: g,
      });
    }

    const multicastMessage = {
      tokens: uniqTokens,
      data: {
        title: t,
        body: b,
        link: l,
        grupoId: g,
        ts,
      },
      android: {
        priority: "high",
        ttl: 60 * 1000,
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "60",
        },
        fcmOptions: {
          link: l,
        },
      },
    };

    const result = await admin.messaging().sendEachForMulticast(multicastMessage);

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

      await Promise.all(toDelete.map((id) => db.collection("pushTokens").doc(id).delete()));
    }

    return res.status(200).json({
      ok: true,
      grupoId: g,
      tokens: uniqTokens.length,
      success: result.successCount,
      failure: result.failureCount,
      invalidRemoved: invalid.length,
      responses: result.responses.map((r) => ({
        success: r.success,
        error: r.error?.message || null,
        code: r.error?.code || null,
      })),
    });
  } catch (e) {
    console.error("PUSH API ERROR:", e);
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}

