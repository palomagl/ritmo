// ==============================================
// Segurança da conta (lado do app)
// ==============================================
// Conversa com /api/conta usando o token do login, e cuida de deixar o
// aparelho limpo ao sair: num celular emprestado ou dividido, nada da conta
// pode ficar para a próxima pessoa.

import { dados, MODO_DEMO } from "@/dados";
import { desativarAvisos } from "./avisos";

async function chamar(acao: string, corpo?: unknown): Promise<Record<string, unknown>> {
  const token = await dados.tokenDeAcesso();
  if (!token) throw new Error("Entre na sua conta de novo para continuar.");
  let r: Response;
  try {
    r = await fetch(`/api/conta?acao=${acao}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(corpo ?? {}),
    });
  } catch {
    throw new Error("Sem internet agora. Tente de novo daqui a pouco.");
  }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(j.erro || "Não deu certo agora. Tente de novo."));
  return j;
}

/** Apaga deste aparelho tudo o que a conta deixou: cache, fila de fotos, preferências. */
export async function limparAparelho(): Promise<void> {
  try {
    for (const k of Object.keys(localStorage)) {
      // O tema é do aparelho, não da conta.
      if ((k.startsWith("ritmo:") || k.startsWith("pulso:")) && k !== "pulso:tema") localStorage.removeItem(k);
    }
  } catch {
    /* sem armazenamento: nada a limpar */
  }
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase("pulso");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Sair deste aparelho: para as notificações daqui, encerra a sessão e apaga
 * o cache local (o Firestore guarda uma cópia dos dados para funcionar offline).
 */
export async function sairDaConta(): Promise<void> {
  await desativarAvisos().catch(() => {});
  await dados.sair();
  await limparAparelho();
  window.location.replace("/");
}

/** Encerra a sessão em todos os aparelhos. */
export async function sairDeTodosOsAparelhos(): Promise<void> {
  if (MODO_DEMO) return;
  await chamar("sair-de-tudo");
  await sairDaConta();
}

/** Apaga a conta e todos os dados. Não tem volta. */
export async function apagarConta(): Promise<void> {
  if (MODO_DEMO) throw new Error("No modo demonstração não há conta para apagar.");
  await desativarAvisos().catch(() => {});
  await chamar("apagar", { confirmar: "APAGAR" });
  await dados.sair().catch(() => {});
  await limparAparelho();
  window.location.replace("/");
}
