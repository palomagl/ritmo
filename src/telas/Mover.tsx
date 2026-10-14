import { useMemo, useRef, useState } from "react";
import { dados, MODO_PESSOAL, type Corrida, type Dia } from "@/dados";
import { useAvisos, useEstado, useObservar } from "@/app/estado";
import { Link, navegar } from "@/app/rota";
import { Anel, Esqueleto, Folha, Vazio } from "@/componentes/basicos";
import { GraficoBarras } from "@/componentes/Graficos";
import { Icone } from "@/componentes/Icone";
import { dataCurta, horaMinuto, somarDias, ultimosDias, chaveDia, dataDaChave, diaDaSemanaCurto } from "@/lib/datas";
import { milhar, resumoPassos } from "@/lib/passos";
import { fracao } from "@/lib/nutricao";
import {
  adivinharTipo,
  calcularParciais,
  codificarRota,
  distanciaTotal,
  formatarDuracao,
  formatarKm,
  formatarPace,
  kcalEstimada,
  lerGpx,
  paceMedio,
  simplificar,
} from "@/lib/corrida";

export default function Mover({ aba }: { aba: "passos" | "corridas" }) {
  return (
    <div>
      <header className="topo">
        <h1 className="titulo">Mover</h1>
      </header>
      <div className="segmentos" role="tablist">
        <button role="tab" aria-selected={aba === "passos"} className={`segmento${aba === "passos" ? " ativo" : ""}`} onClick={() => navegar("/mover/passos", { substituir: true })}>
          Passos
        </button>
        <button role="tab" aria-selected={aba === "corridas"} className={`segmento${aba === "corridas" ? " ativo" : ""}`} onClick={() => navegar("/mover/corridas", { substituir: true })}>
          Corridas
        </button>
      </div>
      {aba === "passos" ? <Passos /> : <Corridas />}
    </div>
  );
}

// ----------------------------------------------
// Passos
// ----------------------------------------------

