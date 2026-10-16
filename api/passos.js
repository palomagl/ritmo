// ==============================================
// POST /api/passos — recebe os passos do Atalho do iPhone
// ==============================================
// O Atalho só precisa somar os passos do app Saúde e mandar para cá, junto
// com a chave dos passos gerada em Perfil → Passos do iPhone (campo
// "token"). A chave só serve para isto: grava os passos do dia e nada mais,
// e gerar outra desliga a anterior. Guardamos só a impressão (sha-256) dela.
//
// Atalhos antigos mandam o token de login do Firebase: continua aceito,
// pelo caminho de antes, até a pessoa trocar pela chave.

import { impressao, PREFIXO_CHAVE, servidor } from "./_servidor.js";

const FUSO = "America/Sao_Paulo";

function hoje() {
  // "en-CA" formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return Object.fromEntries(new URLSearchParams(req.body));
    }
  }
  return {};
}

/** "8.432", "8432", 8432.6 → 8432 */
function paraInteiro(v) {
  if (typeof v === "number") return Math.round(v);
  const so = String(v ?? "").replace(/[^\d,.-]/g, "");
  // Ponto ou vírgula seguidos de exatamente 3 dígitos são milhar; o resto é decimal.
  const normal = so.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Math.round(parseFloat(normal));
  return Number.isFinite(n) ? n : NaN;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, erro: "Use POST." });
    return;
  }

  const corpo = { ...req.query, ...lerCorpo(req) };
  const passos = paraInteiro(corpo.passos);
  const token = String(corpo.token ?? "").trim();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(corpo.data ?? "")) ? corpo.data : hoje();

  if (!token) {
    res.status(400).json({ ok: false, erro: "Faltou a chave. Gere em Perfil → Passos do iPhone." });
    return;
  }
  if (!Number.isFinite(passos) || passos < 0 || passos > 200000) {
    res.status(400).json({ ok: false, erro: "Os passos não vieram como número." });
    return;
  }

  // Chave dos passos (o jeito novo).
  if (token.startsWith(PREFIXO_CHAVE)) {
    let s;
    try {
      s = servidor();
    } catch {
      s = null;
    }
    if (!s) {
      res.status(500).json({ ok: false, erro: "Falta configurar FIREBASE_SERVICE_ACCOUNT na Vercel." });
      return;
    }
    const doc = await s.db.collection("chavesPassos").doc(impressao(token)).get();
    if (!doc.exists) {
      res.status(401).json({ ok: false, erro: "Chave inválida. Gere uma nova em Perfil → Passos do iPhone." });
      return;
    }
    const uid = doc.data().uid;
    await s.db.collection("users").doc(uid).collection("pulsoDias").doc(data).set({ passos, passosSyncEm: new Date() }, { merge: true });
    res.status(200).json({ ok: true, passos, data, mensagem: `${passos.toLocaleString("pt-BR")} passos enviados ao ritmo` });
    return;
  }

  const chave = process.env.VITE_FIREBASE_API_KEY;
  const projeto = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!chave || !projeto) {
    res.status(500).json({ ok: false, erro: "Firebase não configurado na Vercel." });
    return;
  }

  // 1. Token pessoal → sessão (id_token) e o id da pessoa.
  const sessao = await fetch(`https://securetoken.googleapis.com/v1/token?key=${chave}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token }),
  });
  if (!sessao.ok) {
    res.status(401).json({ ok: false, erro: "Token inválido ou vencido. Copie o token de novo no app." });
    return;
  }
  const { id_token: idToken, user_id: uid } = await sessao.json();

  // 2. Grava só os passos do dia (o updateMask não mexe em água nem comida).
  const url =
    `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents/users/${uid}/pulsoDias/${data}` +
    `?updateMask.fieldPaths=passos&updateMask.fieldPaths=passosSyncEm`;
  const gravou = await fetch(url, {
    method: "PATCH",
    headers: { authorization: `Bearer ${idToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      fields: {
        passos: { integerValue: String(passos) },
        passosSyncEm: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!gravou.ok) {
    res.status(502).json({ ok: false, erro: "Não consegui gravar agora. Tente de novo em instantes." });
    return;
  }

  res.status(200).json({ ok: true, passos, data, mensagem: `${passos.toLocaleString("pt-BR")} passos enviados ao Ritmo` });
}
