import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { EstadoProvider, AvisosProvider, useEstado } from "@/app/estado";
import { casar, navegar, useCaminho } from "@/app/rota";
import { ERRO_CONFIG, MODO_DEMO } from "@/dados";
import { sincronizarStrava } from "@/lib/strava";
import { manterAvisos } from "@/lib/avisos";
import { BarraInferior } from "@/componentes/BarraInferior";
import { Marca } from "@/componentes/Icone";
import { Esqueleto } from "@/componentes/basicos";
import Entrar from "@/telas/Entrar";
import BoasVindas from "@/telas/BoasVindas";
import Hoje from "@/telas/Hoje";
import Configurar from "@/telas/Configurar";

// Telas menos usadas carregam sob demanda: o Hoje abre mais rápido.
const Mover = lazy(() => import("@/telas/Mover"));
const CorridaAoVivo = lazy(() => import("@/telas/CorridaAoVivo"));
const CorridaResumo = lazy(() => import("@/telas/CorridaResumo"));
const Comer = lazy(() => import("@/telas/Comer"));
const RegistrarRefeicao = lazy(() => import("@/telas/RegistrarRefeicao"));
const MeuPlano = lazy(() => import("@/telas/MeuPlano"));
const Perguntar = lazy(() => import("@/telas/Perguntar"));
const Agua = lazy(() => import("@/telas/Agua"));
const Corpo = lazy(() => import("@/telas/Corpo"));
const Perfil = lazy(() => import("@/telas/Perfil"));
const StravaRetorno = lazy(() => import("@/telas/StravaRetorno"));
const Semana = lazy(() => import("@/telas/Semana"));

/** Tela de espera: a marca no meio, sem piscar conteúdo pela metade. */
function Abertura() {
  return (
    <div className="entrar">
      <div className="marca pulsando">
        <Marca />
      </div>
    </div>
  );
}

function Carregando() {
  return (
    <div className="pilha" style={{ paddingTop: 58 }}>
      <Esqueleto altura={140} raio={22} />
      <Esqueleto altura={96} raio={22} />
      <Esqueleto altura={96} raio={22} />
    </div>
  );
}

const ROTAS: { padrao: string; tela: (p: Record<string, string>) => ReactNode; semBarra?: boolean }[] = [
  { padrao: "/", tela: () => <Hoje /> },
  { padrao: "/mover/passos", tela: () => <Mover aba="passos" /> },
  { padrao: "/mover/corridas", tela: () => <Mover aba="corridas" /> },
  { padrao: "/corrida/ao-vivo", tela: () => <CorridaAoVivo />, semBarra: true },
  { padrao: "/corrida/:id", tela: (p) => <CorridaResumo id={p.id} /> },
  { padrao: "/comer", tela: () => <Comer /> },
  { padrao: "/comer/foto", tela: () => <RegistrarRefeicao modo="foto" />, semBarra: true },
  { padrao: "/comer/descrever", tela: () => <RegistrarRefeicao modo="texto" />, semBarra: true },
  { padrao: "/comer/plano", tela: () => <MeuPlano /> },
  { padrao: "/comer/perguntar", tela: () => <Perguntar /> },
  { padrao: "/agua", tela: () => <Agua /> },
  { padrao: "/corpo", tela: () => <Corpo /> },
  { padrao: "/perfil", tela: () => <Perfil /> },
  { padrao: "/semana", tela: () => <Semana /> },
  { padrao: "/strava", tela: () => <StravaRetorno />, semBarra: true },
];

function Conteudo() {
  const { usuario, carregandoConta, perfil } = useEstado();
  const caminho = useCaminho();

  // Atalhos antigos ou digitados: /mover vai para os passos; qualquer
  // caminho desconhecido volta para o Hoje.
  const conhecido = ROTAS.some((r) => casar(r.padrao, caminho));

  // Corridas do Strava entram sozinhas: ao abrir o app e quando ele volta a
  // aparecer na tela (no máximo uma busca a cada 20 minutos).
  const temStrava = Boolean(perfil?.strava?.refreshToken);
  const perfilAtual = useRef(perfil);
  perfilAtual.current = perfil;
  useEffect(() => {
    if (!temStrava || MODO_DEMO) return;
    // Sempre o perfil mais novo: o Strava pode trocar o token a cada busca.
    const buscar = () => perfilAtual.current && void sincronizarStrava(perfilAtual.current).catch((e) => console.warn("Strava:", e));
    buscar();
    const aoVoltar = () => document.visibilityState === "visible" && buscar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temStrava]);
  // Notificações: o toque numa notificação com o app aberto troca de tela, e
  // a inscrição deste aparelho é conferida a cada login.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const aoReceber = (e: MessageEvent) => {
      const d = e.data as { tipo?: string; caminho?: string } | null;
      if (d?.tipo === "abrir" && d.caminho) navegar(d.caminho);
    };
    navigator.serviceWorker.addEventListener("message", aoReceber);
    return () => navigator.serviceWorker.removeEventListener("message", aoReceber);
  }, []);
  const uid = usuario?.uid;
  useEffect(() => {
    if (uid) void manterAvisos().catch((e) => console.warn("Notificações:", e));
  }, [uid]);

  useEffect(() => {
    if (caminho === "/mover") navegar("/mover/passos", { substituir: true });
    else if (!conhecido) navegar("/", { substituir: true });
  }, [caminho, conhecido]);

  if (ERRO_CONFIG) return <Configurar erro={ERRO_CONFIG} />;
  if (carregandoConta) return <Abertura />;
  if (!usuario) return <Entrar />;
  if (!perfil) return <Abertura />;
  if (!perfil.boasVindasFeitas) return <BoasVindas />;

  let achada = ROTAS[0];
  let params: Record<string, string> = {};
  for (const r of ROTAS) {
    const p = casar(r.padrao, caminho);
    if (p) {
      achada = r;
      params = p;
      break;
    }
  }

  if (achada.semBarra) {
    return <Suspense fallback={<Abertura />}>{achada.tela(params)}</Suspense>;
  }

  return (
    <>
      <main className={`app${caminho === "/" ? " app-hoje" : ""}`}>
        {MODO_DEMO && caminho === "/" && (
          <div className="pilula atencao" style={{ marginBottom: 10 }}>
            Modo demonstração: dados de exemplo
          </div>
        )}
        <Suspense fallback={<Carregando />}>{achada.tela(params)}</Suspense>
      </main>
      <BarraInferior />
    </>
  );
}

export default function App() {
  return (
    <AvisosProvider>
      <EstadoProvider>
        <Conteudo />
      </EstadoProvider>
    </AvisosProvider>
  );
}
