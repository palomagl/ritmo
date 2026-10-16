// ==============================================
// Meu plano: enviar, revisar e editar o plano alimentar
// ==============================================

import { useRef, useState } from "react";
import { dados, type Plano, type RefeicaoPlano, type TipoRefeicao } from "@/dados";
import { ia, ErroIA } from "@/ia";
import { useAvisos, useEstado } from "@/app/estado";
import { Esqueleto, Topo, Vazio } from "@/componentes/basicos";
import { navegar } from "@/app/rota";
import { Icone } from "@/componentes/Icone";
import { arquivoParaBase64, reduzirParaBase64 } from "@/lib/aparelho";
import { NOMES_REFEICAO, ORDEM_REFEICOES } from "@/lib/nutricao";
import { formatarMl } from "@/lib/agua";

type Etapa = "ver" | "lendo" | "revisar";

export default function MeuPlano() {
  const { plano, perfil } = useEstado();
  const avisar = useAvisos();
  const [etapa, setEtapa] = useState<Etapa>("ver");
  const [rascunho, setRascunho] = useState<Plano | null>(null);
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  const enviar = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    setErro("");
    setEtapa("lendo");
    try {
      const arquivos = await Promise.all(
        Array.from(lista).slice(0, 10).map(async (f) =>
          f.type === "application/pdf"
            ? { base64: await arquivoParaBase64(f), mimeType: "application/pdf" }
            : { base64: await reduzirParaBase64(f, 1800, 0.85), mimeType: "image/jpeg" }
        )
      );
      const lido = await ia.lerPlano(arquivos);
      if (lido.refeicoes.length === 0) throw new ErroIA("Não encontrei refeições nesse arquivo. Confira se é o plano e se está legível.");
      setRascunho({ ...lido, atualizadoEm: Date.now() });
      setEtapa("revisar");
    } catch (e) {
      setErro(e instanceof ErroIA ? e.message : "Não consegui ler o plano agora. Tente de novo.");
      setEtapa("ver");
    }
  };

  const salvar = async () => {
    if (!rascunho || !perfil) return;
    const limpo: Plano = {
      ...rascunho,
      refeicoes: [...rascunho.refeicoes]
        .map((r) => ({ ...r, opcoes: r.opcoes.filter((o) => o.descricao.trim()) }))
        .filter((r) => r.opcoes.length > 0)
        .sort((a, b) => a.horario.localeCompare(b.horario)),
      substituicoes: rascunho.substituicoes.filter((s) => s.trim()),
      atualizadoEm: Date.now(),
    };
    await dados.salvarPlano(limpo);
    // As metas do plano passam a ser as metas do app (o plano manda).
    const md = limpo.metasDiarias;
    if (Object.values(md).some((v) => typeof v === "number" && v > 0)) {
      await dados.salvarPerfil({
        metas: {
          ...perfil.metas,
          ...(md.kcal ? { kcal: Math.round(md.kcal) } : {}),
          ...(md.carboG ? { carboG: Math.round(md.carboG) } : {}),
          ...(md.proteinaG ? { proteinaG: Math.round(md.proteinaG) } : {}),
          ...(md.gorduraG ? { gorduraG: Math.round(md.gorduraG) } : {}),
          ...(md.aguaMl ? { aguaMl: Math.round(md.aguaMl) } : {}),
        },
      });
    }
    avisar("Plano salvo");
    setEtapa("ver");
    setRascunho(null);
  };

  const mudarRefeicao = (k: number, r: Partial<RefeicaoPlano>) =>
    setRascunho((p) => (p ? { ...p, refeicoes: p.refeicoes.map((x, j) => (j === k ? { ...x, ...r } : x)) } : p));

  return (
    <div>
      <Topo
        titulo="Meu plano"
        voltarPara="/comer"
        direita={
          etapa === "ver" && plano ? (
            <button className="botao-icone" aria-label="Editar plano" onClick={() => { setRascunho(structuredClone(plano)); setEtapa("revisar"); }}>
              <Icone nome="lapis" />
            </button>
          ) : undefined
        }
      />
      <input ref={entrada} type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => { void enviar(e.target.files); e.target.value = ""; }} />

      {etapa === "lendo" && (
        <div className="pilha">
          <p className="subtitulo pulsando" style={{ textAlign: "center" }}>Lendo seu plano…</p>
          <p className="legenda" style={{ textAlign: "center", margin: 0 }}>Isso leva uns 10 a 20 segundos.</p>
          <Esqueleto altura={90} raio={22} />
          <Esqueleto altura={90} raio={22} />
          <Esqueleto altura={90} raio={22} />
        </div>
      )}

      {etapa === "ver" && (
        <div className="pilha">
          {erro && <div className="card" role="alert" style={{ color: "var(--erro)" }}>{erro}</div>}
          {!plano ? (
            <div className="card">
              <Vazio
                icone="texto"
                cor="comida"
                titulo="Envie seu plano alimentar"
                texto="PDF ou fotos das páginas. A IA organiza por refeição e horário, e você confere tudo antes de salvar."
                acao={<button className="botao cor cor-comida" onClick={() => entrada.current?.click()}><Icone nome="enviar" tamanho={18} /> Enviar plano</button>}
              />
              <p className="legenda" style={{ textAlign: "center", margin: "4px 0 0" }}>
                Ainda não tem nutricionista?{" "}
                <a href="/perfil" onClick={(e) => { e.preventDefault(); navegar("/perfil"); }} style={{ color: "var(--pulso-texto)", fontWeight: 600 }}>
                  Calcule suas calorias em Perfil → Metas
                </a>
              </p>
            </div>
          ) : (
            <>
              {plano.refeicoes.map((r, k) => (
                <section key={k} className="card cor-comida">
                  <div className="linha entre" style={{ marginBottom: 8 }}>
                    <span className="subtitulo">{NOMES_REFEICAO[r.tipo]}</span>
                    <span className="pilula cor num">{r.horario}</span>
                  </div>
                  {r.opcoes.map((o, j) => (
                    <p key={j} style={{ margin: j ? "8px 0 0" : 0 }}>
                      {r.opcoes.length > 1 && <span className="legenda">Opção {j + 1}: </span>}
                      {o.descricao}
                    </p>
                  ))}
                </section>
              ))}
              {plano.substituicoes.length > 0 && (
                <section className="card">
                  <p className="subtitulo" style={{ marginBottom: 8 }}>Substituições</p>
                  {plano.substituicoes.map((s, k) => <p key={k} className="suave" style={{ margin: "4px 0" }}>{s}</p>)}
                </section>
              )}
              {Object.keys(plano.metasDiarias).length > 0 && (
                <section className="card">
                  <p className="subtitulo" style={{ marginBottom: 8 }}>Metas do plano</p>
                  <p className="suave num" style={{ margin: 0 }}>
                    {[
                      plano.metasDiarias.kcal && `${plano.metasDiarias.kcal} kcal`,
                      plano.metasDiarias.carboG && `${plano.metasDiarias.carboG} g carbo`,
                      plano.metasDiarias.proteinaG && `${plano.metasDiarias.proteinaG} g proteína`,
                      plano.metasDiarias.gorduraG && `${plano.metasDiarias.gorduraG} g gordura`,
                      plano.metasDiarias.aguaMl && `${formatarMl(plano.metasDiarias.aguaMl)} de água`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </section>
              )}
              {plano.observacoes && <p className="legenda" style={{ margin: "4px 4px 0" }}>{plano.observacoes}</p>}
              <button className="botao contorno" onClick={() => entrada.current?.click()}>
                <Icone nome="enviar" tamanho={18} /> Enviar plano novo
              </button>
            </>
          )}
          <p className="legenda" style={{ margin: "8px 4px" }}>Antes de enviar, corte ou apague nome, CPF e contatos: a IA só precisa das refeições.</p>
        </div>
      )}

      {etapa === "revisar" && rascunho && (
        <div className="pilha">
          <p className="suave" style={{ margin: 0 }}>Confira e ajuste. Nada é salvo até você tocar em Salvar.</p>
          {rascunho.refeicoes.map((r, k) => (
            <section key={k} className="card pilha" style={{ gap: 10 }}>
              <div className="linha">
                <select className="entrada cresce" value={r.tipo} onChange={(e) => mudarRefeicao(k, { tipo: e.target.value as TipoRefeicao })} aria-label="Refeição">
                  {ORDEM_REFEICOES.map((t) => <option key={t} value={t}>{NOMES_REFEICAO[t]}</option>)}
                </select>
                <input className="entrada" type="time" style={{ width: 120 }} value={r.horario} onChange={(e) => mudarRefeicao(k, { horario: e.target.value })} aria-label="Horário" />
              </div>
              {r.opcoes.map((o, j) => (
                <textarea
                  key={j}
                  className="entrada"
                  style={{ minHeight: 64 }}
                  value={o.descricao}
                  aria-label={`Opção ${j + 1}`}
                  onChange={(e) => mudarRefeicao(k, { opcoes: r.opcoes.map((x, i) => (i === j ? { descricao: e.target.value } : x)) })}
                />
              ))}
              <div className="linha">
                <button className="botao texto pequeno" onClick={() => mudarRefeicao(k, { opcoes: [...r.opcoes, { descricao: "" }] })}>+ Opção</button>
                <span className="cresce" />
                <button className="botao texto pequeno" style={{ color: "var(--erro)" }} onClick={() => setRascunho({ ...rascunho, refeicoes: rascunho.refeicoes.filter((_, j) => j !== k) })}>Remover</button>
              </div>
            </section>
          ))}
          <button className="botao contorno" onClick={() => setRascunho({ ...rascunho, refeicoes: [...rascunho.refeicoes, { tipo: "lanche_tarde", horario: "16:00", opcoes: [{ descricao: "" }] }] })}>
            + Refeição
          </button>
          <section className="card pilha" style={{ gap: 10 }}>
            <p className="subtitulo">Metas diárias do plano</p>
            <div className="grade-2">
              {([["kcal", "Calorias (kcal)"], ["carboG", "Carbo (g)"], ["proteinaG", "Proteína (g)"], ["gorduraG", "Gordura (g)"], ["aguaMl", "Água (ml)"]] as const).map(([c, rotulo]) => (
                <div key={c} className="campo">
                  <label htmlFor={`meta-${c}`}>{rotulo}</label>
                  <input
                    id={`meta-${c}`}
                    className="entrada num"
                    inputMode="numeric"
                    value={rascunho.metasDiarias[c] ?? ""}
                    onChange={(e) => setRascunho({ ...rascunho, metasDiarias: { ...rascunho.metasDiarias, [c]: parseInt(e.target.value, 10) || undefined } })}
                  />
                </div>
              ))}
            </div>
            <p className="legenda" style={{ margin: 0 }}>Ao salvar, elas viram as metas do app.</p>
          </section>
          <section className="card pilha" style={{ gap: 10 }}>
            <p className="subtitulo">Substituições (uma por linha)</p>
            <textarea className="entrada" value={rascunho.substituicoes.join("\n")} onChange={(e) => setRascunho({ ...rascunho, substituicoes: e.target.value.split("\n") })} />
          </section>
          <button className="botao cheio" style={{ minHeight: 56 }} onClick={salvar}><Icone nome="check" /> Salvar plano</button>
          <button className="botao texto" onClick={() => { setRascunho(null); setEtapa("ver"); }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
