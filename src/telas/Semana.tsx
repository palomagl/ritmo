import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dados, type Corrida, type Dia, type Medida } from "@/dados";
import { ia, ErroIA } from "@/ia";
import { useAgoraH, useEstado, useObservar } from "@/app/estado";
import { navegar } from "@/app/rota";
import { BarraMacro, Esqueleto, Topo } from "@/componentes/basicos";
import { GraficoBarras } from "@/componentes/Graficos";
import { Icone, type NomeIcone } from "@/componentes/Icone";
import { diaDaSemanaCurto, somarDias } from "@/lib/datas";
import { formatarMl } from "@/lib/agua";
import { milhar } from "@/lib/passos";
import { dec } from "@/lib/nutricao";
import {
  ajustesDaSemana,
  conquistasDaSemana,
  nomeDaSemana,
  resumoDaSemana,
  segundaDa,
  semanaPadrao,
  textoParaIA,
  type DiaComida,
  type Observacao,
} from "@/lib/semana";

const ICONE_COR: Record<Observacao["cor"], NomeIcone> = {
  passos: "pegadas",
  agua: "gota",
  comida: "comer",
  corpo: "balanca",
  pulso: "rota",
};

const ROTULO_COMIDA: Record<DiaComida, string> = {
  dentro: "Dentro do plano",
  acima: "Acima das calorias",
  pouco: "Registro pela metade",
  vazio: "Sem registro",
  hoje: "Hoje, ainda em andamento",
  futuro: "Ainda não chegou",
};

/** Dicas da IA guardadas por semana neste aparelho: não gasta a IA de novo. */
function lerDicas(segunda: string): string[] | null {
  try {
    const v = localStorage.getItem(`ritmo:semana-ia:${segunda}`);
    return v ? (JSON.parse(v) as string[]) : null;
  } catch {
    return null;
  }
}
function guardarDicas(segunda: string, dicas: string[]) {
  try {
    localStorage.setItem(`ritmo:semana-ia:${segunda}`, JSON.stringify(dicas));
  } catch {
    /* sem armazenamento: só nesta visita */
  }
}

