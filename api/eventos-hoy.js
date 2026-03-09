// api/eventos-hoy.js
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

function ymdMadrid(date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = partes.find((p) => p.type === "year")?.value;
  const month = partes.find((p) => p.type === "month")?.value;
  const day = partes.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function construirTextoEventos(titulos) {
  const limpios = titulos
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  if (limpios.length === 0) return null;
  if (limpios.length === 1) return `Hoy tienes: ${limpios[0]}`;
  if (limpios.length === 2) return `Hoy tienes: ${limpios[0]} y ${limpios[1]}`;

  return `Hoy tienes: ${limpios.slice(0, -1).join(", ")} y ${limpios[limpios.length - 1]}`;
}

async function enviarPushATokens({ title, body, link }) {
  const snap = await db.collection("pushTokens").get();
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
    return {
      ok: true,
      sent: 0,
      success: 0,
      failure: 0,
      invalidRemoved: 0,
      msg: "No hay tokens MOBILE activos con notificationsEnabled=true",
    };
  }

  const result = await admin.messaging().sendEachForMulticast({
    tokens: uniqTokens,
    data: {
      title: String(title || "Gestión Mdekot"),
      body: String(body || "Notificación"),
      link: String(link || "https://gestion-mdekot.vercel.app"),
    },
    android: {
      priority: "high",
    },
    webpush: {
      headers: {
        Urgency: "high",
      },
    },
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

  return {
    ok: true,
    sent: uniqTokens.length,
    success: result.successCount,
    failure: result.failureCount,
    invalidRemoved: invalid.length,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const cronSecret = process.env.CRON_SECRET || "";

    if (cronSecret) {
      const bearer = `Bearer ${cronSecret}`;
      if (authHeader !== bearer) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    const hoy = ymdMadrid();

    const snap = await db
      .collection("eventos")
      .where("fecha", "==", hoy)
      .where("notificado", "==", false)
      .get();

    if (snap.empty) {
      return res.status(200).json({
        ok: true,
        hoy,
        eventos: 0,
        msg: "No hay eventos pendientes para hoy",
      });
    }

    const eventos = [];
    const titulos = [];

    snap.forEach((docu) => {
      const data = docu.data() || {};
      eventos.push({ id: docu.id, ...data });
      if (data.titulo) titulos.push(data.titulo);
    });

    const body = construirTextoEventos(titulos);

    if (!body) {
      return res.status(200).json({
        ok: true,
        hoy,
        eventos: 0,
        msg: "No hay títulos válidos para notificar",
      });
    }

    const title = titulos.length === 1 ? "📅 Evento de hoy" : "📅 Eventos de hoy";

    const pushResult = await enviarPushATokens({
      title,
      body,
      link: "https://gestion-mdekot.vercel.app",
    });

    const batch = db.batch();
    eventos.forEach((ev) => {
      batch.update(db.collection("eventos").doc(ev.id), {
        notificado: true,
        notifiedAt: new Date(),
      });
    });
    await batch.commit();

    return res.status(200).json({
      ok: true,
      hoy,
      eventos: eventos.length,
      title,
      body,
      pushResult,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}