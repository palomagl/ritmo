import { useMemo } from "react";
import { dados, type Corrida, type Dia, type Medida, type Refeicao } from "@/dados";
import { useAgoraH, useEstado, useObservar } from "@/app/estado";
import { useRegistrarAgua } from "@/app/acoes";
import { Link, navegar } from "@/app/rota";
import { Esqueleto } from "@/componentes/basicos";
import { PulsoDoDia, type EventoDia } from "@/componentes/PulsoDoDia";
import { CardBalanca } from "@/componentes/Balanca";
import { Icone } from "@/componentes/Icone";
import { RotaSvg } from "@/componentes/Mapa";
import { chaveDia, dataPorExtenso, saudacao, somarDias } from "@/lib/datas";
import { formatarMl, ritmoDaAgua, sequenciaDeMeta } from "@/lib/agua";
import { milhar } from "@/lib/passos";
import { fracao, NOMES_REFEICAO, proximaRefeicao } from "@/lib/nutricao";
import { insightDoDia } from "@/lib/insights";
import { decodificarRota, formatarDuracao, formatarKm, formatarPace } from "@/lib/corrida";

export default function Hoje() {
  const { perfil, dia, plano, hoje, usuario } = useEstado();
  const agoraH = useAgoraH();
  const registrarAgua = useRegistrarAgua();
  const refeicoes = useObservar<Refeicao[]>((cb) => dados.observarRefeicoes(hoje, cb), [hoje]);
  const dias = useObservar<Dia[]>((cb) => dados.observarDias(somarDias(hoje, -30), hoje, cb), [hoje]);
  const corridas = useObservar<Corrida[]>((cb) => dados.observarCorridas(cb), []);
  const medidas = useObservar<Medida[]>((cb) => dados.observarMedidas(cb), []);
  const ultima = corridas?.[0];
  const rotaUltima = useMemo(() => (ultima ? decodificarRota(ultima.rota) : []), [ultima]);
  const eventos = useMemo<EventoDia[]>(() => {
    const hora = (ms: number) => {
      const d = new Date(ms);
      return d.getHours() + d.getMinutes() / 60;
    };
    return [
      ...(dia?.aguaRegistros ?? []).map((r) => ({ h: hora(r.em), tipo: "agua" as const })),
      ...(refeicoes ?? []).map((r) => ({ h: hora(r.em), tipo: "comida" as const })),
      ...(corridas ?? []).filter((c) => chaveDia(new Date(c.inicio)) === hoje).map((c) => ({ h: hora(c.inicio), tipo: "corrida" as const })),
    ];
  }, [dia, refeicoes, corridas, hoje]);

  if (!perfil || !dia) {
    return (
      <div className="pilha">
        <Esqueleto altura={60} />
        <Esqueleto altura={170} raio={22} />
        <Esqueleto altura={90} raio={22} />
      </div>
    );
  }

  const m = perfil.metas;
  const passos = dia.passos ?? 0;
  const agua = dia.aguaMl ?? 0;
  const comidaCarbo = perfil.anelComida === "carbo";
  const comida = comidaCarbo ? dia.carboG ?? 0 : dia.kcal ?? 0;
  const metaComida = comidaCarbo ? m.carboG : m.kcal;
  const ritmo = ritmoDaAgua(agua, m.aguaMl, agoraH, perfil.acordaH, perfil.dormeH);
  const seqAgua = dias ? sequenciaDeMeta(dias, hoje, (d) => (d.aguaMl ?? 0) >= m.aguaMl) : 0;
  const insight = insightDoDia({
    dia,
    metas: m,
    refeicoes: refeicoes ?? [],
    sequenciaAgua: seqAgua,
    agoraH,
    acordaH: perfil.acordaH,
    dormeH: perfil.dormeH,
  });
  const proxima = proximaRefeicao(plano ?? null, Math.round(agoraH * 60));
  const primeiroNome = (perfil.nome || usuario?.nome || "").split(" ")[0];
  const iniciais = primeiroNome.slice(0, 1).toUpperCase() || "P";

  return (
    <div>
      <header className="topo-hoje">
        <div>
          <p className="legenda" style={{ margin: 0 }}>{dataPorExtenso()}</p>
          <h1 className="titulo">
            {saudacao()}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
        </div>
        <Link para="/perfil" className="avatar" aria-label="Perfil e configurações">
          {perfil.foto || usuario?.foto ? <img src={(perfil.foto || usuario?.foto)!} alt="" referrerPolicy="no-referrer" /> : iniciais}
        </Link>
      </header>

      <section className="card hero-dia" aria-label="Resumo do dia">
        <div className="hero-cabeca">
          <span>Seu ritmo hoje</span>
          <span className="legenda">{eventos.length === 1 ? "1 registro" : `${eventos.length} registros`}</span>
        </div>
        <PulsoDoDia eventos={eventos} acordaH={perfil.acordaH} dormeH={perfil.dormeH} agoraH={agoraH} />
        <div className="metricas-dia">
          <Metrica
            cor="passos"
            nome="Passos"
            valor={milhar(passos)}
            meta={`de ${milhar(m.passos)}`}
            fracao={fracao(passos, m.passos)}
            onClick={() => navegar("/mover/passos")}
          />
          <Metrica
            cor="agua"
            nome="Água"
            valor={formatarMl(agua)}
            meta={`de ${formatarMl(m.aguaMl)}`}
            fracao={fracao(agua, m.aguaMl)}
            onClick={() => navegar("/agua")}
          />
          <Metrica
            cor="comida"
            nome={comidaCarbo ? "Carbo" : "Comida"}
            valor={comidaCarbo ? `${Math.round(comida)} g` : milhar(comida)}
            meta={comidaCarbo ? `de ${metaComida} g` : `de ${milhar(metaComida)} kcal`}
            fracao={fracao(comida, metaComida)}
            onClick={() => navegar("/comer")}
          />
        </div>
      </section>

      <Link para={insight.rota} className={`card card-toque cor-${insight.cor}`} style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <span className="selo-icone">
          <Icone nome="brilho" tamanho={18} />
        </span>
        <span className="cresce" style={{ fontWeight: 500 }}>{insight.texto}</span>
        <Icone nome="seta" tamanho={18} className="suave" />
      </Link>

      <section className="card cor-agua" style={{ marginTop: 12 }} aria-label="Água rápida">
        <div className="card-cabeca">
          <span className="selo-icone"><Icone nome="gota" tamanho={18} /></span>
          <div className="cresce">
            <p className="subtitulo">Água</p>
            <p className="legenda" style={{ margin: 0 }}>
              {agua >= m.aguaMl ? "Meta batida hoje" : ritmo.noRitmo ? "No ritmo do dia" : `${formatarMl(ritmo.faltaParaRitmoMl)} atrás do ritmo`}
            </p>
          </div>
        </div>
        <div className="botoes-agua">
          {perfil.copos.slice(0, 3).map((ml) => (
            <button key={ml} className="botao-agua" onClick={() => registrarAgua(ml)}>
              +{ml}
              <small>ml</small>
            </button>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 12 }}>
        <CardBalanca medidas={medidas} />
      </div>

      <p className="rotulo-secao">Próxima refeição do plano</p>
      {proxima ? (
        <Link para="/comer" className="card card-toque cor-comida">
          <div className="linha entre" style={{ marginBottom: 8 }}>
            <span className="subtitulo">{NOMES_REFEICAO[proxima.tipo]}</span>
            <span className="pilula cor num">
              <Icone nome="relogio" tamanho={14} /> {proxima.horario}
            </span>
          </div>
          <p className="suave" style={{ margin: 0 }}>{proxima.opcoes[0]?.descricao}</p>
          {proxima.opcoes.length > 1 && <p className="legenda" style={{ margin: "6px 0 0" }}>+{proxima.opcoes.length - 1} opção no plano</p>}
        </Link>
      ) : (
        <Link para="/comer/plano" className="card card-toque cor-comida linha">
          <span className="selo-icone"><Icone nome="enviar" tamanho={18} /></span>
          <span className="cresce">
            <b>Envie seu plano alimentar</b>
            <br />
            <span className="legenda">A IA organiza as refeições e compara cada prato.</span>
          </span>
        </Link>
      )}

      <p className="rotulo-secao">Última corrida</p>
      {ultima ? (
        <Link para={`/corrida/${ultima.id}`} className="card card-toque" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ position: "relative", height: 120, background: "var(--card-2)" }}>
            <RotaSvg pontos={rotaUltima} altura={120} />
          </div>
          <div className="grade-3" style={{ padding: 16 }}>
            <div>
              <div className="num-medio" style={{ fontSize: 22 }}>{formatarKm(ultima.distanciaM)}</div>
              <div className="legenda">km</div>
            </div>
            <div>
              <div className="num-medio" style={{ fontSize: 22 }}>{formatarPace(ultima.paceMedioSKm)}</div>
              <div className="legenda">/km</div>
            </div>
            <div>
              <div className="num-medio" style={{ fontSize: 22 }}>{formatarDuracao(ultima.duracaoS)}</div>
              <div className="legenda">tempo</div>
            </div>
          </div>
        </Link>
      ) : corridas === undefined ? (
        <Esqueleto altura={110} raio={22} />
      ) : (
        <Link para="/corrida/ao-vivo" className="card card-toque cor-pulso linha">
          <span className="selo-icone"><Icone nome="rota" tamanho={18} /></span>
          <span className="cresce">
            <b>Sua primeira corrida</b>
            <br />
            <span className="legenda">Dois toques e o GPS começa a contar.</span>
          </span>
        </Link>
      )}
    </div>
  );
}

function Metrica({ cor, nome, valor, meta, fracao, onClick }: { cor: string; nome: string; valor: string; meta: string; fracao: number; onClick: () => void }) {
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <button className={`metrica cor-${cor}`} onClick={onClick} aria-label={`${nome}: ${valor} ${meta}`}>
      <span className="metrica-nome">
        <i className="ponto" /> {nome}
      </span>
      <span className="metrica-valor">{valor}</span>
      <span className="metrica-barra">
        <span style={{ width: `${Math.max(f * 100, f > 0 ? 4 : 0)}%` }} />
      </span>
      <span className="metrica-meta">{meta}</span>
    </button>
  );
}
