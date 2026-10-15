// ==============================================
// /api/lembretes: notificações de água, refeição e resumo da semana
// ==============================================
// Três ações, escolhidas por ?acao=:
//   chave    (GET)  a chave pública que o navegador usa para se inscrever
//   enviar   (POST) a rodada do agendador: decide e manda os avisos
//   testar   (POST) manda um aviso de teste para os aparelhos da pessoa
//
// As inscrições ficam em users/{uid}/pulsoAvisos (uma por aparelho) e o que
// já foi avisado no dia, em users/{uid}/pulsoLembretes/estado. A rodada pode
// rodar quantas vezes for: quem decide se avisa é o estado, então chamar de
// novo não repete aviso.

import webpush from "web-push";
import { servidor } from "./_servidor.js";
import { agoraNoFuso, decidir, segundaDa, somarDias } from "./_lembretes.js";

function configurar(res, req) {
  let s;
  try {
    s = servidor();
  } catch (e) {
    res.status(500).json({ ok: false, erro: `FIREBASE_SERVICE_ACCOUNT inválido na Vercel: ${e.message}` });
    return null;
  }
  if (!s) {
    res.status(500).json({ ok: false, erro: "Lembretes não configurados: falta FIREBASE_SERVICE_ACCOUNT na Vercel (veja o README)." });
    return null;
  }
  const origem = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  webpush.setVapidDetails(origem, s.vapid.publica, s.vapid.privada);
  return s;
}

/** Manda para um aparelho. Inscrição vencida (404/410) é apagada. */
async function mandar(doc, aviso) {
  const d = doc.data();
  try {
    await webpush.sendNotification(
      { endpoint: d.endpoint, keys: d.keys },
      JSON.stringify(aviso),
      // topic: um aviso novo de água substitui o antigo que ainda não chegou.
      { TTL: 60 * 60, urgency: "normal", topic: aviso.tag }
    );
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await doc.ref.delete().catch(() => {});
    else console.warn("Aviso não enviado:", e.statusCode, e.body || e.message);
    return false;
  }
}

/** Todas as inscrições, agrupadas por pessoa. */
async function inscricoesPorPessoa(db) {
  const snap = await db.collectionGroup("pulsoAvisos").get();
  const mapa = new Map();
  for (const doc of snap.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid || !doc.data().endpoint) continue;
    if (!mapa.has(uid)) mapa.set(uid, []);
    mapa.get(uid).push(doc);
  }
  return mapa;
}

async function rodadaDaPessoa(db, uid, aparelhos, agora, agoraMs) {
  const usuario = db.collection("users").doc(uid);
  const [perfilSnap, diaSnap, planoSnap, estadoSnap, refeicoesSnap] = await Promise.all([
    usuario.get(),
    usuario.collection("pulsoDias").doc(agora.hoje).get(),
    usuario.collection("pulsoPlano").doc("atual").get(),
    usuario.collection("pulsoLembretes").doc("estado").get(),
    usuario.collection("pulsoRefeicoes").where("data", "==", agora.hoje).select("tipo", "em").get(),
  ]);

  // Domingo à noite precisa da semana inteira para o resumo.
  let semana = [];
  if (agora.diaSemana === 0 && agora.h >= 19) {
    const segunda = segundaDa(agora.hoje);
    const refs = Array.from({ length: 7 }, (_, i) => usuario.collection("pulsoDias").doc(somarDias(segunda, i)));
    semana = (await db.getAll(...refs)).filter((s) => s.exists).map((s) => s.data());
  }

  const { aviso, estado } = decidir({
    agora,
    agoraMs,
    perfil: perfilSnap.data()?.pulso ?? {},
    dia: diaSnap.data() ?? {},
    plano: planoSnap.exists ? planoSnap.data() : null,
    refeicoes: refeicoesSnap.docs.map((d) => d.data()),
    estado: estadoSnap.data() ?? null,
    semana,
  });
  if (!aviso) return 0;

  // Grava antes de mandar: se duas rodadas se cruzarem, a segunda já vê.
  await usuario.collection("pulsoLembretes").doc("estado").set(estado);
  const enviados = await Promise.all(aparelhos.map((doc) => mandar(doc, aviso)));
  return enviados.filter(Boolean).length;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const acao = String(req.query.acao || "");
  const s = configurar(res, req);
  if (!s) return;

  if (acao === "chave") {
    res.status(200).json({ ok: true, chave: s.vapid.publica });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, erro: "Use POST." });
    return;
  }

  if (acao === "enviar") {
    // Com CRON_SECRET definido, só o agendador entra. Sem ele, a rota é
    // aberta, mas inofensiva: o estado impede avisos repetidos.
    const segredo = process.env.CRON_SECRET;
    if (segredo && req.headers.authorization !== `Bearer ${segredo}`) {
      res.status(401).json({ ok: false, erro: "Não autorizado." });
      return;
    }
    const agoraMs = Date.now();
    const agora = agoraNoFuso(new Date(agoraMs));
    const pessoas = await inscricoesPorPessoa(s.db);
    let avisos = 0;
    for (const [uid, aparelhos] of pessoas) {
      try {
        avisos += await rodadaDaPessoa(s.db, uid, aparelhos, agora, agoraMs);
      } catch (e) {
        console.error("Lembrete falhou para uma pessoa:", e);
      }
    }
    res.status(200).json({ ok: true, pessoas: pessoas.size, avisos, hora: agora });
    return;
  }

  if (acao === "testar") {
    let uid;
    try {
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      uid = (await s.auth.verifyIdToken(token)).uid;
    } catch {
      res.status(401).json({ ok: false, erro: "Entre de novo no ritmo e tente outra vez." });
      return;
    }
    const snap = await s.db.collection("users").doc(uid).collection("pulsoAvisos").get();
    if (snap.empty) {
      res.status(404).json({ ok: false, erro: "Nenhum aparelho com notificações ativas." });
      return;
    }
    const aviso = { tag: "teste", titulo: "Lembretes ligados", corpo: "É assim que o ritmo vai te lembrar da água e das refeições.", url: "/perfil" };
    const enviados = (await Promise.all(snap.docs.map((d) => mandar(d, aviso)))).filter(Boolean).length;
    res.status(enviados ? 200 : 502).json({ ok: enviados > 0, enviados, erro: enviados ? undefined : "O aviso não saiu. Desative e ative de novo." });
    return;
  }

  res.status(400).json({ ok: false, erro: "Ação desconhecida." });
}
