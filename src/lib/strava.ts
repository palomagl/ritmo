// ==============================================
// Strava: conectar e trazer as corridas
// ==============================================
// Quem fala com o Strava é a função /api/strava (lá fica o segredo do app).
// Aqui o app só guarda a conexão no perfil e, de tempos em tempos, pede as
// corridas novas e salva as que ainda não tem.

import { dados, type ConexaoStrava, type Corrida, type Perfil } from "@/dados";
import { kcalEstimada } from "./corrida";

const INTERVALO_MS = 20 * 60 * 1000; // no máximo uma busca a cada 20 min
const CHAVE_ULTIMA = "ritmo:strava:ultimaTentativa";

export function conectarStrava() {
  window.location.href = "/api/strava?acao=conectar";
}

/** Termina a conexão: o Strava voltou para /strava?code=... */
export async function concluirConexao(code: string): Promise<ConexaoStrava> {
  const r = await fetch("/api/strava?acao=token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refreshToken) throw new Error(j.erro || "Não consegui conectar ao Strava.");
  const conexao: ConexaoStrava = { refreshToken: j.refreshToken, atleta: j.atleta || "", ultimaBusca: null };
  await dados.salvarPerfil({ strava: conexao });
  return conexao;
}

export async function desconectarStrava() {
  await dados.salvarPerfil({ strava: null });
}

/** Lê as corridas uma vez (para saber o que já foi importado). */
function corridasAtuais(): Promise<Corrida[]> {
  return new Promise((ok) => {
    let parar: (() => void) | null = null;
    parar = dados.observarCorridas((c) => {
      ok(c);
      queueMicrotask(() => parar?.());
    });
  });
}

/**
 * Busca e salva as corridas novas do Strava. Devolve quantas entraram.
 * `forcar` ignora o intervalo mínimo (botão "Sincronizar agora").
 */
export async function sincronizarStrava(perfil: Perfil, forcar = false): Promise<number> {
  const conexao = perfil.strava;
  if (!conexao?.refreshToken) return 0;
  try {
    const ultima = Number(localStorage.getItem(CHAVE_ULTIMA) || 0);
    if (!forcar && Date.now() - ultima < INTERVALO_MS) return 0;
    localStorage.setItem(CHAVE_ULTIMA, String(Date.now()));
  } catch {
    /* sem armazenamento: segue sem o limite */
  }

  const existentes = await corridasAtuais();
  const jaTenho = existentes.map((c) => c.stravaId).filter((id): id is number => typeof id === "number");
  const r = await fetch("/api/strava?acao=atividades", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Volta 2 dias além da última busca: atividade enviada atrasada pelo relógio ainda entra.
    body: JSON.stringify({ refreshToken: conexao.refreshToken, depois: conexao.ultimaBusca ? conexao.ultimaBusca - 2 * 86400 : undefined, jaTenho }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "Não consegui falar com o Strava agora.");

  const novas = (j.corridas as Omit<Corrida, "id">[]).filter((c) => !jaTenho.includes(c.stravaId!));
  for (const c of novas) {
    await dados.salvarCorrida({ ...c, kcalEstimada: c.kcalEstimada || kcalEstimada(c.distanciaM, perfil.pesoKg, c.tipo) });
  }
  const maisRecente = Math.max(conexao.ultimaBusca ?? 0, ...novas.map((c) => Math.floor(c.inicio / 1000)));
  await dados.salvarPerfil({ strava: { ...conexao, refreshToken: j.refreshToken || conexao.refreshToken, ultimaBusca: maisRecente || conexao.ultimaBusca } });
  return novas.length;
}