export default function Semana() {
  const { perfil, plano, hoje } = useEstado();
  const agoraH = useAgoraH();
  const atual = semanaPadrao(hoje, agoraH);
  const [segunda, setSegunda] = useState(atual);
  const domingo = somarDias(segunda, 6);
  const dias = useObservar<Dia[]>((cb) => dados.observarDias(segunda, domingo, cb), [segunda]);
  const medidas = useObservar<Medida[]>((cb) => dados.observarMedidas(cb), []);
  const corridas = useObservar<Corrida[]>((cb) => dados.observarCorridas(cb), []);
  const [dicas, setDicas] = useState<string[] | null>(() => lerDicas(segunda));
  const [pensando, setPensando] = useState(false);
  const [erroIA, setErroIA] = useState<string | null>(null);

  useEffect(() => {
    setDicas(lerDicas(segunda));
    setErroIA(null);
  }, [segunda]);

  const r = useMemo(
    () => (perfil && dias && medidas && corridas ? resumoDaSemana({ segunda, hoje, agoraH, dias, metas: perfil.metas, medidas, corridas }) : null),
    [perfil, dias, medidas, corridas, segunda, hoje, agoraH]
  );

  if (!perfil) return null;
  const m = perfil.metas;
  const conquistas = r ? conquistasDaSemana(r, m) : [];
  const ajustes = r ? ajustesDaSemana(r, m) : [];
  const estaSemana = segundaDa(hoje);

  const pedirDicas = async () => {
    if (!r) return;
    setPensando(true);
    setErroIA(null);
    try {
      const d = await ia.analisarSemana(textoParaIA(r, m), plano ?? null, perfil.pontosDeAtencao);
      setDicas(d);
      guardarDicas(segunda, d);
    } catch (e) {
      setErroIA(e instanceof ErroIA ? e.message : "Não deu para analisar agora. Tente de novo em instantes.");
    } finally {
      setPensando(false);
    }
  };

  return (
    <div className="pilha semana">
      <Topo titulo="Sua semana" />

      <div className="semana-nav">
        <button className="botao-icone" onClick={() => setSegunda(somarDias(segunda, -7))} aria-label="Semana anterior">
          <Icone nome="voltar" tamanho={20} />
        </button>
        <div className="semana-nav-nome">
          <b>{nomeDaSemana(segunda)}</b>
          <span className="legenda">{segunda === estaSemana ? "Esta semana" : segunda === somarDias(estaSemana, -7) ? "Semana passada" : "\u00a0"}</span>
        </div>
        <button className="botao-icone" onClick={() => setSegunda(somarDias(segunda, 7))} aria-label="Próxima semana" disabled={segunda >= estaSemana}>
          <Icone nome="seta" tamanho={20} />
        </button>
      </div>

      {!r ? (
        <>
          <Esqueleto altura={190} raio={22} />
          <Esqueleto altura={150} raio={22} />
        </>
      ) : (
        <>
          <section className="semana-numeros" aria-label="Números da semana">
            <Numero
              cor="corpo"
              icone="balanca"
              nome="Peso"
              valor={r.peso.fim != null ? `${dec(r.peso.fim)} kg` : "—"}
              detalhe={
                r.peso.variacao != null ? (
                  <span className={`pilula ${r.peso.variacao <= 0 ? "bom" : "atencao"}`}>
                    {r.peso.variacao > 0 ? "+" : r.peso.variacao < 0 ? "−" : ""}
                    {dec(Math.abs(r.peso.variacao))} kg
                  </span>
                ) : r.peso.fim == null ? (
                  "sem pesagem"
                ) : (
                  "primeira pesagem"
                )
              }
            />
            <Numero cor="passos" icone="pegadas" nome="Passos" valor={milhar(r.passos.media)} detalhe={`por dia · ${r.passos.diasNaMeta} na meta`} />
            <Numero
              cor="comida"
              icone="comer"
              nome="Calorias"
              valor={`${r.comida.diasDentro} de ${Math.max(r.fechados, r.comida.diasDentro)}`}
              detalhe={`dias dentro das ${milhar(m.kcal)} kcal`}
            />
            <Numero cor="agua" icone="gota" nome="Água" valor={`${r.agua.diasNaMeta} de ${Math.max(r.fechados, r.agua.diasNaMeta)}`} detalhe={`dias na meta · ${formatarMl(r.agua.media)}/dia`} />
          </section>

          <section className="card cor-comida">
            <div className="linha entre" style={{ marginBottom: 12 }}>
              <p className="subtitulo">Comida dia a dia</p>
              {r.comida.mediaKcal > 0 && <span className="pilula cor num">média {milhar(r.comida.mediaKcal)} kcal</span>}
            </div>
            <div className="semana-dias">
              {r.dias.map((d, i) => {
                const estado = r.comida.porDia[i];
                return (
                  <div key={d} className={`semana-dia dia-${estado}`} title={`${ROTULO_COMIDA[estado]}${r.comida.kcal[i] ? `: ${milhar(r.comida.kcal[i])} kcal` : ""}`}>
                    <span className="legenda">{diaDaSemanaCurto(d)}</span>
                    <span className="semana-dia-bola" aria-label={ROTULO_COMIDA[estado]}>
                      {estado === "dentro" ? <Icone nome="check" tamanho={16} strokeWidth={2.6} /> : estado === "acima" ? "↑" : estado === "pouco" ? "…" : ""}
                    </span>
                    <span className="semana-dia-kcal num">{r.comida.kcal[i] > 0 ? milhar(r.comida.kcal[i]) : "–"}</span>
                  </div>
                );
              })}
            </div>
            <div className="semana-legenda">
              <span><i className="dia-dentro" /> dentro</span>
              <span><i className="dia-acima" /> acima</span>
              <span><i className="dia-pouco" /> registro incompleto</span>
            </div>
            {r.comida.mediaProteina > 0 && (
              <div style={{ marginTop: 14 }}>
                <BarraMacro nome="Proteína média por dia" atual={r.comida.mediaProteina} meta={m.proteinaG} cor="comida" />
              </div>
            )}
          </section>

          <div className="semana-graficos">
            <section className="card cor-passos">
              <div className="linha entre" style={{ marginBottom: 6 }}>
                <p className="subtitulo">Passos</p>
                {r.passos.melhor && <span className="legenda">melhor: {diaDaSemanaCurto(r.passos.melhor.dia)}, {milhar(r.passos.melhor.passos)}</span>}
              </div>
              <GraficoBarras dias={r.dias} valores={r.passos.valores} meta={m.passos} cor="passos" hoje={hoje} formatar={milhar} altura={140} />
            </section>
            <section className="card cor-agua">
              <div className="linha entre" style={{ marginBottom: 6 }}>
                <p className="subtitulo">Água</p>
                <span className="legenda">média {formatarMl(r.agua.media)}</span>
              </div>
              <GraficoBarras dias={r.dias} valores={r.agua.valores} meta={m.aguaMl} cor="agua" hoje={hoje} formatar={formatarMl} altura={140} />
            </section>
          </div>

          {r.corridas.n > 0 && (
            <button className="card card-toque linha cor-pulso" onClick={() => navegar("/mover/corridas")}>
              <span className="selo-icone"><Icone nome="rota" tamanho={18} /></span>
              <span className="cresce">
                <b>{r.corridas.n} {r.corridas.n === 1 ? "corrida ou caminhada" : "corridas e caminhadas"}</b>
                <br />
                <span className="legenda">{dec(r.corridas.km)} km na semana</span>
              </span>
              <Icone nome="seta" tamanho={18} className="suave" />
            </button>
          )}

          {conquistas.length > 0 && (
            <>
              <p className="rotulo-secao">O que foi bem</p>
              <Lista itens={conquistas} />
            </>
          )}

          <p className="rotulo-secao">O que dá pra ajustar</p>
          {r.fechados === 0 ? (
            <p className="suave" style={{ margin: "0 2px" }}>A semana acabou de começar. Volte em alguns dias para ver o resumo.</p>
          ) : ajustes.length > 0 ? (
            <Lista itens={ajustes} />
          ) : (
            <p className="suave" style={{ margin: "0 2px" }}>Nada importante para ajustar. Semana redonda: continue assim.</p>
          )}

          {r.fechados > 0 && (
            <section className="card cor-pulso dicas-ia">
              <div className="card-cabeca">
                <span className="selo-icone"><Icone nome="brilho" tamanho={18} /></span>
                <div className="cresce">
                  <b>Dicas da IA</b>
                  <p className="legenda" style={{ margin: 0 }}>Olhando a semana e o seu plano alimentar.</p>
                </div>
              </div>
              {dicas && dicas.length > 0 ? (
                <ul className="dicas-lista">
                  {dicas.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
              {erroIA && <p className="legenda" style={{ color: "var(--erro)", margin: "0 0 10px" }}>{erroIA}</p>}
              <button className={`botao ${dicas ? "texto" : "secundario"}`} onClick={pedirDicas} disabled={pensando}>
                <Icone nome={dicas ? "atualizar" : "brilho"} tamanho={18} /> {pensando ? "Pensando…" : dicas ? "Pedir de novo" : "Pedir dicas à IA"}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Numero({ cor, icone, nome, valor, detalhe }: { cor: string; icone: NomeIcone; nome: string; valor: string; detalhe: ReactNode }) {
  return (
    <div className={`card semana-numero cor-${cor}`}>
      <span className="metrica-nome">
        <span className="metrica-icone"><Icone nome={icone} tamanho={18} /></span>
        {nome}
      </span>
      <span className="semana-numero-valor num">{valor}</span>
      <span className="legenda">{detalhe}</span>
    </div>
  );
}

function Lista({ itens }: { itens: Observacao[] }) {
  return (
    <div className="pilha" style={{ gap: 10 }}>
      {itens.map((o) => (
        <div key={o.texto} className={`card linha observacao cor-${o.cor}`}>
          <span className="selo-icone"><Icone nome={ICONE_COR[o.cor]} tamanho={18} /></span>
          <span className="cresce">{o.texto}</span>
        </div>
      ))}
    </div>
  );
}
