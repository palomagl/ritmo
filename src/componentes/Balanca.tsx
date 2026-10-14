import { useEffect, useMemo, useState } from "react";
import { dados, type Medida } from "@/dados";
import { useAvisos, useEstado } from "@/app/estado";
import { serie } from "@/lib/corpo";
import { dataCurta, somarDias } from "@/lib/datas";
import { Folha } from "./basicos";
import { Icone } from "./Icone";

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

function quando(data: string, hoje: string): string {
  if (data === hoje) return "Hoje";
  if (data === somarDias(hoje, -1)) return "Ontem";
  return `Em ${dataCurta(data)}`;
}

/** Linha pequena com os últimos pesos. */
function Faisca({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const L = 96;
  const A = 40;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = Math.max(max - min, 0.6);
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * (L - 8) + 4, A - 6 - ((v - min) / faixa) * (A - 12)] as const);
  const [ux, uy] = pts[pts.length - 1];
  return (
    <svg className="faisca" width={L} height={A} viewBox={`0 0 ${L} ${A}`} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} />
      <circle cx={ux} cy={uy} r={3.5} />
    </svg>
  );
}

/**
 * A balança: o último peso, quando foi e quanto mudou, com o botão de pesar.
 * Aparece no Hoje e no topo do Corpo.
 */
export function CardBalanca({ medidas }: { medidas: Medida[] | undefined }) {
  const { hoje } = useEstado();
  const [pesando, setPesando] = useState(false);
  const pesos = useMemo(() => serie(medidas ?? [], "pesoKg"), [medidas]);
  const ultimo = pesos[pesos.length - 1];
  const anterior = pesos[pesos.length - 2];
  const variacao = ultimo && anterior ? Math.round((ultimo.valor - anterior.valor) * 10) / 10 : null;

  // A folha fica fora do cartão: o efeito vidro do cartão prenderia ela dentro.
  return (
    <>
    <section className="card cor-corpo balanca" aria-label="Balança">
      <div className="balanca-info">
        <span className="metrica-nome">
          <i className="ponto" /> Peso
        </span>
        {ultimo ? (
          <>
            <span className="balanca-valor">
              {fmt(ultimo.valor)}
              <small> kg</small>
            </span>
            <span className="legenda">
              {quando(ultimo.data, hoje)}
              {variacao !== null && (
                <>
                  {" · "}
                  {variacao === 0 ? "igual à anterior" : `${variacao > 0 ? "+" : "−"}${fmt(Math.abs(variacao))} kg`}
                </>
              )}
            </span>
          </>
        ) : (
          <span className="legenda">Anote seu peso para ver a evolução.</span>
        )}
      </div>
      <Faisca valores={pesos.slice(-10).map((p) => p.valor)} />
      <button className="botao cor cor-corpo pequeno balanca-botao" onClick={() => setPesando(true)}>
        <Icone nome="balanca" tamanho={16} /> Pesar
      </button>
    </section>
    <FolhaPesar aberta={pesando} aoFechar={() => setPesando(false)} medidas={medidas ?? []} sugestao={ultimo?.valor ?? null} />
    </>
  );
}

function FolhaPesar({ aberta, aoFechar, medidas, sugestao }: { aberta: boolean; aoFechar: () => void; medidas: Medida[]; sugestao: number | null }) {
  const { hoje } = useEstado();
  const avisar = useAvisos();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberta) setTexto(sugestao ? fmt(sugestao) : "");
  }, [aberta, sugestao]);

  const valor = parseFloat(texto.replace(",", "."));
  const valido = Number.isFinite(valor) && valor >= 25 && valor <= 300;
  const mudar = (d: number) => {
    const base = Number.isFinite(valor) ? valor : sugestao ?? 60;
    setTexto(fmt(Math.max(25, Math.round((base + d) * 10) / 10)));
  };

  const salvar = async () => {
    if (!valido || salvando) return;
    setSalvando(true);
    const peso = Math.round(valor * 10) / 10;
    // Pesou de novo hoje? Atualiza a medida de hoje em vez de criar outra.
    const deHoje = medidas.find((m) => m.data === hoje && m.fonte === "manual");
    if (deHoje) await dados.excluirMedida(deHoje.id);
    await dados.salvarMedida({
      data: hoje,
      pesoKg: peso,
      gorduraPct: deHoje?.gorduraPct ?? null,
      musculoPct: deHoje?.musculoPct ?? null,
      aguaPct: deHoje?.aguaPct ?? null,
      cinturaCm: deHoje?.cinturaCm ?? null,
      fonte: "manual",
    });
    await dados.salvarPerfil({ pesoKg: peso });
    setSalvando(false);
    avisar(`${fmt(peso)} kg anotado`);
    aoFechar();
  };

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="Pesar hoje">
      <div className="pilha">
        <div className="pesar">
          <button className="pesar-passo" onClick={() => mudar(-0.1)} aria-label="Menos 100 gramas">
            −
          </button>
          <label className="pesar-visor">
            <input
              className="pesar-entrada"
              inputMode="decimal"
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
              placeholder="00,0"
              aria-label="Peso em quilos"
            />
            <span>kg</span>
          </label>
          <button className="pesar-passo" onClick={() => mudar(0.1)} aria-label="Mais 100 gramas">
            +
          </button>
        </div>
        <p className="legenda" style={{ margin: 0, textAlign: "center" }}>
          Melhor de manhã, em jejum e depois do banheiro: assim dá para comparar um dia com o outro.
        </p>
        <button className="botao cheio cor cor-corpo" onClick={salvar} disabled={!valido || salvando}>
          {salvando ? "Anotando…" : "Anotar peso"}
        </button>
      </div>
    </Folha>
  );
}
