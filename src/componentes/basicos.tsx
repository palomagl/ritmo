import { createPortal } from "react-dom";
// Peças pequenas usadas em várias telas.

import { useEffect, type ReactNode } from "react";
import { Icone, type NomeIcone } from "./Icone";
import { voltar } from "@/app/rota";

/** Anel de progresso com o valor no meio. */
export function Anel({
  fracao,
  cor,
  valor,
  meta,
  nome,
  tamanho = 96,
  espessura = 10,
  onClick,
}: {
  fracao: number;
  cor: "passos" | "agua" | "comida" | "corpo" | "pulso";
  valor: ReactNode;
  meta?: ReactNode;
  nome?: string;
  tamanho?: number;
  espessura?: number;
  onClick?: () => void;
}) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fracao));
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`anel cor-${cor}`} onClick={onClick} aria-label={nome ? `${nome}: ${Math.round(f * 100)}% da meta` : undefined}>
      <div className="anel-caixa" style={{ width: tamanho, height: tamanho }}>
        <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
          <circle className="anel-trilha" cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" strokeWidth={espessura} />
          <circle
            className="anel-progresso"
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={r}
            fill="none"
            strokeWidth={espessura}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - f)}
            transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
          />
        </svg>
        <div className="anel-centro">
          <div>
            <div className="anel-valor">{valor}</div>
            {meta && <div className="anel-meta">{meta}</div>}
          </div>
        </div>
      </div>
      {nome && <span className="anel-nome">{nome}</span>}
    </Tag>
  );
}

/** Cabeçalho de tela com voltar. */
export function Topo({ titulo, voltarPara = "/", direita }: { titulo: string; voltarPara?: string | null; direita?: ReactNode }) {
  return (
    <header className="topo">
      {voltarPara !== null && (
        <button className="botao-icone liso" onClick={() => voltar(voltarPara)} aria-label="Voltar">
          <Icone nome="voltar" />
        </button>
      )}
      <h1 className="titulo">{titulo}</h1>
      {direita}
    </header>
  );
}

/** Folha que sobe de baixo. Fecha no véu, no Esc e no voltar do celular. */
export function Folha({ aberta, aoFechar, titulo, children }: { aberta: boolean; aoFechar: () => void; titulo?: string; children: ReactNode }) {
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    const corpo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = corpo;
    };
  }, [aberta, aoFechar]);
  if (!aberta) return null;
  // Vai direto para o <body>: dentro de um cartão com efeito vidro, uma
  // camada "fixa" ficaria presa ao cartão em vez de cobrir a tela.
  return createPortal(
    <>
      <div className="veu" onClick={aoFechar} />
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="folha-alca" />
        {titulo && <h2 className="subtitulo" style={{ marginBottom: 16 }}>{titulo}</h2>}
        {children}
      </div>
    </>,
    document.body
  );
}

export function Esqueleto({ altura = 120, raio }: { altura?: number; raio?: number }) {
  return <div className="esqueleto" style={{ height: altura, borderRadius: raio }} aria-hidden="true" />;
}

export function Vazio({ icone, cor, titulo, texto, acao }: { icone: NomeIcone; cor: string; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className={`vazio cor-${cor}`}>
      <div className="selo-icone">
        <Icone nome={icone} tamanho={28} />
      </div>
      <p className="subtitulo">{titulo}</p>
      {texto && <p className="legenda" style={{ margin: 0, maxWidth: 280 }}>{texto}</p>}
      {acao}
    </div>
  );
}

/** Barra fina de macro (carbo, proteína, gordura). */
export function BarraMacro({ nome, atual, meta, cor, unidade = "g" }: { nome: string; atual: number; meta: number; cor: string; unidade?: string }) {
  const f = meta > 0 ? Math.min(1, atual / meta) : 0;
  return (
    <div className={`macro cor-${cor}`}>
      <div className="linha entre">
        <span className="legenda" style={{ color: "var(--texto)", fontWeight: 600 }}>{nome}</span>
        <span className="legenda num">
          <b style={{ color: "var(--texto)" }}>{Math.round(atual)}</b> / {Math.round(meta)} {unidade}
        </span>
      </div>
      <div className="macro-trilha">
        <div className="macro-cheio" style={{ width: `${f * 100}%` }} />
      </div>
    </div>
  );
}

/** − valor + */
export function PassoNumero({ valor, aoMudar, passo = 10, min = 0, unidade = "g" }: { valor: number; aoMudar: (v: number) => void; passo?: number; min?: number; unidade?: string }) {
  return (
    <div className="passo-numero">
      <button type="button" onClick={() => aoMudar(Math.max(min, valor - passo))} aria-label={`Menos ${passo}`}>
        −
      </button>
      <span>
        {valor}
        <small className="suave"> {unidade}</small>
      </span>
      <button type="button" onClick={() => aoMudar(valor + passo)} aria-label={`Mais ${passo}`}>
        +
      </button>
    </div>
  );
}

export function SeloIcone({ icone, cor, tamanho = 18 }: { icone: NomeIcone; cor: string; tamanho?: number }) {
  return (
    <span className={`selo-icone cor-${cor}`}>
      <Icone nome={icone} tamanho={tamanho} />
    </span>
  );
}
