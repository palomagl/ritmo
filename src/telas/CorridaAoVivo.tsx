// ==============================================
// Corrida ao vivo
// ==============================================
// Estados: preparando (esperando o GPS firmar) → contagem 3-2-1 → correndo
// ⇄ pausado → salvando. A corrida em andamento é salva no aparelho a cada
// poucos segundos: se o app fechar no meio, ao abrir ele oferece continuar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dados, MODO_DEMO } from "@/dados";
import { useAvisos, useEstado } from "@/app/estado";
import { navegar, voltar } from "@/app/rota";
import { Icone } from "@/componentes/Icone";
import { Mapa } from "@/componentes/Mapa";
import { Folha } from "@/componentes/basicos";
import { local, manterTelaAcesa, soltarTela } from "@/lib/aparelho";
import { rotaDeExemplo } from "@/dados/demo";
import {
  avaliarPonto,
  calcularParciais,
  codificarRota,
  distanciaTotal,
  formatarDuracao,
  formatarKm,
  formatarPace,
  kcalEstimada,
  paceMedio,
  paceRecente,
  simplificar,
  type Ponto,
} from "@/lib/corrida";

type Estado = "preparando" | "contagem" | "correndo" | "pausado" | "salvando";

interface Sessao {
  tipo: "corrida" | "caminhada";
  inicio: number;
  /** Tempo ativo acumulado até a última pausa (ms). */
  ativoMs: number;
  /** Quando retomou pela última vez (null = pausado). */
  retomouEm: number | null;
  seg: number;
  pontos: Ponto[];
}

const GUARDADA = "pulso:corrida-em-andamento";

