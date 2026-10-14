import { useEffect, useMemo, useState } from "react";
import { dados, type Corrida } from "@/dados";
import { useAvisos } from "@/app/estado";
import { navegar } from "@/app/rota";
import { Esqueleto, Topo, Vazio } from "@/componentes/basicos";
import { Mapa } from "@/componentes/Mapa";
import { Icone } from "@/componentes/Icone";
import { chaveDia, dataPorExtenso, horaMinuto } from "@/lib/datas";
import { decodificarRota, formatarDuracao, formatarKm, formatarPace } from "@/lib/corrida";

export default function CorridaResumo({ id }: { id: string }) {
  const avisar = useAvisos();
  const [corrida, setCorrida] = useState<Corrida | null | undefined>(undefined);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Logo depois de salvar, o documento pode levar um instante para existir
    // no cache: tenta de novo algumas vezes antes de desistir.
    (async () => {
      for (let i = 0; i < 6 && vivo; i++) {
        const c = await dados.obterCorrida(id);
        if (c || i === 5) {
          if (vivo) setCorrida(c);
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  const rota = useMemo(() => (corrida ? decodificarRota(corrida.rota) : []), [corrida]);

  if (corrida === undefined) {
    return (
      <div className="pilha">
        <Esqueleto altura={44} />
        <Esqueleto altura={260} raio={18} />
        <Esqueleto altura={120} raio={22} />
      </div>
    );
  }
  if (corrida === null) {
    return (
      <>
        <Topo titulo="Corrida" voltarPara="/mover/corridas" />
        <Vazio icone="rota" cor="pulso" titulo="Não encontrei essa corrida" />
      </>
    );
  }

  // Pace de cada parcial (o pedaço final é proporcional à fração de km).
  const paceDe = (p: { km: number; duracaoS: number }) => (Number.isInteger(p.km) ? p.duracaoS : p.duracaoS / (p.km % 1 || 1));
  const fechados = corrida.parciais.filter((p) => Number.isInteger(p.km));
  const maisRapido = fechados.length ? Math.min(...fechados.map((p) => p.duracaoS)) : Infinity;
  const paceMaisRapido = Math.min(...corrida.parciais.map(paceDe));

  const excluir = async () => {
    await dados.excluirCorrida(corrida.id);
    avisar("Corrida excluída");
    navegar("/mover/corridas", { substituir: true });
  };

  return (
    <div className="pilha">
      <Topo titulo={corrida.tipo === "corrida" ? "Corrida" : "Caminhada"} voltarPara="/mover/corridas" />
      <p className="legenda" style={{ margin: "-14px 0 4px" }}>
        {dataPorExtenso(new Date(corrida.inicio))} · {horaMinuto(corrida.inicio)}
        {corrida.fonte === "gpx" ? " · importada" : ""}
      </p>

      <Mapa pontos={rota} altura={260} />

      <section className="card">
        <div className="grade-2" style={{ rowGap: 18 }}>
          <div>
            <div className="legenda">Distância</div>
            <div className="num-grande">{formatarKm(corrida.distanciaM)}<span className="legenda"> km</span></div>
          </div>
          <div>
            <div className="legenda">Tempo</div>
            <div className="num-grande">{formatarDuracao(corrida.duracaoS)}</div>
          </div>
          <div>
            <div className="legenda">Pace médio</div>
            <div className="num-medio">{formatarPace(corrida.paceMedioSKm)}<span className="legenda"> /km</span></div>
          </div>
          <div>
            <div className="legenda">Calorias</div>
            <div className="num-medio">≈{corrida.kcalEstimada}<span className="legenda"> kcal</span></div>
          </div>
        </div>
      </section>

      {corrida.parciais.length > 0 && (
        <section className="card">
          <p className="subtitulo" style={{ marginBottom: 10 }}>Parciais</p>
          <div className="lista">
            {corrida.parciais.map((p) => {
              const inteiro = Number.isInteger(p.km);
              const pace = paceDe(p);
              return (
                <div key={p.km} className="item-lista" style={{ padding: "8px 0" }}>
                  <span className="num" style={{ width: 44, fontWeight: 700 }}>{inteiro ? `${p.km}` : String(p.km).replace(".", ",")}</span>
                  <div className="cresce macro-trilha" style={{ height: 10 }}>
                    <div className="macro-cheio" style={{ width: `${Math.max(12, (paceMaisRapido / pace) * 100)}%`, background: inteiro && p.duracaoS === maisRapido && fechados.length > 1 ? "var(--passos)" : "var(--pulso)" }} />
                  </div>
                  <span className="num" style={{ width: 64, textAlign: "right", fontWeight: 600 }}>{formatarPace(pace)}</span>
                </div>
              );
            })}
          </div>
          {fechados.length > 1 && <p className="legenda" style={{ margin: "8px 0 0" }}>Em verde, o km mais rápido.</p>}
        </section>
      )}

      {confirmando ? (
        <div className="linha">
          <button className="botao secundario cresce" onClick={() => setConfirmando(false)}>Cancelar</button>
          <button className="botao perigo cresce" onClick={excluir}>Excluir de vez</button>
        </div>
      ) : (
        <button className="botao texto" onClick={() => setConfirmando(true)} style={{ color: "var(--texto-suave)" }}>
          <Icone nome="lixo" tamanho={18} /> Excluir esta {corrida.tipo}
        </button>
      )}
      <p className="legenda" style={{ textAlign: "center" }}>{chaveDia(new Date(corrida.inicio)) === chaveDia() ? "Boa! Mais uma no histórico." : ""}</p>
    </div>
  );
}
