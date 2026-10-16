import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { EstadoProvider, AvisosProvider, useAvisos, useEstado } from "@/app/estado";
import { casar, navegar, useCaminho } from "@/app/rota";
import { ERRO_CONFIG, MODO_DEMO } from "@/dados";
import { manterAvisos } from "@/lib/avisos";
import { limparDadosCopiados } from "@/dados/limpeza";
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
const Semana = lazy(() => import("@/telas/Semana"));
const Privacidade = lazy(() => import("@/telas/Privacidade"));

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
  { padrao: "/mover", tela: () => <Mover /> },
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
  { padrao: "/privacidade", tela: () => <Privacidade />, semBarra: true },
];

function Conteudo() {
  const { usuario, carregandoConta, perfil, plano } = useEstado();
  const avisar = useAvisos();
  const caminho = useCaminho();

  // Atalhos antigos ou digitados: /mover/... vai para /mover; qualquer
  // caminho desconhecido volta para o Hoje.
  const conhecido = ROTAS.some((r) => casar(r.padrao, caminho));

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

  // Contas criadas nas primeiras versões receberam dados de exemplo da dona
  // do app (plano, metas de comida, bioimpedância). Uma vez por conta, saem.
  const limpando = useRef(false);
  const precisaLimpar = Boolean(usuario && perfil?.boasVindasFeitas && !perfil.limpezaV1 && plano !== undefined && !MODO_DEMO);
  useEffect(() => {
    if (!precisaLimpar || limpando.current || !usuario || !perfil) return;
    limpando.current = true;
    void limparDadosCopiados(usuario, perfil, plano ?? null)
      .then((mexeu) => mexeu && avisar("Ajustamos sua conta: agora ela só tem os seus dados. Envie seu plano alimentar em Comer.", undefined, 8000))
      .catch((e) => {
        limpando.current = false;
        console.warn("Limpeza da conta:", e);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaLimpar]);

  useEffect(() => {
    // Endereços antigos das abas de Mover.
    if (caminho.startsWith("/mover/")) navegar("/mover", { substituir: true });
    else if (!conhecido) navegar("/", { substituir: true });
  }, [caminho, conhecido]);

  if (ERRO_CONFIG) return <Configurar erro={ERRO_CONFIG} />;
  if (carregandoConta) return <Abertura />;
  // A página de privacidade abre também sem login (link da tela de entrada).
  if (!usuario && caminho === "/privacidade") {
    return (
      <Suspense fallback={<Abertura />}>
        <Privacidade />
      </Suspense>
    );
  }
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
