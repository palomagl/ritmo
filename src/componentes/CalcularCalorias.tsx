import { useState } from "react";
import { idade as idadeDe } from "@/lib/datas";
import { milhar } from "@/lib/passos";
import {
  dadosValidos,
  estimarCalorias,
  MINIMO_KCAL,
  type Atividade,
  type EstimativaCalorias,
  type Objetivo,
  type Sexo,
} from "@/lib/calorias";

const ATIVIDADES: { id: Atividade; nome: string; texto: string }[] = [
  { id: "pouca", nome: "Pouca", texto: "Trabalho sentado, caminhadas leves no dia a dia." },
  { id: "moderada", nome: "Moderada", texto: "Exercício de 3 a 5 vezes por semana." },
  { id: "muita", nome: "Muita", texto: "Exercício intenso quase todo dia." },
];

const OBJETIVOS: { id: Objetivo; nome: string }[] = [
  { id: "perder", nome: "Perder peso" },
  { id: "manter", nome: "Manter" },
  { id: "ganhar", nome: "Ganhar" },
];

const num = (s: string) => parseFloat(s.replace(",", "."));

/**
 * Calculadora para quem não sabe a meta de calorias. Mostra a conta e só
 * aplica quando a pessoa toca em "Usar".
 */
export function CalcularCalorias({
  pesoKg,
  alturaCm,
  nascimento,
  aoUsar,
}: {
  pesoKg?: number | null;
  alturaCm?: number | null;
  nascimento?: string | null;
  aoUsar: (e: EstimativaCalorias) => void;
}) {
  const [sexo, setSexo] = useState<Sexo | null>(null);
  const [atividade, setAtividade] = useState<Atividade>("pouca");
  const [objetivo, setObjetivo] = useState<Objetivo>("manter");
  const [peso, setPeso] = useState(pesoKg ? String(pesoKg).replace(".", ",") : "");
  const [altura, setAltura] = useState(alturaCm ? String(alturaCm) : "");
  const [anos, setAnos] = useState(nascimento ? String(idadeDe(nascimento)) : "");

  const dados = { sexo: sexo ?? undefined, atividade, objetivo, pesoKg: num(peso), alturaCm: num(altura), idade: num(anos) };
  const r = dadosValidos(dados) ? estimarCalorias(dados) : null;

  return (
    <div className="pilha calc-calorias" style={{ gap: 14 }}>
      <div className="grade-3">
        <div className="campo">
          <label htmlFor="cc-peso">Peso (kg)</label>
          <input id="cc-peso" className="entrada num" inputMode="decimal" placeholder="65" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cc-altura">Altura (cm)</label>
          <input id="cc-altura" className="entrada num" inputMode="numeric" placeholder="165" value={altura} onChange={(e) => setAltura(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cc-idade">Idade</label>
          <input id="cc-idade" className="entrada num" inputMode="numeric" placeholder="28" value={anos} onChange={(e) => setAnos(e.target.value)} />
        </div>
      </div>

      <div>
        <p className="legenda" style={{ margin: "0 0 8px" }}>Sexo biológico (muda a conta do gasto em repouso)</p>
        <div className="segmentos" style={{ margin: 0 }}>
          {(["feminino", "masculino"] as Sexo[]).map((s) => (
            <button key={s} type="button" className={`segmento${sexo === s ? " ativo" : ""}`} onClick={() => setSexo(s)}>
              {s === "feminino" ? "Feminino" : "Masculino"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="legenda" style={{ margin: "0 0 8px" }}>Quanto você se mexe</p>
        <div className="segmentos" style={{ margin: 0 }}>
          {ATIVIDADES.map((a) => (
            <button key={a.id} type="button" className={`segmento${atividade === a.id ? " ativo" : ""}`} onClick={() => setAtividade(a.id)}>
              {a.nome}
            </button>
          ))}
        </div>
        <p className="legenda" style={{ margin: "6px 2px 0" }}>{ATIVIDADES.find((a) => a.id === atividade)?.texto}</p>
      </div>

      <div>
        <p className="legenda" style={{ margin: "0 0 8px" }}>Objetivo</p>
        <div className="segmentos" style={{ margin: 0 }}>
          {OBJETIVOS.map((o) => (
            <button key={o.id} type="button" className={`segmento${objetivo === o.id ? " ativo" : ""}`} onClick={() => setObjetivo(o.id)}>
              {o.nome}
            </button>
          ))}
        </div>
      </div>

      {r ? (
        <div className="card cor-comida calc-resultado">
          <p className="legenda" style={{ margin: 0 }}>Sua meta sugerida</p>
          <p className="num-medio" style={{ margin: "2px 0 4px" }}>
            {milhar(r.kcal)} <span className="subtitulo suave">kcal por dia</span>
          </p>
          <p className="legenda num" style={{ margin: 0, color: "var(--texto)" }}>
            Proteína {r.proteinaG} g · Carboidrato {r.carboG} g · Gordura {r.gorduraG} g
          </p>
          <p className="legenda" style={{ margin: "10px 0 0" }}>
            Seu corpo gasta cerca de {milhar(r.gasto)} kcal por dia.
            {objetivo === "perder" && " Para perder peso sem passar fome, a meta fica 20% abaixo disso."}
            {objetivo === "ganhar" && " Para ganhar massa, a meta fica 10% acima, com bastante proteína."}
          </p>
          {r.noMinimo && sexo && (
            <p className="legenda" style={{ margin: "6px 0 0" }}>
              A conta deu menos que {milhar(MINIMO_KCAL[sexo])} kcal, então a meta ficou nesse mínimo. Para ir abaixo disso, só com acompanhamento.
            </p>
          )}
          <button type="button" className="botao cheio" style={{ marginTop: 14, width: "100%" }} onClick={() => aoUsar(r)}>
            Usar esta meta
          </button>
        </div>
      ) : (
        <p className="legenda" style={{ margin: 0 }}>Preencha peso, altura, idade e sexo para ver a sua meta.</p>
      )}

      <p className="legenda" style={{ margin: 0 }}>
        Estimativa pela fórmula de Mifflin-St Jeor, um ponto de partida. Se você tem nutricionista, a meta dela vale mais.
      </p>
    </div>
  );
}
