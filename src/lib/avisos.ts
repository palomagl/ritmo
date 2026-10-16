// ==============================================
// Notificações no aparelho (Web Push)
// ==============================================
// O aparelho se inscreve com a chave pública do servidor e a inscrição vai
// para o Firestore (users/{uid}/pulsoAvisos). Daí em diante quem decide e
// manda os lembretes é o servidor (/api/lembretes), mesmo com o app fechado.
//
// No iPhone só funciona com o ritmo instalado na Tela de Início (iOS 16.4+).

import { dados, MODO_DEMO } from "@/dados";

export type SituacaoAvisos =
  | "demo" // modo demonstração: sem servidor
  | "sem-suporte" // navegador sem notificações
  | "instalar" // iPhone no Safari: precisa instalar na Tela de Início
  | "bloqueado" // a pessoa negou nas configurações
  | "indisponivel" // o servidor de lembretes ainda não foi configurado
  | "desligado"
  | "ligado";

function ehIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function instalado(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function temSuporte(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  // O service worker do PWA é registrado no início; aqui só esperamos ele.
  return navigator.serviceWorker.ready;
}

/** O servidor de lembretes está pronto? (null = sem internet para saber) */
let servidorPronto: Promise<boolean | null> | null = null;
function servidorDisponivel(): Promise<boolean | null> {
  servidorPronto ??= fetch("/api/lembretes?acao=chave")
    .then(async (r) => r.ok && Boolean(((await r.json()) as { chave?: string }).chave))
    .catch(() => {
      servidorPronto = null;
      return null;
    });
  return servidorPronto;
}

export async function situacaoAvisos(): Promise<SituacaoAvisos> {
  if (MODO_DEMO) return "demo";
  if ((await servidorDisponivel()) === false) return "indisponivel";
  if (ehIOS() && !instalado()) return "instalar";
  if (!temSuporte()) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "desligado";
  const r = await registro();
  return (await r.pushManager.getSubscription()) ? "ligado" : "desligado";
}

/** Id estável por aparelho, a partir do endereço da inscrição. */
function idDe(endpoint: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < endpoint.length; i++) {
    const c = endpoint.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `a${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

function nomeDoAparelho(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "Navegador";
}

function deBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const b64 = (texto + "=".repeat((4 - (texto.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function paraBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function chavePublica(): Promise<string> {
  let r: Response;
  try {
    r = await fetch("/api/lembretes?acao=chave");
  } catch {
    throw new Error("Sem internet agora. Tente de novo daqui a pouco.");
  }
  const j = (await r.json().catch(() => ({}))) as { chave?: string; erro?: string };
  if (!r.ok || !j.chave) throw new Error(j.erro || "O servidor de lembretes não respondeu.");
  return j.chave;
}

async function guardar(inscricao: PushSubscription) {
  await dados.salvarInscricaoAviso({
    id: idDe(inscricao.endpoint),
    endpoint: inscricao.endpoint,
    keys: { p256dh: paraBase64Url(inscricao.getKey("p256dh")), auth: paraBase64Url(inscricao.getKey("auth")) },
    aparelho: nomeDoAparelho(),
    criadoEm: Date.now(),
  });
}

/** Pede a permissão (precisa vir de um toque) e inscreve este aparelho. */
export async function ativarAvisos(): Promise<void> {
  if (!temSuporte()) throw new Error("Este navegador não recebe notificações.");
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("Sem permissão. Libere as notificações do ritmo nos Ajustes do aparelho.");
  const chave = await chavePublica();
  const r = await registro();
  let inscricao = await r.pushManager.getSubscription();
  // Inscrição feita com outra chave não recebe nada: refaz.
  const atual = inscricao?.options.applicationServerKey;
  if (inscricao && atual && paraBase64Url(atual) !== chave) {
    await inscricao.unsubscribe();
    inscricao = null;
  }
  inscricao ??= await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deBase64Url(chave) });
  await guardar(inscricao);
}

export async function desativarAvisos(): Promise<void> {
  if (!temSuporte()) return;
  const inscricao = await (await registro()).pushManager.getSubscription();
  if (!inscricao) return;
  await dados.excluirInscricaoAviso(idDe(inscricao.endpoint));
  await inscricao.unsubscribe();
}

/**
 * Ao abrir o app: se a permissão existe, garante que a inscrição deste
 * aparelho está no banco (o navegador às vezes troca a inscrição sozinho).
 */
export async function manterAvisos(): Promise<void> {
  if (MODO_DEMO || !temSuporte() || Notification.permission !== "granted") return;
  const inscricao = await (await registro()).pushManager.getSubscription();
  if (inscricao) await guardar(inscricao);
}

/** Manda um aviso de teste para os aparelhos inscritos. */
export async function testarAviso(): Promise<number> {
  const token = await dados.tokenDeAcesso();
  if (!token) throw new Error("Entre na sua conta para testar.");
  const r = await fetch("/api/lembretes?acao=testar", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  const j = (await r.json().catch(() => ({}))) as { enviados?: number; erro?: string };
  if (!r.ok) throw new Error(j.erro || "O teste não saiu.");
  return j.enviados ?? 0;
}
