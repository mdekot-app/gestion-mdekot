// api/eventos-hoy.js
import { admin, db } from "./_firebaseAdmin.js";
const APP_LINK = "https://gestion-mdekot.vercel.app";

function partesMadrid(date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = partes.find((p) => p.type === "year")?.value;
  const month = partes.find((p) => p.type === "month")?.value;
  const day = partes.find((p) => p.type === "day")?.value;
  const hour = partes.find((p) => p.type === "hour")?.value || "00";
  const minute = partes.find((p) => p.type === "minute")?.value || "00";

  return {
    ymd: `${year}-${month}-${day}`,
    hm: `${hour}:${minute}`,
  };
}

function normalizarHora(valor) {
  const raw = String(valor || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "00:00";
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return "00:00";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function esRequestCronVercel(req) {
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  const cronHeader = String(req.headers["x-vercel-cron"] || "").toLowerCase();
  return ua.includes("vercel-cron") || cronHeader === "1" || cronHeader === "true";
}

async function enviarPushAGrupo({ grupoId, title, body, link }) {
  const snap = await db.collection("pushTokens").where("grupoId", "==", grupoId).get();
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
      const autorizado = authHeader === bearer || esRequestCronVercel(req);
      if (!autorizado) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    const ahora = partesMadrid();

    const eventosPorGrupo = new Map();
    const gruposSnap = await db.collection("grupos").get();

    for (const grupoDoc of gruposSnap.docs) {
      const grupoId = String(grupoDoc.id || "").trim();
      if (!grupoId) continue;

      const evSnap = await grupoDoc.ref
        .collection("eventos")
        .where("fecha", "==", ahora.ymd)
        .get();

      if (evSnap.empty) continue;

      evSnap.forEach((docu) => {
        const data = docu.data() || {};
        if (data.notificado === true) return;

        if (!eventosPorGrupo.has(grupoId)) eventosPorGrupo.set(grupoId, []);
        eventosPorGrupo.get(grupoId).push({
          ref: docu.ref,
          titulo: String(data.titulo || "").trim(),
          hora: normalizarHora(data.hora),
        });
      });
    }

    if (eventosPorGrupo.size === 0) {
      return res.status(200).json({
        ok: true,
        hoy: ahora.ymd,
        hora: ahora.hm,
        eventos: 0,
        grupos: 0,
        msg: "No se pudo resolver grupoId en eventos pendientes",
      });
    }

    const resultados = [];
    let totalEventos = 0;
    let totalMarcados = 0;
    let totalEnviados = 0;

    for (const [grupoId, eventosGrupo] of eventosPorGrupo.entries()) {
      totalEventos += eventosGrupo.length;

      try {
        let markedNotificado = 0;
        const detalles = [];

        for (const ev of eventosGrupo) {
          const tituloEvento = ev.titulo || "Evento";
          const pushResult = await enviarPushAGrupo({
            grupoId,
            title: "Recordatorio de evento",
            body: `${ev.hora} · ${tituloEvento}`,
            link: APP_LINK,
          });

          let marcado = false;
          if (pushResult.success > 0) {
            await ev.ref.update({
              notificado: true,
              notifiedAt: new Date(),
            });
            marcado = true;
            markedNotificado += 1;
            totalMarcados += 1;
            totalEnviados += 1;
          }

          detalles.push({
            titulo: tituloEvento,
            hora: ev.hora,
            marcado,
            pushResult,
          });
        }

        resultados.push({
          grupoId,
          eventosPendientesHoy: eventosGrupo.length,
          eventosVencidos: eventosGrupo.length,
          markedNotificado,
          detalles,
        });
      } catch (error) {
        resultados.push({
          grupoId,
          eventosPendientesHoy: eventosGrupo.length,
          markedNotificado: 0,
          pushResult: { ok: false, error: error?.message || String(error) },
        });
      }
    }

    return res.status(200).json({
      ok: true,
      hoy: ahora.ymd,
      hora: ahora.hm,
      grupos: resultados.length,
      eventos: totalEventos,
      enviados: totalEnviados,
      marcadosNotificado: totalMarcados,
      resultados,
    });
  } catch (e) {
    const detalle = e?.message || String(e);
    console.error("EVENTOS_HOY_ERROR:", detalle, e?.stack || "");
    return res.status(500).json({
      ok: false,
      error: detalle,
    });
  }
}