function Passos() {
  const { perfil, dia, hoje } = useEstado();
  const avisar = useAvisos();
  const [periodo, setPeriodo] = useState<7 | 30>(7);
  const dias = useObservar<Dia[]>((cb) => dados.observarDias(somarDias(hoje, -60), hoje, cb), [hoje]);
  const [corrigindo, setCorrigindo] = useState(false);
  const [diaCorrecao, setDiaCorrecao] = useState(hoje);
  const [valorCorrecao, setValorCorrecao] = useState("");

  if (!perfil || !dia || !dias) {
    return (
      <div className="pilha">
        <Esqueleto altura={170} raio={22} />
        <Esqueleto altura={200} raio={22} />
      </div>
    );
  }

  const meta = perfil.metas.passos;
  const passos = dia.passos ?? 0;
  const lista = ultimosDias(periodo, hoje);
  const porId = new Map(dias.map((d) => [d.id, d]));
  const resumo = resumoPassos(lista, dias, meta, hoje);
  const nuncaSincronizou = !dias.some((d) => d.passosSyncEm);

  const salvarCorrecao = async () => {
    const n = parseInt(valorCorrecao.replace(/\D/g, ""), 10);
    if (!Number.isFinite(n)) return;
    await dados.definirPassos(diaCorrecao, n);
    setCorrigindo(false);
    avisar(`Passos de ${diaCorrecao === hoje ? "hoje" : dataCurta(diaCorrecao)} atualizados`);
  };

  return (
    <div className="pilha">
      <section className="card cor-passos linha" style={{ gap: 18 }}>
        <Anel cor="passos" fracao={fracao(passos, meta)} valor={`${Math.round(fracao(passos, meta) * 100)}%`} meta="da meta" tamanho={104} espessura={11} />
        <div className="cresce">
          <div className="num-grande">{milhar(passos)}</div>
          <div className="legenda">passos hoje · meta {milhar(meta)}</div>
          <div className="legenda" style={{ marginTop: 6 }}>
            {dia.passosSyncEm ? `${MODO_PESSOAL ? "Anotado" : "Sincronizado"} às ${horaMinuto(dia.passosSyncEm)}` : MODO_PESSOAL ? "Ainda não anotado hoje" : "Ainda não sincronizou hoje"}
          </div>
        </div>
      </section>

      {MODO_PESSOAL ? (
        <button
          className="card card-toque cor-passos linha"
          onClick={() => {
            setDiaCorrecao(hoje);
            setValorCorrecao(String(dia.passos ?? ""));
            setCorrigindo(true);
          }}
        >
          <span className="selo-icone"><Icone nome="pegadas" tamanho={18} /></span>
          <span className="cresce">
            <b>Anotar os passos de hoje</b>
            <br />
            <span className="legenda">Copie o número do app Saúde. Quando o app for publicado, um Atalho do iPhone faz isso sozinho.</span>
          </span>
        </button>
      ) : nuncaSincronizou && (
        <Link para="/perfil" className="card card-toque cor-passos linha">
          <span className="selo-icone"><Icone nome="atualizar" tamanho={18} /></span>
          <span className="cresce">
            <b>Ligue os passos do iPhone</b>
            <br />
            <span className="legenda">Um Atalho manda o total do app Saúde para cá. Passo a passo no Perfil.</span>
          </span>
        </Link>
      )}

      <section className="card">
        <div className="linha entre" style={{ marginBottom: 12 }}>
          <p className="subtitulo">{periodo === 7 ? "Última semana" : "Últimos 30 dias"}</p>
          <div className="segmentos" style={{ margin: 0, width: 120 }}>
            <button className={`segmento${periodo === 7 ? " ativo" : ""}`} onClick={() => setPeriodo(7)}>7d</button>
            <button className={`segmento${periodo === 30 ? " ativo" : ""}`} onClick={() => setPeriodo(30)}>30d</button>
          </div>
        </div>
        <GraficoBarras dias={lista} valores={lista.map((d) => porId.get(d)?.passos ?? 0)} meta={meta} cor="passos" hoje={hoje} formatar={milhar} />
      </section>

      <div className="grade-2">
        <div className="card">
          <div className="legenda">Média por dia</div>
          <div className="num-medio">{milhar(resumo.media)}</div>
        </div>
        <div className="card">
          <div className="legenda">Melhor dia</div>
          <div className="num-medio">{resumo.melhor ? milhar(resumo.melhor.passos) : "–"}</div>
          {resumo.melhor && <div className="legenda">{resumo.melhor.dia === hoje ? "hoje" : `${diaDaSemanaCurto(resumo.melhor.dia)}, ${dataCurta(resumo.melhor.dia)}`}</div>}
        </div>
        <div className="card">
          <div className="legenda">Sequência na meta</div>
          <div className="num-medio">
            {resumo.sequencia} <span className="legenda">{resumo.sequencia === 1 ? "dia" : "dias"}</span>
          </div>
        </div>
        <div className="card">
          <div className="legenda">Dias na meta</div>
          <div className="num-medio">
            {resumo.diasNaMeta}
            <span className="legenda"> de {periodo}</span>
          </div>
        </div>
      </div>

      <button
        className="botao contorno"
        onClick={() => {
          setDiaCorrecao(hoje);
          setValorCorrecao(String(passos || ""));
          setCorrigindo(true);
        }}
      >
        <Icone nome="lapis" tamanho={18} /> Corrigir passos de um dia
      </button>

      <Folha aberta={corrigindo} aoFechar={() => setCorrigindo(false)} titulo="Corrigir passos">
        <div className="pilha">
          <div className="campo">
            <label htmlFor="dia-passos">Dia</label>
            <input
              id="dia-passos"
              className="entrada"
              type="date"
              max={hoje}
              value={diaCorrecao}
              onChange={(e) => {
                setDiaCorrecao(e.target.value);
                setValorCorrecao(String(porId.get(e.target.value)?.passos ?? ""));
              }}
            />
          </div>
          <div className="campo">
            <label htmlFor="valor-passos">Passos</label>
            <input id="valor-passos" className="entrada num" inputMode="numeric" value={valorCorrecao} onChange={(e) => setValorCorrecao(e.target.value)} autoFocus />
          </div>
          <button className="botao cheio" onClick={salvarCorrecao}>Salvar</button>
        </div>
      </Folha>
    </div>
  );
}

// ----------------------------------------------
// Corridas
// ----------------------------------------------

