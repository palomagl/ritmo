import { useState } from "react";
import { ia, ErroIA } from "@/ia";
import { useEstado } from "@/app/estado";
import { Topo } from "@/componentes/basicos";
import { Icone } from "@/componentes/Icone";
import { local } from "@/lib/aparelho";

interface Conversa {
  pergunta: string;
  resposta: string;
  em: number;
}

const CHAVE = "pulso:perguntas";
const SUGESTOES = ["Posso trocar o arroz por batata no almoço?", "O que comer antes de correr?", "Quanto falta de proteína hoje?"];

/** Perguntas rápidas sobre o plano. Guarda só as últimas 5, no aparelho. */
export default function Perguntar() {
  const { plano, dia, perfil } = useEstado();
  const [texto, setTexto] = useState("");
  const [historico, setHistorico] = useState<Conversa[]>(() => local.ler<Conversa[]>(CHAVE, []));
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");

  const perguntar = async (p: string) => {
    const pergunta = p.trim();
    if (!pergunta || pensando) return;
    setPensando(true);
    setErro("");
    try {
      const resposta = await ia.perguntar(pergunta, plano ?? null, {
        jaComidoHoje: { kcal: dia?.kcal ?? 0, carboG: dia?.carboG ?? 0, proteinaG: dia?.proteinaG ?? 0, gorduraG: dia?.gorduraG ?? 0 },
        metasDoDia: { kcal: perfil?.metas.kcal ?? 0, carboG: perfil?.metas.carboG ?? 0, proteinaG: perfil?.metas.proteinaG ?? 0, gorduraG: perfil?.metas.gorduraG ?? 0 },
        pontosDeAtencao: perfil?.pontosDeAtencao ?? [],
      });
      const novo = [{ pergunta, resposta, em: Date.now() }, ...historico].slice(0, 5);
      setHistorico(novo);
      local.gravar(CHAVE, novo);
      setTexto("");
    } catch (e) {
      setErro(e instanceof ErroIA ? e.message : "Não consegui responder agora.");
    } finally {
      setPensando(false);
    }
  };

  return (
    <div className="pilha">
      <Topo titulo="Perguntar" voltarPara="/comer" />
      <p className="suave" style={{ margin: "-10px 0 0" }}>Dúvidas rápidas, respondidas com base no seu plano.</p>

      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          void perguntar(texto);
        }}
      >
        <textarea className="entrada" placeholder="Ex.: posso trocar o arroz por batata no almoço?" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className="botao cor cor-comida" type="submit" disabled={pensando || texto.trim().length < 3}>
          <Icone nome="balao" tamanho={18} /> {pensando ? "Pensando…" : "Perguntar"}
        </button>
      </form>

      {historico.length === 0 && (
        <div className="linha" style={{ flexWrap: "wrap", gap: 8 }}>
          {SUGESTOES.map((s) => (
            <button key={s} className="botao secundario pequeno" onClick={() => perguntar(s)} disabled={pensando}>
              {s}
            </button>
          ))}
        </div>
      )}

      {erro && <div className="card" role="alert" style={{ color: "var(--erro)" }}>{erro}</div>}
      {!plano && <p className="legenda" style={{ margin: 0 }}>Sem plano enviado, as respostas ficam mais genéricas.</p>}

      {historico.map((c) => (
        <section key={c.em} className="card">
          <p className="legenda" style={{ margin: "0 0 6px" }}>{c.pergunta}</p>
          <p style={{ margin: 0 }}>{c.resposta}</p>
        </section>
      ))}
      {historico.length > 0 && <p className="legenda" style={{ margin: 0 }}>Respostas de IA: em dúvida, confirme com sua nutricionista.</p>}
    </div>
  );
}
