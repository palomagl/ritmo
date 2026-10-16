// ==============================================
// /api/conta: segurança da conta
// ==============================================
// Ações que o navegador não pode (nem deve) fazer sozinho, todas com o
// token do login de quem pede:
//   chave-passos   gera a chave do Atalho (só escreve passos; a anterior para)
//   sair-de-tudo   encerra a sessão em todos os aparelhos
//   apagar         apaga a conta e todos os dados, sem volta

import { randomBytes } from "node:crypto";
import { impressao, PREFIXO_CHAVE, quemChama, servidor } from "./_servidor.js";

function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

async function apagarChaves(db, uid) {
  const snap = await db.collection("chavesPassos").where("uid", "==", uid).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, erro: "Use POST." });
    return;
  }
  let s;
  try {
    s = servidor();
  } catch {
    s = null;
  }
  if (!s) {
    res.status(500).json({ ok: false, erro: "Falta configurar FIREBASE_SERVICE_ACCOUNT na Vercel (veja o README)." });
    return;
  }
  const acao = String(req.query.acao || "");
  // Apagar a conta exige uma sessão que não tenha sido encerrada.
  const uid = await quemChama(req, s, acao === "apagar");
  if (!uid) {
    res.status(401).json({ ok: false, erro: "Sua sessão expirou. Saia e entre de novo." });
    return;
  }

  if (acao === "chave-passos") {
    const chave = PREFIXO_CHAVE + randomBytes(24).toString("base64url");
    await apagarChaves(s.db, uid);
    await s.db.collection("chavesPassos").doc(impressao(chave)).set({ uid, criadaEm: new Date() });
    res.status(200).json({ ok: true, chave });
    return;
  }

  if (acao === "sair-de-tudo") {
    await s.auth.revokeRefreshTokens(uid);
    res.status(200).json({ ok: true });
    return;
  }

  if (acao === "apagar") {
    if (lerCorpo(req).confirmar !== "APAGAR") {
      res.status(400).json({ ok: false, erro: "Confirmação faltando." });
      return;
    }
    await apagarChaves(s.db, uid);
    // Apaga users/{uid} e tudo embaixo (refeições, fotos, medidas, avisos...).
    await s.db.recursiveDelete(s.db.collection("users").doc(uid));
    await s.auth.deleteUser(uid);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ ok: false, erro: "Ação desconhecida." });
}
