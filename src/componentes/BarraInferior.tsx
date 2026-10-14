import { useState } from "react";
import { Icone, type NomeIcone } from "./Icone";
import { Folha } from "./basicos";
import { Link, navegar, useCaminho } from "@/app/rota";
import { useRegistrarAgua } from "@/app/acoes";
import { useEstado } from "@/app/estado";

const ABAS: { para: string; nome: string; icone: NomeIcone; ativo: (c: string) => boolean }[] = [
  { para: "/", nome: "Hoje", icone: "hoje", ativo: (c) => c === "/" },
  { para: "/mover/passos", nome: "Mover", icone: "mover", ativo: (c) => c.startsWith("/mover") || c.startsWith("/corrida") },
  { para: "/comer", nome: "Comer", icone: "comer", ativo: (c) => c.startsWith("/comer") },
  { para: "/corpo", nome: "Corpo", icone: "corpo", ativo: (c) => c.startsWith("/corpo") },
];

/** Barra de baixo: 4 abas e o + no meio, que abre as ações rápidas. */
export function BarraInferior() {
  const caminho = useCaminho();
  const [aberto, setAberto] = useState(false);
  const registrarAgua = useRegistrarAgua();
  const { perfil } = useEstado();
  const copo = perfil?.copos?.[1] ?? 300;

  const aba = (i: number) => {
    const a = ABAS[i];
    const ativa = a.ativo(caminho);
    return (
      <Link key={a.para} para={a.para} substituir className={`aba${ativa ? " ativa" : ""}`} aria-current={ativa ? "page" : undefined}>
        <Icone nome={a.icone} />
        {a.nome}
      </Link>
    );
  };

  const ir = (para: string) => {
    setAberto(false);
    navegar(para);
  };

  return (
    <>
      <nav className="barra" aria-label="Navegação principal">
        <div className="barra-dentro">
          {aba(0)}
          {aba(1)}
          <button className={`mais${aberto ? " aberto" : ""}`} onClick={() => setAberto((a) => !a)} aria-label="Ações rápidas" aria-expanded={aberto}>
            <Icone nome="mais" tamanho={26} strokeWidth={2.6} />
          </button>
          {aba(2)}
          {aba(3)}
        </div>
      </nav>

      <Folha aberta={aberto} aoFechar={() => setAberto(false)} titulo="Registrar">
        <div className="acoes-mais">
          <button
            className="acao-mais cor-agua"
            onClick={() => {
              setAberto(false);
              void registrarAgua(copo);
            }}
          >
            <span className="selo-icone">
              <Icone nome="gota" />
            </span>
            <span>
              +{copo} ml de água
              <small>Registra na hora</small>
            </span>
          </button>
          <button className="acao-mais cor-comida" onClick={() => ir("/comer/foto")}>
            <span className="selo-icone">
              <Icone nome="camera" />
            </span>
            <span>
              Foto do prato
              <small>A IA estima os macros</small>
            </span>
          </button>
          <button className="acao-mais cor-pulso" onClick={() => ir("/corrida/ao-vivo")}>
            <span className="selo-icone">
              <Icone nome="rota" />
            </span>
            <span>
              Iniciar corrida
              <small>GPS e mapa</small>
            </span>
          </button>
          <button className="acao-mais cor-corpo" onClick={() => ir("/corpo?registrar=1")}>
            <span className="selo-icone">
              <Icone nome="balanca" />
            </span>
            <span>
              Registrar peso
              <small>E outras medidas</small>
            </span>
          </button>
        </div>
      </Folha>
    </>
  );
}