function Corridas() {
  const { perfil } = useEstado();
  const avisar = useAvisos();
  const corridas = useObservar<Corrida[]>((cb) => dados.observarCorridas(cb), []);
  const arquivo = useRef<HTMLInputElement>(null);

  const semana = useMemo(() => {
    const desde = dataDaChave(somarDias(chaveDia(), -6)).getTime();
    const daSemana = (corridas ?? []).filter((c) => c.inicio >= desde);
    return {
      km: daSemana.reduce((s, c) => s + c.distanciaM, 0),
      tempo: daSemana.reduce((s, c) => s + c.duracaoS, 0),
      n: daSemana.length,
    };
  }, [corridas]);

  const recordes = useMemo(() => {
    const lista = corridas ?? [];
    const maior = lista.reduce<Corrida | null>((m, c) => (!m || c.distanciaM > m.distanciaM ? c : m), null);
    // 5 km mais rápido: soma dos 5 primeiros km fechados.
    let melhor5: { s: number; id: string } | null = null;
    for (const c of lista) {
      const fechados = c.parciais.filter((p) => Number.isInteger(p.km));
      if (fechados.length >= 5) {
        const s = fechados.slice(0, 5).reduce((t, p) => t + p.duracaoS, 0);
        if (!melhor5 || s < melhor5.s) melhor5 = { s, id: c.id };
      }
    }
    return { maior, melhor5 };
  }, [corridas]);

  const importarGpx = async (f: File) => {
    try {
      const pontos = lerGpx(await f.text());
      if (pontos.length < 2) {
        avisar("Esse arquivo não tem uma rota que eu consiga ler.");
        return;
      }
      const dist = distanciaTotal(pontos);
      const dur = (pontos[pontos.length - 1].t - pontos[0].t) / 1000;
      const pace = paceMedio(dist, dur);
      const tipo = adivinharTipo(pace);
      const id = await dados.salvarCorrida({
        tipo,
        inicio: pontos[0].t,
        fim: pontos[pontos.length - 1].t,
        duracaoS: Math.round(dur),
        distanciaM: Math.round(dist),
        paceMedioSKm: Math.round(pace),
        parciais: calcularParciais(pontos),
        kcalEstimada: kcalEstimada(dist, perfil?.pesoKg ?? null, tipo),
        rota: codificarRota(simplificar(pontos, 4)),
        fonte: "gpx",
      });
      avisar(`${tipo === "corrida" ? "Corrida" : "Caminhada"} de ${formatarKm(dist)} km importada`);
      navegar(`/corrida/${id}`);
    } catch (e) {
      console.error(e);
      avisar("Não consegui ler esse arquivo GPX.");
    }
  };

  return (
    <div className="pilha">
      <section className="card cor-pulso">
        <p className="legenda" style={{ margin: "0 0 8px" }}>Últimos 7 dias</p>
        <div className="grade-3">
          <div>
            <div className="num-medio">{formatarKm(semana.km, 1)}</div>
            <div className="legenda">km</div>
          </div>
          <div>
            <div className="num-medio">{formatarDuracao(semana.tempo)}</div>
            <div className="legenda">tempo</div>
          </div>
          <div>
            <div className="num-medio">{semana.n}</div>
            <div className="legenda">{semana.n === 1 ? "atividade" : "atividades"}</div>
          </div>
        </div>
      </section>

      <button className="botao marca cheio" style={{ minHeight: 56, fontSize: 17 }} onClick={() => navegar("/corrida/ao-vivo")}>
        <Icone nome="play" cheio tamanho={20} /> Iniciar corrida
      </button>
      <button className="botao contorno" onClick={() => arquivo.current?.click()}>
        <Icone nome="enviar" tamanho={18} /> Importar arquivo GPX
      </button>
      <input
        ref={arquivo}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importarGpx(f);
          e.target.value = "";
        }}
      />

      {(recordes.maior || recordes.melhor5) && (
        <div className="grade-2">
          {recordes.maior && (
            <Link para={`/corrida/${recordes.maior.id}`} className="card card-toque">
              <div className="legenda">Maior distância</div>
              <div className="num-medio">{formatarKm(recordes.maior.distanciaM)}</div>
              <div className="legenda">km</div>
            </Link>
          )}
          {recordes.melhor5 && (
            <Link para={`/corrida/${recordes.melhor5.id}`} className="card card-toque">
              <div className="legenda">5 km mais rápido</div>
              <div className="num-medio">{formatarDuracao(recordes.melhor5.s)}</div>
              <div className="legenda">recorde</div>
            </Link>
          )}
        </div>
      )}

      <p className="rotulo-secao" style={{ marginTop: 12 }}>Histórico</p>
      {corridas === undefined ? (
        <Esqueleto altura={140} raio={22} />
      ) : corridas.length === 0 ? (
        <div className="card">
          <Vazio icone="rota" cor="pulso" titulo="Nenhuma corrida ainda" texto="Toque em Iniciar corrida e o GPS faz o resto. Caminhadas também contam." />
        </div>
      ) : (
        <div className="card lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {corridas.map((c) => (
            <Link key={c.id} para={`/corrida/${c.id}`} className="item-lista">
              <span className="selo-icone cor-pulso"><Icone nome={c.tipo === "corrida" ? "rota" : "pegadas"} tamanho={18} /></span>
              <span className="cresce">
                <b>{formatarKm(c.distanciaM)} km</b> <span className="suave">· {c.tipo === "corrida" ? "Corrida" : "Caminhada"}</span>
                <br />
                <span className="legenda">
                  {diaDaSemanaCurto(chaveDia(new Date(c.inicio)))}, {dataCurta(chaveDia(new Date(c.inicio)))} · {formatarDuracao(c.duracaoS)} · {formatarPace(c.paceMedioSKm)}/km
                </span>
              </span>
              <Icone nome="seta" tamanho={18} className="suave" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
