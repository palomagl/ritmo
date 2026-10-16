import { useMemo, useRef } from "react";
import { dados, type Corrida } from "@/dados";
import { useAvisos, useEstado, useObservar } from "@/app/estado";
import { Link, navegar } from "@/app/rota";
import { Esqueleto, Vazio } from "@/componentes/basicos";
import { Icone } from "@/componentes/Icone";
import { dataCurta, somarDias, chaveDia, dataDaChave, diaDaSemanaCurto } from "@/lib/datas";
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

/** Corridas e caminhadas (do Strava, do GPS do app ou de um GPX). */
export default function Mover() {
  return (
    <div>
      <header className="topo">
        <h1 className="titulo">Mover</h1>
      </header>
      <Corridas />
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

      <button className="botao cheio" style={{ minHeight: 56, fontSize: 17 }} onClick={() => navegar("/corrida/ao-vivo")}>
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
