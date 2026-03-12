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
const APP_LINK = "https://gestion-mdekot.vercel.app";

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

async function enviarPushAGrupo({ grupoId, title, body, link }) {
  const snap = await db.collection("pushTokens").where("grupoId", "==", grupoId).get();
  const tokens = [];
  const tokenDocs = [];

  snap.forEach((docu) => {
    const data = docu.data() || {};
    const platform = String(data.platform || "").toLowerCase();
    const enabled = data.notificationsEnabled !== false;
    const tok = data.token || docu.id;

    if (platform !== "mobile") return;
    if (!enabled) return;
    if (!tok || typeof tok !== "string") return;

    tokens.push(tok);
    tokenDocs.push({ id: docu.id, token: tok });
  });

  const uniqTokens = [...new Set(tokens)];

  if (uniqTokens.length === 0) {
    return {
      ok: true,
      sent: 0,
      success: 0,
      failure: 0,
      invalidRemoved: 0,
      msg: "No hay tokens mobile activos para este grupo",
    };
  }

  const ts = String(Date.now());
  const result = await admin.messaging().sendEachForMulticast({
    tokens: uniqTokens,
    data: {
      title: String(title || "Gestion Mdekot"),
      body: String(body || "Notificacion"),
      link: String(link || APP_LINK),
      grupoId: String(grupoId || ""),
      ts,
    },
    android: { priority: "high" },
    webpush: {
      headers: { Urgency: "high" },
      fcmOptions: { link: String(link || APP_LINK) },
    },
  });

  const invalid = [];
  result.responses.forEach((r, idx) => {
    if (!r.success) {
      const code = r.error?.code || "";
      if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
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
      .collectionGroup("eventos")
      .where("fecha", "==", hoy)
      .where("notificado", "==", false)
      .get();

    if (snap.empty) {
      return res.status(200).json({
        ok: true,
        hoy,
        eventos: 0,
        grupos: 0,
        msg: "No hay eventos pendientes para hoy",
      });
    }

    const eventosPorGrupo = new Map();

    snap.forEach((docu) => {
      const data = docu.data() || {};
      const grupoId = docu.ref.parent?.parent?.id || String(data.grupoId || "").trim();
      if (!grupoId) return;

      if (!eventosPorGrupo.has(grupoId)) eventosPorGrupo.set(grupoId, []);
      eventosPorGrupo.get(grupoId).push({
        ref: docu.ref,
        titulo: String(data.titulo || "").trim(),
      });
    });

    if (eventosPorGrupo.size === 0) {
      return res.status(200).json({
        ok: true,
        hoy,
        eventos: 0,
        grupos: 0,
        msg: "No se pudo resolver grupoId en eventos pendientes",
      });
    }

    const resultados = [];
    let totalEventos = 0;
    let totalMarcados = 0;

    for (const [grupoId, eventosGrupo] of eventosPorGrupo.entries()) {
      totalEventos += eventosGrupo.length;

      const titulos = eventosGrupo.map((e) => e.titulo).filter(Boolean);
      const body = construirTextoEventos(titulos);

      if (!body) {
        resultados.push({
          grupoId,
          eventos: eventosGrupo.length,
          markedNotificado: 0,
          pushResult: { ok: false, error: "Sin titulos validos" },
        });
        continue;
      }

      const title = titulos.length === 1 ? "Evento de hoy" : "Eventos de hoy";

      try {
        const pushResult = await enviarPushAGrupo({
          grupoId,
          title,
          body,
          link: APP_LINK,
        });

        let markedNotificado = 0;
        if (pushResult.success > 0) {
          const batch = db.batch();
          eventosGrupo.forEach((ev) => {
            batch.update(ev.ref, {
              notificado: true,
              notifiedAt: new Date(),
            });
          });
          await batch.commit();
          markedNotificado = eventosGrupo.length;
          totalMarcados += markedNotificado;
        }

        resultados.push({
          grupoId,
          eventos: eventosGrupo.length,
          markedNotificado,
          pushResult,
        });
      } catch (error) {
        resultados.push({
          grupoId,
          eventos: eventosGrupo.length,
          markedNotificado: 0,
          pushResult: { ok: false, error: error?.message || String(error) },
        });
      }
    }

    return res.status(200).json({
      ok: true,
      hoy,
      grupos: resultados.length,
      eventos: totalEventos,
      marcadosNotificado: totalMarcados,
      resultados,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}