/** De onde vêm as posições: o GPS de verdade ou, no modo demo, uma volta simulada. */
function ouvirPosicao(aoReceber: (p: { lat: number; lng: number; precisao: number; t: number }) => void, aoErrar: (msg: string) => void): () => void {
  if (MODO_DEMO) {
    const rota = rotaDeExemplo(Date.now(), 3, 1, 900); // ~2,9 m/s
    let i = 0;
    const id = setInterval(() => {
      const p = rota[i++ % rota.length];
      aoReceber({ lat: p.lat, lng: p.lng, precisao: 6, t: Date.now() });
    }, 1000);
    return () => clearInterval(id);
  }
  if (!("geolocation" in navigator)) {
    aoErrar("Este navegador não tem GPS.");
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => aoReceber({ lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy, t: pos.timestamp || Date.now() }),
    (erro) =>
      aoErrar(
        erro.code === erro.PERMISSION_DENIED
          ? "Sem permissão de localização. No iPhone: Ajustes → Privacidade → Serviços de Localização → Safari/Ritmo."
          : "GPS sem sinal. Vá para um lugar aberto."
      ),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

export default function CorridaAoVivo() {
  const { perfil } = useEstado();
  const avisar = useAvisos();
  const [estado, setEstado] = useState<Estado>("preparando");
  const [tipo, setTipo] = useState<"corrida" | "caminhada">("corrida");
  const [precisao, setPrecisao] = useState<number | null>(null);
  const [erroGps, setErroGps] = useState<string | null>(null);
  const [contagem, setContagem] = useState(3);
  const [agora, setAgora] = useState(Date.now());
  const [telaAcesa, setTelaAcesa] = useState<boolean | null>(null);
  const [guardada, setGuardada] = useState<Sessao | null>(() => local.ler<Sessao | null>(GUARDADA, null));
  const [segurando, setSegurando] = useState(false);
  const sessao = useRef<Sessao | null>(null);
  const [, forcar] = useState(0);
  const timerSegurar = useRef<ReturnType<typeof setTimeout> | null>(null);

  // GPS ligado o tempo todo nesta tela (para firmar antes de começar).
  useEffect(() => {
    return ouvirPosicao(
      (p) => {
        setErroGps(null);
        setPrecisao(p.precisao);
        const s = sessao.current;
        if (!s || s.retomouEm === null) return;
        const novo: Ponto = { lat: p.lat, lng: p.lng, t: p.t, seg: s.seg };
        const anterior = s.pontos[s.pontos.length - 1] ?? null;
        if (avaliarPonto(anterior, novo, p.precisao) === "aceito") {
          s.pontos.push(novo);
          forcar((n) => n + 1);
        }
      },
      (msg) => setErroGps(msg)
    );
  }, []);

  // Relógio da tela e salvamento contínuo no aparelho.
  useEffect(() => {
    if (estado !== "correndo" && estado !== "pausado") return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const salvar = setInterval(() => sessao.current && local.gravar(GUARDADA, sessao.current), 5000);
    return () => {
      clearInterval(relogio);
      clearInterval(salvar);
    };
  }, [estado]);

  // Tela acesa enquanto corre; o sistema solta ao sair do app, então pede de novo ao voltar.
  useEffect(() => {
    if (estado !== "correndo") return;
    void manterTelaAcesa().then(setTelaAcesa);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void manterTelaAcesa().then(setTelaAcesa);
      else if (sessao.current) local.gravar(GUARDADA, sessao.current);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [estado]);

  useEffect(() => () => void soltarTela(), []);

  // Contagem 3-2-1.
  useEffect(() => {
    if (estado !== "contagem") return;
    if (contagem === 0) {
      const t = Date.now();
      sessao.current = { tipo, inicio: t, ativoMs: 0, retomouEm: t, seg: 0, pontos: [] };
      local.gravar(GUARDADA, sessao.current);
      setEstado("correndo");
      return;
    }
    navigator.vibrate?.(60);
    const id = setTimeout(() => setContagem((c) => c - 1), 900);
    return () => clearTimeout(id);
  }, [estado, contagem, tipo]);

  const s = sessao.current;
  const ativoMs = s ? s.ativoMs + (s.retomouEm ? agora - s.retomouEm : 0) : 0;
  const pontos = s?.pontos ?? [];
  // A lista da sessão é mutável (cresce no lugar): copia a cada ponto novo
  // para o mapa e as contas perceberem a mudança.
  const pontosTela = useMemo(() => [...pontos], [pontos.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const distancia = useMemo(() => distanciaTotal(pontosTela), [pontosTela]);
  const paceAtual = paceRecente(pontosTela, agora);
  const paceMed = paceMedio(distancia, ativoMs / 1000);

  const pausar = () => {
    const x = sessao.current;
    if (!x || x.retomouEm === null) return;
    x.ativoMs += Date.now() - x.retomouEm;
    x.retomouEm = null;
    x.seg += 1;
    local.gravar(GUARDADA, x);
    void soltarTela();
    setEstado("pausado");
  };

  const retomar = () => {
    const x = sessao.current;
    if (!x) return;
    x.retomouEm = Date.now();
    local.gravar(GUARDADA, x);
    setEstado("correndo");
  };

  const finalizar = useCallback(async () => {
    const x = sessao.current;
    if (!x) return;
    if (x.retomouEm !== null) {
      x.ativoMs += Date.now() - x.retomouEm;
      x.retomouEm = null;
    }
    const dist = distanciaTotal(x.pontos);
    if (dist < 50) {
      local.apagar(GUARDADA);
      void soltarTela();
      avisar("Atividade muito curta: não salvei.");
      voltar("/mover/corridas");
      return;
    }
    setEstado("salvando");
    const dur = x.ativoMs / 1000;
    const id = await dados.salvarCorrida({
      tipo: x.tipo,
      inicio: x.inicio,
      fim: Date.now(),
      duracaoS: Math.round(dur),
      distanciaM: Math.round(dist),
      paceMedioSKm: Math.round(paceMedio(dist, dur)),
      parciais: calcularParciais(x.pontos),
      kcalEstimada: kcalEstimada(dist, perfil?.pesoKg ?? null, x.tipo),
      rota: codificarRota(simplificar(x.pontos, 4)),
      fonte: "gps",
    });
    local.apagar(GUARDADA);
    await soltarTela();
    navigator.vibrate?.([80, 60, 80]);
    navegar(`/corrida/${id}`, { substituir: true });
  }, [avisar, perfil?.pesoKg]);

  const comecarSegurar = () => {
    setSegurando(true);
    timerSegurar.current = setTimeout(() => {
      setSegurando(false);
      void finalizar();
    }, 1000);
  };
  const soltarSegurar = () => {
    setSegurando(false);
    if (timerSegurar.current) clearTimeout(timerSegurar.current);
  };

  const continuarGuardada = () => {
    if (!guardada) return;
    // Volta pausada: a pessoa decide quando retomar (o GPS pode ter mudado de lugar).
    sessao.current = { ...guardada, retomouEm: null, seg: guardada.seg + 1 };
    if (guardada.retomouEm) sessao.current.ativoMs += Math.max(0, Math.min(Date.now() - guardada.retomouEm, 10 * 60e3));
    setTipo(guardada.tipo);
    setGuardada(null);
    setEstado("pausado");
  };

  const gpsBom = precisao !== null && precisao <= 20;

  if (estado === "contagem") {
    return <div className="contagem" aria-live="assertive">{contagem || "Vai!"}</div>;
  }

  return (
    <div className="ao-vivo">
      <header className="topo" style={{ marginBottom: 6 }}>
        {estado === "preparando" ? (
          <button className="botao-icone liso" onClick={() => voltar("/mover/corridas")} aria-label="Voltar">
            <Icone nome="fechar" />
          </button>
        ) : (
          <span style={{ width: 44 }} />
        )}
        <h1 className="titulo" style={{ textAlign: "center" }}>
          {estado === "preparando" ? (tipo === "corrida" ? "Corrida" : "Caminhada") : estado === "pausado" ? "Pausado" : estado === "salvando" ? "Salvando…" : tipo === "corrida" ? "Correndo" : "Caminhando"}
        </h1>
        <span className={`pilula ${gpsBom ? "bom" : "atencao"}`} title="Precisão do GPS">
          <Icone nome="pino" tamanho={14} /> {precisao === null ? "GPS…" : `±${Math.round(precisao)} m`}
        </span>
      </header>

      {estado === "preparando" ? (
        <>
          <div className="segmentos" style={{ marginTop: 10 }}>
            <button className={`segmento${tipo === "corrida" ? " ativo" : ""}`} onClick={() => setTipo("corrida")}>Corrida</button>
            <button className={`segmento${tipo === "caminhada" ? " ativo" : ""}`} onClick={() => setTipo("caminhada")}>Caminhada</button>
          </div>
          <Mapa pontos={[]} altura={260} aoVivo />
          <div className="card" style={{ marginTop: 14 }}>
            {erroGps ? (
              <p style={{ margin: 0, color: "var(--erro)" }}>{erroGps}</p>
            ) : gpsBom ? (
              <p style={{ margin: 0 }}><b>GPS pronto.</b> A tela fica acesa durante a atividade; deixe o app aberto.</p>
            ) : (
              <p style={{ margin: 0 }}>
                <b>Procurando GPS…</b> <span className="suave">Em lugar aberto leva poucos segundos.</span>
              </p>
            )}
          </div>
          <div className="controles">
            <button
              className="controle"
              style={{ width: 96, height: 96 }}
              onClick={() => {
                setContagem(3);
                setEstado("contagem");
              }}
              disabled={!gpsBom && !erroGps}
              aria-label="Começar"
            >
              <Icone nome="play" cheio tamanho={34} />
            </button>
          </div>
          {!gpsBom && !erroGps && (
            <button className="botao texto" style={{ alignSelf: "center", marginTop: 8 }} onClick={() => { setContagem(3); setEstado("contagem"); }}>
              Começar mesmo assim
            </button>
          )}
        </>
      ) : (
        <>
          <div className="tempo" aria-label="Tempo">{formatarDuracao(ativoMs / 1000)}</div>
          <div className="grade-3" style={{ textAlign: "center", marginBottom: 14 }}>
            <div>
              <div className="num-medio">{formatarKm(distancia)}</div>
              <div className="legenda">km</div>
            </div>
            <div>
              <div className="num-medio">{formatarPace(estado === "correndo" ? paceAtual : null)}</div>
              <div className="legenda">pace atual</div>
            </div>
            <div>
              <div className="num-medio">{formatarPace(paceMed || null)}</div>
              <div className="legenda">pace médio</div>
            </div>
          </div>
          <Mapa pontos={pontosTela} altura={230} aoVivo />
          {telaAcesa === false && estado === "correndo" && (
            <p className="legenda" style={{ textAlign: "center", marginTop: 10 }}>
              Não consegui manter a tela acesa: deixe o app aberto e a tela ligada.
            </p>
          )}
          <div className="controles">
            {estado === "correndo" ? (
              <button className="controle" onClick={pausar} aria-label="Pausar">
                <Icone nome="pausa" tamanho={32} strokeWidth={3} />
              </button>
            ) : (
              <button className="controle" onClick={retomar} aria-label="Retomar" disabled={estado === "salvando"}>
                <Icone nome="play" cheio tamanho={32} />
              </button>
            )}
            <button
              className={`controle parar${segurando ? " segurando" : ""}`}
              onPointerDown={comecarSegurar}
              onPointerUp={soltarSegurar}
              onPointerLeave={soltarSegurar}
              onContextMenu={(e) => e.preventDefault()}
              disabled={estado === "salvando"}
              aria-label="Segure para finalizar"
            >
              <span className="carga" />
              <Icone nome="parar" cheio tamanho={28} />
            </button>
          </div>
          <p className="legenda" style={{ textAlign: "center", marginTop: 10 }}>Segure o ■ por 1 segundo para finalizar</p>
        </>
      )}

      <Folha aberta={guardada !== null && estado === "preparando"} aoFechar={() => {}} titulo="Continuar corrida?">
        {guardada && (
          <div className="pilha">
            <p className="suave" style={{ margin: 0 }}>
              Ficou uma {guardada.tipo} em andamento: {formatarKm(distanciaTotal(guardada.pontos))} km em {formatarDuracao(guardada.ativoMs / 1000)}.
            </p>
            <button className="botao cheio" onClick={continuarGuardada}>Continuar de onde parei</button>
            <button
              className="botao perigo cheio"
              onClick={() => {
                local.apagar(GUARDADA);
                setGuardada(null);
              }}
            >
              Descartar
            </button>
          </div>
        )}
      </Folha>
    </div>
  );
}
