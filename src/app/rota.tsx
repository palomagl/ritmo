// ==============================================
// Rotas
// ==============================================
// Um roteador de 60 linhas no lugar de uma biblioteca: o app tem uma dúzia
// de telas e só precisa de três coisas: saber o caminho atual, navegar e
// voltar. A Vercel devolve o index.html para qualquer caminho (vercel.json).

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

function assinar(f: () => void) {
  ouvintes.add(f);
  window.addEventListener("popstate", f);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("popstate", f);
  };
}

/** O caminho atual, sem query string. */
export function useCaminho(): string {
  return useSyncExternalStore(assinar, () => window.location.pathname, () => "/");
}

/** Profundidade no histórico, para saber se "voltar" tem para onde ir. */
const profundidade = () => (history.state as { p?: number } | null)?.p ?? 0;

export function navegar(para: string, opcoes: { substituir?: boolean } = {}) {
  if (para === window.location.pathname) return;
  if (opcoes.substituir) history.replaceState({ p: profundidade() }, "", para);
  else history.pushState({ p: profundidade() + 1 }, "", para);
  window.scrollTo(0, 0);
  avisar();
}

/** Volta uma tela; se o app abriu direto aqui, vai para `seNada`. */
export function voltar(seNada = "/") {
  if (profundidade() > 0) history.back();
  else navegar(seNada, { substituir: true });
}

/** Compara "/corrida/:id" com "/corrida/abc" e devolve { id: "abc" }. */
export function casar(padrao: string, caminho: string): Record<string, string> | null {
  const a = padrao.split("/").filter(Boolean);
  const b = caminho.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** Um <a> que navega sem recarregar a página. */
export function Link({ para, substituir, onClick, ...resto }: { para: string; substituir?: boolean } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const clicar = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navegar(para, { substituir });
  };
  return <a href={para} onClick={clicar} {...resto} />;
}
