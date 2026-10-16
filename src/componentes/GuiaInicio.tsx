import { useEffect, useState } from "react";
import { dados, MODO_DEMO, type Dia, type Medida, type Perfil, type Plano } from "@/dados";
import { navegar } from "@/app/rota";
import { METAS_PADRAO } from "@/dados/padroes";
import { situacaoAvisos, type SituacaoAvisos } from "@/lib/avisos";
import { Folha } from "./basicos";
import { Icone } from "./Icone";

interface Passo {
  id: string;
  titulo: string;
  texto: string;
  feito: boolean;
  ir: () => void;
}

const ehIPhone = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const ehCelular = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const instalado = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * "Comece por aqui": os primeiros passos de quem acabou de entrar, cada um
 * levando direto para onde se faz. Some quando tudo está feito ou quando a
 * pessoa fecha.
 */
export function GuiaInicio({ perfil, plano, dias, medidas }: { perfil: Perfil; plano: Plano | null | undefined; dias: Dia[] | undefined; medidas: Medida[] | undefined }) {
  const [avisos, setAvisos] = useState<SituacaoAvisos | null>(null);
  const [comoInstalar, setComoInstalar] = useState(false);

  useEffect(() => {
    void situacaoAvisos().then(setAvisos, () => setAvisos("sem-suporte"));
  }, []);

  if (perfil.guiaInicioOculto || plano === undefined || !dias || !medidas || avisos === null) return null;

  const passos: Passo[] = [];
  if (ehCelular() && !MODO_DEMO) {
    passos.push({
      id: "instalar",
      titulo: "Instale o ritmo na tela de início",
      texto: "Abre em tela cheia, como um app, e libera as notificações.",
      feito: instalado(),
      ir: () => setComoInstalar(true),
    });
  }
  passos.push(
    {
      id: "plano",
      titulo: "Envie seu plano ou calcule suas calorias",
      texto: "Com a meta certa, cada prato é comparado com ela.",
      feito: Boolean(plano) || perfil.metas.kcal !== METAS_PADRAO.kcal,
      ir: () => navegar("/comer/plano"),
    },
    {
      id: "refeicao",
      titulo: "Registre a primeira refeição",
      texto: "Uma foto do prato e a IA faz as contas.",
      feito: dias.some((d) => (d.kcal ?? 0) > 0),
      ir: () => navegar("/comer/foto"),
    },
    {
      id: "peso",
      titulo: "Anote seu peso",
      texto: "Para acompanhar a evolução semana a semana.",
      feito: medidas.length > 0,
      ir: () => navegar("/corpo?registrar=1"),
    }
  );
  if (avisos !== "sem-suporte" && avisos !== "demo" && avisos !== "indisponivel") {
    passos.push({
      id: "lembretes",
      titulo: "Ative os lembretes",
      texto: avisos === "instalar" ? "Depois de instalar o app, em Perfil → Lembretes." : "Água e refeições na hora certa, mesmo com o app fechado.",
      feito: avisos === "ligado",
      ir: () => navegar("/perfil"),
    });
  }

  const feitos = passos.filter((p) => p.feito).length;
  if (feitos === passos.length) return null;

  return (
    <section className="card cor-pulso guia-inicio area-guia" aria-label="Comece por aqui">
      <div className="linha entre">
        <div>
          <p className="subtitulo">Comece por aqui</p>
          <p className="legenda" style={{ margin: 0 }}>
            {feitos} de {passos.length} feitos
          </p>
        </div>
        <button className="botao-icone liso" aria-label="Fechar o guia" onClick={() => dados.salvarPerfil({ guiaInicioOculto: true })}>
          <Icone nome="fechar" tamanho={18} />
        </button>
      </div>
      <div className="guia-barra" aria-hidden="true">
        <span style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>
      <div className="guia-lista">
        {passos.map((p) => (
          <button key={p.id} className={`guia-passo${p.feito ? " feito" : ""}`} onClick={p.ir} disabled={p.feito}>
            <span className="guia-check" aria-hidden="true">{p.feito && <Icone nome="check" tamanho={14} strokeWidth={3} />}</span>
            <span className="cresce">
              <b>{p.titulo}</b>
              {!p.feito && (
                <>
                  <br />
                  <span className="legenda">{p.texto}</span>
                </>
              )}
            </span>
            {!p.feito && <Icone nome="seta" tamanho={16} className="suave" />}
          </button>
        ))}
      </div>

      <Folha aberta={comoInstalar} aoFechar={() => setComoInstalar(false)} titulo="Instalar na tela de início">
        <div className="pilha">
          {ehIPhone() ? (
            <ol style={{ paddingLeft: 20, margin: 0, display: "grid", gap: 10 }}>
              <li>Abra o ritmo no <b>Safari</b>.</li>
              <li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
              <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
              <li>Abra o ritmo pelo ícone novo. Daqui em diante, use sempre por ele.</li>
            </ol>
          ) : (
            <ol style={{ paddingLeft: 20, margin: 0, display: "grid", gap: 10 }}>
              <li>Abra o ritmo no <b>Chrome</b>.</li>
              <li>Toque no menu <b>⋮</b> e escolha <b>Instalar app</b> (ou Adicionar à tela inicial).</li>
              <li>Abra o ritmo pelo ícone novo.</li>
            </ol>
          )}
          <button className="botao cheio" onClick={() => setComoInstalar(false)}>Entendi</button>
        </div>
      </Folha>
    </section>
  );
}
