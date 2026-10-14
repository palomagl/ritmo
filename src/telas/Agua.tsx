import { useState } from "react";
import { dados, type Dia } from "@/dados";
import { useAgoraH, useEstado, useObservar } from "@/app/estado";
import { useRegistrarAgua } from "@/app/acoes";
import { Anel, Esqueleto, Folha, Topo } from "@/componentes/basicos";
import { GraficoBarras } from "@/componentes/Graficos";
import { Icone } from "@/componentes/Icone";
import { formatarMl, ritmoDaAgua, sequenciaDeMeta } from "@/lib/agua";
import { horaMinuto, somarDias, ultimosDias } from "@/lib/datas";
import { fracao } from "@/lib/nutricao";

export default function Agua() {
  const { perfil, dia, hoje } = useEstado();
  const agoraH = useAgoraH();
  const registrarAgua = useRegistrarAgua();
  const [periodo, setPeriodo] = useState<7 | 30>(7);
  const [novoCopo, setNovoCopo] = useState(false);
  const [mlCopo, setMlCopo] = useState("");
  const dias = useObservar<Dia[]>((cb) => dados.observarDias(somarDias(hoje, -60), hoje, cb), [hoje]);

  if (!perfil || !dia || !dias) return <Esqueleto altura={240} raio={22} />;

  const meta = perfil.metas.aguaMl;
  const agua = dia.aguaMl ?? 0;
  const ritmo = ritmoDaAgua(agua, meta, agoraH, perfil.acordaH, perfil.dormeH);
  const seq = sequenciaDeMeta(dias, hoje, (d) => (d.aguaMl ?? 0) >= meta);
  const lista = ultimosDias(periodo, hoje);
  const porId = new Map(dias.map((d) => [d.id, d]));
  const registros = [...(dia.aguaRegistros ?? [])].sort((a, b) => b.em - a.em);

  const salvarCopo = async () => {
    const ml = parseInt(mlCopo, 10);
    if (!ml || ml < 50 || ml > 2000) return;
    const copos = Array.from(new Set([...perfil.copos, ml])).sort((a, b) => a - b).slice(0, 6);
    await dados.salvarPerfil({ copos });
    setNovoCopo(false);
    setMlCopo("");
  };

  return (
    <div className="pilha">
      <Topo titulo="Água" />

      <section className="card cor-agua" style={{ textAlign: "center" }}>
        <div style={{ display: "grid", placeItems: "center" }}>
          <Anel cor="agua" fracao={fracao(agua, meta)} valor={<span style={{ fontSize: 30, lineHeight: "34px" }}>{formatarMl(agua)}</span>} meta={`de ${formatarMl(meta)}`} tamanho={176} espessura={16} />
        </div>
        <p style={{ margin: "14px 0 4px", fontWeight: 600 }}>
          {agua >= meta
            ? "Meta batida! 💧"
            : ritmo.noRitmo
              ? `No ritmo. Faltam ${formatarMl(meta - agua)} até a meta.`
              : `${formatarMl(ritmo.faltaParaRitmoMl)} atrás do ritmo do dia.`}
        </p>
        <p className="legenda" style={{ margin: 0 }}>
          Até agora, o ritmo pede {formatarMl(ritmo.esperadoMl)} · {seq > 0 ? `${seq} ${seq === 1 ? "dia" : "dias"} seguidos na meta` : "sequência começa hoje"}
        </p>
      </section>

      <div className="botoes-agua">
        {perfil.copos.map((ml) => (
          <button key={ml} className="botao-agua" onClick={() => registrarAgua(ml)}>
            +{ml >= 1000 ? formatarMl(ml) : ml}
            <small>{ml >= 1000 ? "" : "ml"}</small>
          </button>
        ))}
        <button className="botao-agua" onClick={() => setNovoCopo(true)} aria-label="Adicionar copo">
          <Icone nome="mais" />
          <small>copo</small>
        </button>
      </div>

      <section className="card">
        <div className="linha entre" style={{ marginBottom: 12 }}>
          <p className="subtitulo">Histórico</p>
          <div className="segmentos" style={{ margin: 0, width: 120 }}>
            <button className={`segmento${periodo === 7 ? " ativo" : ""}`} onClick={() => setPeriodo(7)}>7d</button>
            <button className={`segmento${periodo === 30 ? " ativo" : ""}`} onClick={() => setPeriodo(30)}>30d</button>
          </div>
        </div>
        <GraficoBarras dias={lista} valores={lista.map((d) => porId.get(d)?.aguaMl ?? 0)} meta={meta} cor="agua" hoje={hoje} formatar={formatarMl} />
      </section>

      {registros.length > 0 && (
        <section className="card lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {registros.map((r) => (
            <div key={r.em} className="item-lista">
              <span className="selo-icone cor-agua"><Icone nome="gota" tamanho={16} /></span>
              <span className="cresce"><b className="num">{r.ml} ml</b></span>
              <span className="legenda num">{horaMinuto(r.em)}</span>
              <button className="botao-icone liso" style={{ width: 32, height: 32 }} aria-label="Apagar registro" onClick={() => dados.desfazerAgua(r, hoje)}>
                <Icone nome="fechar" tamanho={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      <Folha aberta={novoCopo} aoFechar={() => setNovoCopo(false)} titulo="Novo copo">
        <div className="pilha">
          <div className="campo">
            <label htmlFor="ml-copo">Quantos ml? (ex.: garrafinha de 750)</label>
            <input id="ml-copo" className="entrada num" inputMode="numeric" value={mlCopo} onChange={(e) => setMlCopo(e.target.value)} autoFocus />
          </div>
          <button className="botao cheio cor cor-agua" onClick={salvarCopo}>Salvar copo</button>
          <p className="legenda" style={{ margin: 0 }}>Para tirar um copo, mude a lista em Perfil → Metas.</p>
        </div>
      </Folha>
    </div>
  );
}
