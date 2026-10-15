// ==============================================
// Acesso de servidor: Firebase Admin e chaves de notificação
// ==============================================
// Os lembretes precisam ler os dados de quem ativou as notificações mesmo
// com o app fechado. Para isso o servidor entra com uma conta de serviço do
// Firebase (FIREBASE_SERVICE_ACCOUNT na Vercel, o JSON inteiro).
//
// As chaves VAPID (que assinam as notificações) saem da própria conta de
// serviço: menos uma coisa para configurar. Quem preferir chaves próprias
// pode definir VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.

import { createECDH, createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/** O JSON da conta de serviço, colado direto ou em base64. */
export function lerContaDeServico(bruto = process.env.FIREBASE_SERVICE_ACCOUNT) {
  if (!bruto) return null;
  let texto = String(bruto).trim();
  if (!texto.startsWith("{")) texto = Buffer.from(texto, "base64").toString("utf8");
  const conta = JSON.parse(texto);
  if (!conta.private_key || !conta.client_email) throw new Error("FIREBASE_SERVICE_ACCOUNT incompleto");
  return conta;
}

/**
 * Par de chaves P-256 (formato das notificações web) derivado de um segredo.
 * Sempre o mesmo par para o mesmo segredo, então as inscrições continuam
 * valendo de um deploy para outro.
 */
export function chavesDerivadas(segredo) {
  const privada = createHash("sha256").update(`ritmo-vapid:${segredo}`).digest();
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privada);
  return { publica: ecdh.getPublicKey().toString("base64url"), privada: privada.toString("base64url") };
}

/** null quando a Vercel ainda não tem FIREBASE_SERVICE_ACCOUNT. */
export function servidor() {
  const conta = lerContaDeServico();
  if (!conta) return null;
  const app = getApps()[0] ?? initializeApp({ credential: cert(conta), projectId: conta.project_id });
  const vapid =
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
      ? { publica: process.env.VAPID_PUBLIC_KEY, privada: process.env.VAPID_PRIVATE_KEY }
      : chavesDerivadas(conta.private_key);
  return { db: getFirestore(app), auth: getAuth(app), vapid };
}
