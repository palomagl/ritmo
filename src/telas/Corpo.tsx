import { useEffect, useRef, useState } from "react";
import { dados, type Dia, type Medida, type Metas } from "@/dados";
import { ia, ErroIA } from "@/ia";
import { useAvisos, useEstado, useObservar } from "@/app/estado";
import { Esqueleto, Folha, Vazio } from "@/componentes/basicos";
import { GraficoLinha } from "@/componentes/Graficos";
import { Icone } from "@/componentes/Icone";
import { CardBalanca } from "@/componentes/Balanca";
import { CAMPOS_MEDIDA, metaDoCampo, pontosDeAtencao, rumoAMeta, serie, ultimoEVariacao, type CampoMedida } from "@/lib/corpo";
import { dataCurta, somarDias, ultimosDias } from "@/lib/datas";
import { arquivoParaBase64, reduzirParaBase64 } from "@/lib/aparelho";

const fmt = (n: number, casas = 1) => n.toFixed(casas).replace(".", ",");
const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function Corpo() {
  const { perfil, hoje } = useEstado();
  const avisar = useAvisos();
  const medidas = useObservar<Medida[]>((cb) => dados.observarMedidas(cb), []);
  const dias = useObservar<Dia[]>((cb) => dados.observarDias(somarDias(hoje, -6), hoje, cb), [hoje]);
  const [campo, setCampo] = useState<CampoMedida>("pesoKg");
  const [registrando, setRegistrando] = useState(() => new URLSearchParams(window.location.search).get("registrar") === "1");
  const [editandoMetas, setEditandoMetas] = useState(false);

  // Recalcula os pontos de atenção quando medidas, metas ou água mudam.
  const ultimaAssinatura = useRef("");
  useEffect(() => {
    if (!perfil || !medidas || !dias) return;
    const semana = ultimosDias(7, hoje).filter((d) => d !== hoje);
    const porId = new Map(dias.map((d) => [d.id, d.aguaMl ?? 0]));
    const comDado = semana.filter((d) => porId.has(d));
    const media = comDado.length >= 3 ? comDado.reduce((s, d) => s + (porId.get(d) ?? 0), 0) / comDado.length : null;
    const pontos = pontosDeAtencao(medidas, perfil.metas, media);
    const assinatura = JSON.stringify(pontos);
    if (assinatura !== JSON.stringify(perfil.pontosDeAtencao) && assinatura !== ultimaAssinatura.current) {
      ultimaAssinatura.current = assinatura;
      void dados.salvarPerfil({ pontosDeAtencao: pontos });
    }
  }, [perfil, medidas, dias, hoje]);

  if (!perfil || !medidas) {
    return (
      <div className="pilha">
        <Esqueleto altura={44} />
        <Esqueleto altura={200} raio={22} />
      </div>
    );
  }

  const info = CAMPOS_MEDIDA.find((c) => c.campo === campo)!;
  const pontos = serie(medidas, campo);

  return (
    <div className="pilha">
      <header className="topo" style={{ marginBottom: 6 }}>
        <h1 className="titulo">Corpo</h1>
        <button className="botao-icone" aria-label="Metas do corpo" onClick={() => setEditandoMetas(true)}>
          <Icone nome="engrenagem" />
        </button>
      </header>

      <CardBalanca medidas={medidas} />

      {medidas.length === 0 ? (
        <div className="card">
          <Vazio
            icone="balanca"
            cor="corpo"
            titulo="Nenhuma medida ainda"
            texto="Registre peso, gordura e água corporal (da bioimpedância) para ver a evolução."
            acao={<button className="botao cor cor-corpo" onClick={() => setRegistrando(true)}>Registrar medida</button>}
          />
        </div>
      ) : (
        <>
          <div className="grade-2">
            {CAMPOS_MEDIDA.map((c) => {
              const u = ultimoEVariacao(medidas, c.campo);
              if (!u) return null;
              const meta = metaDoCampo(perfil.metas, c.campo);
              const rumo = rumoAMeta(u.valor, u.variacao, meta);
              const ativo = c.campo === campo;
              return (
                <button
                  key={c.campo}
                  className="card card-toque cor-corpo"
                  onClick={() => setCampo(c.campo)}
                  aria-pressed={ativo}
                  style={{ borderColor: ativo ? "var(--corpo)" : undefined, borderWidth: ativo ? 1.5 : undefined }}
                >
                  <div className="legenda">{c.nome}</div>
                  <div className="num-medio">
                    {fmt(u.valor, c.casas)}
                    <span className="legenda"> {c.unidade}</span>
                  </div>
                  <div className="legenda num" style={{ color: rumo === true ? "var(--passos)" : undefined, fontWeight: 600 }}>
                    {u.variacao === null ? "primeira medida" : `${u.variacao > 0 ? "▲" : u.variacao < 0 ? "▼" : "="} ${fmt(Math.abs(u.variacao), c.casas)} ${c.unidade}`}
                    {meta ? <span className="suave" style={{ fontWeight: 500 }}> · meta {fmt(meta, c.casas)}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <section className="card">
            <p className="subtitulo" style={{ marginBottom: 10 }}>{info.nome}</p>
            {pontos.length > 0 ? (
              <GraficoLinha pontos={pontos} meta={metaDoCampo(perfil.metas, campo)} cor="corpo" unidade={info.unidade} />
            ) : (
              <p className="legenda" style={{ margin: 0 }}>Sem registros de {info.nome.toLowerCase()} ainda.</p>
            )}
          </section>
        </>
      )}

      {perfil.pontosDeAtencao.length > 0 && (
        <section className="card cor-comida">
          <div className="card-cabeca">
            <span className="selo-icone"><Icone nome="brilho" tamanho={18} /></span>
            <p className="subtitulo">Pontos de atenção</p>
          </div>
          {perfil.pontosDeAtencao.map((p) => (
            <p key={p} style={{ margin: "4px 0" }}>• {p.charAt(0).toUpperCase() + p.slice(1)}</p>
          ))}
          <p className="legenda" style={{ margin: "8px 0 0" }}>A IA da alimentação leva isso em conta nas dicas.</p>
        </section>
      )}

      <button className="botao cor cor-corpo" style={{ minHeight: 52 }} onClick={() => setRegistrando(true)}>
        <Icone nome="mais" /> Registrar medida
      </button>

      {medidas.length > 0 && (
        <>
          <p className="rotulo-secao">Histórico</p>
          <section className="card lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {[...medidas].reverse().map((m) => (
              <div key={m.id} className="item-lista">
                <span className="cresce">
                  <b>{dataCurta(m.data)}</b> {m.fonte === "laudo" && <span className="pilula" style={{ marginLeft: 6 }}>laudo</span>}
                  <br />
                  <span className="legenda num">
                    {[m.pesoKg && `${fmt(m.pesoKg)} kg`, m.gorduraPct && `gordura ${fmt(m.gorduraPct)}%`, m.aguaPct && `água ${fmt(m.aguaPct)}%`, m.musculoPct && `músculo ${fmt(m.musculoPct)}%`, m.cinturaCm && `cintura ${m.cinturaCm} cm`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button className="botao-icone liso" style={{ width: 32, height: 32 }} aria-label="Excluir medida" onClick={() => { void dados.excluirMedida(m.id); avisar("Medida excluída"); }}>
                  <Icone nome="lixo" tamanho={16} />
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      <RegistrarMedida aberto={registrando} aoFechar={() => setRegistrando(false)} hoje={hoje} pesoAtual={perfil.pesoKg} />
      <MetasCorpo aberto={editandoMetas} aoFechar={() => setEditandoMetas(false)} metas={perfil.metas} />
    </div>
  );
}

function RegistrarMedida({ aberto, aoFechar, hoje, pesoAtual }: { aberto: boolean; aoFechar: () => void; hoje: string; pesoAtual: number | null }) {
  const avisar = useAvisos();
  const vazio = { data: hoje, pesoKg: "", gorduraPct: "", musculoPct: "", aguaPct: "", cinturaCm: "" };
  const [v, setV] = useState(vazio);
  const [fonte, setFonte] = useState<"manual" | "laudo">("manual");
  const [lendo, setLendo] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const lerLaudo = async (f: File | undefined) => {
    if (!f) return;
    setLendo(true);
    try {
      const a = f.type === "application/pdf" ? { base64: await arquivoParaBase64(f), mimeType: "application/pdf" } : { base64: await reduzirParaBase64(f, 1800, 0.85), mimeType: "image/jpeg" };
      const l = await ia.lerLaudo(a);
      const s = (n?: number | null) => (typeof n === "number" ? String(n).replace(".", ",") : "");
      setV({
        data: l.data && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : v.data,
        pesoKg: s(l.pesoKg),
        gorduraPct: s(l.gorduraPct),
        musculoPct: s(l.musculoPct),
        aguaPct: s(l.aguaPct),
        cinturaCm: s(l.cinturaCm),
      });
      setFonte("laudo");
      avisar("Laudo lido. Confira os números antes de salvar.");
    } catch (e) {
      avisar(e instanceof ErroIA ? e.message : "Não consegui ler o laudo.");
    } finally {
      setLendo(false);
    }
  };

  const salvar = async () => {
    const m = {
      data: v.data || hoje,
      pesoKg: num(v.pesoKg),
      gorduraPct: num(v.gorduraPct),
      musculoPct: num(v.musculoPct),
      aguaPct: num(v.aguaPct),
      cinturaCm: num(v.cinturaCm),
      fonte,
    };
    if (!m.pesoKg && !m.gorduraPct && !m.musculoPct && !m.aguaPct && !m.cinturaCm) return;
    await dados.salvarMedida(m);
    // O peso mais recente vira o peso de referência (calorias da corrida).
    if (m.pesoKg && m.data >= somarDias(hoje, -30)) await dados.salvarPerfil({ pesoKg: m.pesoKg });
    avisar("Medida registrada");
    setV(vazio);
    setFonte("manual");
    aoFechar();
  };

  const campo = (chave: keyof typeof v, rotulo: string) => (
    <div className="campo">
      <label htmlFor={`m-${chave}`}>{rotulo}</label>
      <input id={`m-${chave}`} className="entrada num" inputMode="decimal" value={v[chave]} onChange={(e) => setV({ ...v, [chave]: e.target.value })} />
    </div>
  );

  return (
    <Folha aberta={aberto} aoFechar={aoFechar} titulo="Registrar medida">
      <div className="pilha">
        <div className="campo">
          <label htmlFor="m-data">Data</label>
          <input id="m-data" className="entrada" type="date" max={hoje} value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
        </div>
        <div className="grade-2">
          {campo("pesoKg", `Peso (kg)${pesoAtual ? ` · último ${fmt(pesoAtual)}` : ""}`)}
          {campo("gorduraPct", "Gordura (%)")}
          {campo("aguaPct", "Água corporal (%)")}
          {campo("musculoPct", "Músculo (%)")}
          {campo("cinturaCm", "Cintura (cm)")}
        </div>
        <button className="botao cheio cor cor-corpo" onClick={salvar}>Salvar</button>
        <button className="botao contorno cheio" onClick={() => arquivo.current?.click()} disabled={lendo}>
          <Icone nome="brilho" tamanho={18} /> {lendo ? "Lendo o laudo…" : "Preencher com a foto do laudo"}
        </button>
        <p className="legenda" style={{ margin: 0 }}>
          Dado de saúde é sensível. No plano grátis da IA, o Google pode usar o que é enviado para melhorar produtos. Se preferir, digite os números.
        </p>
        <input ref={arquivo} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { void lerLaudo(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </Folha>
  );
}

function MetasCorpo({ aberto, aoFechar, metas }: { aberto: boolean; aoFechar: () => void; metas: Metas }) {
  const avisar = useAvisos();
  const s = (n?: number | null) => (typeof n === "number" ? String(n).replace(".", ",") : "");
  const [v, setV] = useState({ pesoKg: s(metas.pesoKg), gorduraPct: s(metas.gorduraPct), aguaCorporalPct: s(metas.aguaCorporalPct) });
  useEffect(() => {
    if (aberto) setV({ pesoKg: s(metas.pesoKg), gorduraPct: s(metas.gorduraPct), aguaCorporalPct: s(metas.aguaCorporalPct) });
  }, [aberto, metas]);
  return (
    <Folha aberta={aberto} aoFechar={aoFechar} titulo="Metas do corpo">
      <div className="pilha">
        <p className="suave" style={{ margin: 0 }}>Defina com quem te acompanha. Elas viram a linha tracejada dos gráficos e os pontos de atenção.</p>
        {([["pesoKg", "Peso (kg)"], ["gorduraPct", "Gordura corporal (%)"], ["aguaCorporalPct", "Água corporal (%)"]] as const).map(([c, rotulo]) => (
          <div key={c} className="campo">
            <label htmlFor={`meta-${c}`}>{rotulo}</label>
            <input id={`meta-${c}`} className="entrada num" inputMode="decimal" value={v[c]} onChange={(e) => setV({ ...v, [c]: e.target.value })} />
          </div>
        ))}
        <button
          className="botao cheio cor cor-corpo"
          onClick={async () => {
            await dados.salvarPerfil({ metas: { ...metas, pesoKg: num(v.pesoKg), gorduraPct: num(v.gorduraPct), aguaCorporalPct: num(v.aguaCorporalPct) } });
            avisar("Metas do corpo salvas");
            aoFechar();
          }}
        >
          Salvar metas
        </button>
      </div>
    </Folha>
  );
}
