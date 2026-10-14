// ==============================================
// Estado compartilhado: conta, perfil, o dia de hoje, o plano e avisos
// ==============================================
// O que quase toda tela usa é observado uma vez só, aqui no topo. O resto
// cada tela observa por conta própria com `useObservar`.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { dados, type Cancelar, type Dia, type Perfil, type Plano, type Usuario } from "@/dados";
import { chaveDia } from "@/lib/datas";

// ----------------------------------------------
// Observar qualquer coisa do backend
// ----------------------------------------------

/** `undefined` enquanto carrega; depois, o valor ao vivo. */
export function useObservar<T>(assinar: ((cb: (v: T) => void) => Cancelar) | null, deps: unknown[]): T | undefined {
  const [valor, setValor] = useState<T | undefined>(undefined);
  useEffect(() => {
    setValor(undefined);
    if (!assinar) return;
    return assinar(setValor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return valor;
}

/** A chave de hoje, que vira sozinha à meia-noite (o app pode ficar aberto). */
export function useHoje(): string {
  const [hoje, setHoje] = useState(chaveDia);
  useEffect(() => {
    const id = setInterval(() => setHoje((h) => (h === chaveDia() ? h : chaveDia())), 30_000);
    const aoVoltar = () => setHoje(chaveDia());
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);
  return hoje;
}

/** Hora atual com fração (14.5 = 14h30), atualizada a cada minuto. */
export function useAgoraH(): number {
  const calc = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };
  const [h, setH] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setH(calc()), 60_000);
    return () => clearInterval(id);
  }, []);
  return h;
}

// ----------------------------------------------
// Conta + perfil + hoje + plano
// ----------------------------------------------

interface Estado {
  usuario: Usuario | null;
  carregandoConta: boolean;
  perfil: Perfil | undefined;
  hoje: string;
  dia: Dia | undefined;
  plano: Plano | null | undefined;
}

const Ctx = createContext<Estado | null>(null);

export function EstadoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(true);
  const hoje = useHoje();

  useEffect(
    () =>
      dados.observarUsuario((u) => {
        setUsuario(u);
        setCarregandoConta(false);
      }),
    []
  );

  const logado = usuario?.uid ?? null;
  const perfil = useObservar<Perfil>(logado ? (cb) => dados.observarPerfil(cb) : null, [logado]);
  const dia = useObservar<Dia>(logado ? (cb) => dados.observarDia(hoje, cb) : null, [logado, hoje]);
  const plano = useObservar<Plano | null>(logado ? (cb) => dados.observarPlano(cb) : null, [logado]);

  return <Ctx.Provider value={{ usuario, carregandoConta, perfil, hoje, dia, plano }}>{children}</Ctx.Provider>;
}

export function useEstado(): Estado {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEstado fora do EstadoProvider");
  return c;
}

// ----------------------------------------------
// Avisos (toast) com ação opcional, ex.: "Desfazer"
// ----------------------------------------------

interface Aviso {
  id: number;
  texto: string;
  acao?: { rotulo: string; fazer: () => void };
}

const CtxAvisos = createContext<(texto: string, acao?: Aviso["acao"], duracaoMs?: number) => void>(() => {});

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximo = useRef(1);

  const mostrar = useCallback((texto: string, acao?: Aviso["acao"], duracaoMs = 4000) => {
    const id = proximo.current++;
    setAvisos((a) => [...a.slice(-1), { id, texto, acao }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), duracaoMs);
  }, []);

  return (
    <CtxAvisos.Provider value={mostrar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="aviso">
            <span className="cresce">{a.texto}</span>
            {a.acao && (
              <button
                onClick={() => {
                  a.acao!.fazer();
                  setAvisos((l) => l.filter((x) => x.id !== a.id));
                }}
              >
                {a.acao.rotulo}
              </button>
            )}
          </div>
        ))}
      </div>
    </CtxAvisos.Provider>
  );
}

export const useAvisos = () => useContext(CtxAvisos);
