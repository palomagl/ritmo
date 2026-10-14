import { useState } from "react";
import { dados, MODO_DEMO } from "@/dados";
import { MEDIDA_INICIAL, METAS_NUTRI, PLANO_PALOMA } from "@/dados/paloma";
import { useEstado } from "@/app/estado";
import { navegar } from "@/app/rota";
import { Icone, Marca } from "@/componentes/Icone";

/** Primeiro acesso, em 3 passos curtos. Tudo dá para mudar depois no Perfil. */
export default function BoasVindas() {
  const { perfil, usuario, plano } = useEstado();
  const [passo, setPasso] = useState(1);
  const [altura, setAltura] = useState(perfil?.alturaCm ? String(perfil.alturaCm) : "");
  const [peso, setPeso] = useState(perfil?.pesoKg ? String(perfil.pesoKg) : "");
  const [nascimento, setNascimento] = useState(perfil?.nascimento ?? "");
  const pesoN = parseFloat(peso.replace(",", "."));
  // Referência comum de partida: ~35 ml por kg. Arredonda em 100 ml.
  const aguaSugerida = Number.isFinite(pesoN) && pesoN > 30 ? Math.round((pesoN * 35) / 100) * 100 : 2000;
  const [passos, setPassos] = useState(String(perfil?.metas.passos ?? 8000));
  const [agua, setAgua] = useState<string | null>(null);

  const concluir = async (irParaPlano: boolean) => {
    // Primeiro acesso sem plano: já entra o plano da nutricionista, a meta de
    // 1.500 kcal e a bioimpedância (ver dados/paloma.ts).
    const semPlano = plano === null && !MODO_DEMO;
    if (semPlano) {
      await dados.salvarPlano({ ...PLANO_PALOMA, atualizadoEm: Date.now() });
      await dados.salvarMedida(MEDIDA_INICIAL);
    }
    const metas = {
      ...perfil!.metas,
      ...(semPlano ? METAS_NUTRI : {}),
      passos: Math.max(1000, parseInt(passos, 10) || 8000),
      aguaMl: Math.max(500, parseInt(agua ?? String(aguaSugerida), 10) || aguaSugerida),
    };
    await dados.salvarPerfil({
      nome: perfil?.nome || usuario?.nome || "",
      alturaCm: parseInt(altura, 10) || null,
      pesoKg: Number.isFinite(pesoN) ? pesoN : null,
      nascimento: nascimento || null,
      metas,
      boasVindasFeitas: true,
    });
    navegar(irParaPlano ? "/comer/plano" : "/", { substituir: true });
  };

  return (
    <main className="app sem-barra">
      <div className="linha entre" style={{ margin: "8px 0 28px" }}>
        <div className="marca" style={{ width: 48, height: 48, borderRadius: 16, margin: 0 }}>
          <Marca tamanho={30} />
        </div>
        <span className="legenda">Passo {passo} de 3</span>
      </div>

      {passo === 1 && (
        <section className="pilha">
          <h1 className="titulo">Oi, {(perfil?.nome || usuario?.nome || "").split(" ")[0]}! Vamos começar.</h1>
          <p className="suave" style={{ margin: 0 }}>
            Três dados rápidos para as contas do app (água, calorias da corrida). Pode pular o que quiser.
          </p>
          <div className="campo">
            <label htmlFor="altura">Altura (cm)</label>
            <input id="altura" className="entrada" inputMode="numeric" placeholder="165" value={altura} onChange={(e) => setAltura(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="peso">Peso (kg)</label>
            <input id="peso" className="entrada" inputMode="decimal" placeholder="65,0" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="nasc">Data de nascimento</label>
            <input id="nasc" className="entrada" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
          </div>
          <button className="botao cheio" style={{ marginTop: 12 }} onClick={() => setPasso(2)}>
            Continuar
          </button>
        </section>
      )}

      {passo === 2 && (
        <section className="pilha">
          <h1 className="titulo">Suas metas do dia</h1>
          <p className="suave" style={{ margin: 0 }}>Uma sugestão para começar. Se o seu plano alimentar trouxer outras, ele manda.</p>
          <div className="card cor-passos">
            <div className="card-cabeca">
              <span className="selo-icone"><Icone nome="pegadas" tamanho={18} /></span>
              <span className="subtitulo">Passos</span>
            </div>
            <input className="entrada num" inputMode="numeric" value={passos} onChange={(e) => setPassos(e.target.value)} aria-label="Meta de passos" />
          </div>
          <div className="card cor-agua">
            <div className="card-cabeca">
              <span className="selo-icone"><Icone nome="gota" tamanho={18} /></span>
              <span className="subtitulo">Água (ml)</span>
            </div>
            <input className="entrada num" inputMode="numeric" value={agua ?? String(aguaSugerida)} onChange={(e) => setAgua(e.target.value)} aria-label="Meta de água em ml" />
            <p className="legenda" style={{ margin: "8px 0 0" }}>Sugestão pelo seu peso (≈35 ml por kg). Vale confirmar com quem te acompanha.</p>
          </div>
          <div className="linha" style={{ marginTop: 12 }}>
            <button className="botao secundario" onClick={() => setPasso(1)}>Voltar</button>
            <button className="botao cresce" onClick={() => setPasso(3)}>Continuar</button>
          </div>
        </section>
      )}

      {passo === 3 && (
        <section className="pilha">
          <h1 className="titulo">Seu plano alimentar</h1>
          <p className="suave" style={{ margin: 0 }}>
            Mande o PDF ou fotos do plano da nutricionista. A IA organiza em refeições e horários, e as fotos do prato passam a ser comparadas com ele.
          </p>
          <div className="card cor-comida linha" style={{ alignItems: "flex-start" }}>
            <span className="selo-icone"><Icone nome="enviar" tamanho={18} /></span>
            <p className="legenda" style={{ margin: 0 }}>
              Antes de enviar, corte ou apague nome, CPF e contatos. A IA só precisa das refeições.
            </p>
          </div>
          <button className="botao cheio" style={{ marginTop: 12 }} onClick={() => concluir(true)}>
            Enviar meu plano agora
          </button>
          <button className="botao texto cheio" onClick={() => concluir(false)}>
            Pular por enquanto
          </button>
        </section>
      )}
    </main>
  );
}
