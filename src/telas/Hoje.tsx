import { useMemo, type ReactNode } from "react";
import { dados, type Corrida, type Dia, type Medida, type Refeicao } from "@/dados";
import { useAgoraH, useEstado, useObservar } from "@/app/estado";
import { useRegistrarAgua } from "@/app/acoes";
import { Link, navegar } from "@/app/rota";
import { Esqueleto } from "@/componentes/basicos";
import { PulsoDoDia, type EventoDia } from "@/componentes/PulsoDoDia";
import { CardBalanca } from "@/componentes/Balanca";
import { Icone, type NomeIcone } from "@/componentes/Icone";
import { RotaSvg } from "@/componentes/Mapa";
import { chaveDia, dataPorExtenso, saudacao, somarDias } from "@/lib/datas";
import { formatarMl, ritmoDaAgua, sequenciaDeMeta } from "@/lib/agua";
import { milhar } from "@/lib/passos";
import { fracao, NOMES_REFEICAO, proximaRefeicao } from "@/lib/nutricao";
import { insightDoDia } from "@/lib/insights";
import { decodificarRota, formatarDuracao, formatarKm, formatarPace } from "@/lib/corrida";
import { nomeDaSemana, resumoDaSemana, semanaPadrao } from "@/lib/semana";

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
  const semana = useMemo(() => {
    if (!perfil || !dias || !medidas || !corridas) return null;
    const segunda = semanaPadrao(hoje, agoraH);
    return resumoDaSemana({ segunda, hoje, agoraH, dias, metas: perfil.metas, medidas, corridas });
  }, [perfil, dias, medidas, corridas, hoje, agoraH]);
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
    <div className="hoje">
      <header className="topo-hoje area-topo">
        <div>
          <p className="data-hoje">
            <span className="data-icone"><Icone nome="calendario" tamanho={16} /></span> {dataPorExtenso()}
          </p>
          <h1 className="saudacao">
            {saudacao()}
            {primeiroNome ? (
              <>
                ,{" "}
                <br />
                <span className="nome-grad">{primeiroNome}</span>
              </>
            ) : null}
          </h1>
          <Link para={insight.rota} className="frase-dia">
            {fraseDoDia(hoje)} <Icone nome="flecha" tamanho={18} />
          </Link>
        </div>
        <Link para="/perfil" className="avatar avatar-bolha" aria-label="Perfil e configurações">
          {iniciais}
          <i className="avatar-ponto" aria-hidden="true" />
        </Link>
      </header>

      <section className="card hero-dia area-hero" aria-label="Resumo do dia">
        <div className="hero-cabeca">
          <span className="selo-marca">
            <Icone nome="pulso" tamanho={24} strokeWidth={2.4} />
          </span>
          <span className="cresce">Seu pulso hoje</span>
          <span className="pilula vidro-pilula">
            <Icone nome="digital" tamanho={18} /> {eventos.length === 1 ? "1 registro" : `${eventos.length} registros`}
          </span>
        </div>
        <PulsoDoDia eventos={eventos} acordaH={perfil.acordaH} dormeH={perfil.dormeH} agoraH={agoraH} />
        <div className="metricas-dia">
          <Metrica
            cor="passos"
            icone="pegadas"
            nome="Passos"
            valor={milhar(passos)}
            meta={`de ${milhar(m.passos)}`}
            fracao={fracao(passos, m.passos)}
            onClick={() => navegar("/mover/passos")}
          />
          <Metrica
            cor="agua"
            icone="gota"
            nome="Água"
            valor={formatarMl(agua)}
            meta={`de ${formatarMl(m.aguaMl)}`}
            fracao={fracao(agua, m.aguaMl)}
            onClick={() => navegar("/agua")}
          />
          <Metrica
            cor="comida"
            icone="comer"
            nome={comidaCarbo ? "Carbo" : "Comida"}
            valor={comidaCarbo ? `${Math.round(comida)} g` : milhar(comida)}
            meta={comidaCarbo ? `de ${metaComida} g` : `de ${milhar(metaComida)} kcal`}
            fracao={fracao(comida, metaComida)}
            onClick={() => navegar("/comer")}
          />
        </div>
      </section>

      <Link para={insight.rota} className={`card card-toque cor-${insight.cor} area-lembrete`} style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <span className="selo-icone selo-lembrete">
          <Icone nome="gotaSol" tamanho={24} />
        </span>
        <span className="cresce lembrete">{destacarNumeros(insight.texto)}</span>
        <Icone nome="seta" tamanho={18} className="suave" />
      </Link>

      <section className="card cor-agua cartao-agua area-agua" style={{ marginTop: 14 }} aria-label="Água rápida">
        <Garrafa />
        <div className="card-cabeca">
          <span className="selo-icone cheio"><Icone nome="gota" tamanho={20} cheio /></span>
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

      <div className="area-balanca" style={{ marginTop: 12 }}>
        <CardBalanca medidas={medidas} />
      </div>

      <div className="area-proxima">
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

      </div>

      <div className="area-corrida">
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

      {semana && (
        <div className="area-semana">
          <p className="rotulo-secao">Sua semana</p>
          <Link para="/semana" className="card card-toque cor-pulso cartao-semana">
            <div className="linha">
              <span className="selo-icone"><Icone nome="grafico" tamanho={18} /></span>
              <span className="cresce">
                <b>{nomeDaSemana(semana.segunda)}</b>
                <br />
                <span className="legenda">
                  {semana.fechados === 0
                    ? "A semana começou agora: os números aparecem a partir de amanhã."
                    : `${semana.comida.diasDentro} de ${semana.fechados} dias no plano · ${milhar(semana.passos.media)} passos/dia`}
                </span>
              </span>
              <Icone nome="seta" tamanho={18} className="suave" />
            </div>
            <div className="semana-mini" aria-hidden="true">
              {semana.comida.porDia.map((p, i) => (
                <i key={semana.dias[i]} className={`dia-${p}`} />
              ))}
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

const FRASES = [
  "Disciplina hoje, resultados amanhã.",
  "Pequenos hábitos, grandes resultados.",
  "Cada gota conta.",
  "Um passo de cada vez.",
  "Constância vale mais que pressa.",
  "Seu corpo agradece o cuidado de hoje.",
  "Hoje é um bom dia para cuidar de você.",
];

/** Uma frase por dia, sempre a mesma no mesmo dia. */
function fraseDoDia(chave: string): string {
  const n = chave.split("-").reduce((s, p) => s + parseInt(p, 10), 0);
  return FRASES[n % FRASES.length];
}

/** Deixa os números do lembrete em negrito ("Faltam **900 ml** para..."). */
function destacarNumeros(texto: string): ReactNode[] {
  return texto.split(/(\d[\d.,]*\s?(?:ml|L|kcal|g|km|passos|min)?\b)/).map((parte, i) => (i % 2 === 1 ? <b key={i}>{parte}</b> : parte));
}

function Metrica({ cor, icone, nome, valor, meta, fracao, onClick }: { cor: string; icone: NomeIcone; nome: string; valor: string; meta: string; fracao: number; onClick: () => void }) {
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <button className={`metrica cor-${cor}`} onClick={onClick} aria-label={`${nome}: ${valor} ${meta}`}>
      <span className="metrica-nome">
        <span className="metrica-icone">
          <Icone nome={icone} tamanho={18} strokeWidth={icone === "comer" ? 2.6 : 1.4} cheio={icone !== "comer"} />
        </span>
        {nome}
      </span>
      <span className="metrica-valor">{valor}</span>
      <span className="metrica-barra">
        <span style={{ width: `${Math.max(f * 100, f > 0 ? 4 : 0)}%` }} />
      </span>
      <span className="metrica-meta">{meta}</span>
    </button>
  );
}

/** Garrafinha translúcida no canto do cartão de água (só enfeite). */
function Garrafa() {
  return (
    <svg className="garrafa" viewBox="0 0 120 150" aria-hidden="true">
      <defs>
        <linearGradient id="garrafa-corpo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#bfdbfe" stopOpacity="0.55" />
          <stop offset="1" stopColor="#93c5fd" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="garrafa-agua" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93c5fd" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="garrafa-folha" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#86efac" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <g transform="rotate(18 60 80)">
        <rect x="48" y="6" width="26" height="16" rx="4" fill="#334155" opacity="0.85" />
        <rect x="46" y="20" width="30" height="8" rx="3" fill="#475569" opacity="0.7" />
        <path d="M44 30h34c6 6 10 14 10 24v74a12 12 0 0 1-12 12H46a12 12 0 0 1-12-12V54c0-10 4-18 10-24z" fill="url(#garrafa-corpo)" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" />
        <path d="M34 92h54v36a12 12 0 0 1-12 12H46a12 12 0 0 1-12-12z" fill="url(#garrafa-agua)" />
        <path d="M42 46v70" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path d="M96 150c-4-26 4-46 22-58-2 24-8 42-22 58z" fill="url(#garrafa-folha)" opacity="0.9" />
    </svg>
  );
}
