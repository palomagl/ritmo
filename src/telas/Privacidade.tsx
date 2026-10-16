import { Link, voltar } from "@/app/rota";
import { Icone, type NomeIcone } from "@/componentes/Icone";

const SECOES: { icone: NomeIcone; cor: string; titulo: string; texto: string[] }[] = [
  {
    icone: "escudo",
    cor: "passos",
    titulo: "Seus dados são só seus",
    texto: [
      "Você entra com a sua conta do Google e tudo o que registra fica guardado na sua conta: refeições e fotos, plano alimentar, peso e medidas, água e corridas.",
      "As regras do banco de dados só deixam a dona da conta ler e mudar esses dados. Outra pessoa que usa o ritmo não vê nada seu, nem você o dela.",
      "Os dados ficam no Firebase, do Google, em servidores em São Paulo, com conexão criptografada.",
    ],
  },
  {
    icone: "brilho",
    cor: "pulso",
    titulo: "O que vai para a IA",
    texto: [
      "Quando você pede uma análise (foto do prato, descrição, plano alimentar, laudo, resumo da semana), só aquilo vai para o Gemini, a IA do Google. Seu nome e e-mail não vão junto.",
      "O ritmo usa o plano gratuito do Gemini. Nele, o Google pode usar o que é enviado para melhorar os produtos dele, e pessoas da equipe do Google podem revisar trechos, sem ligação com a sua conta.",
      "Por isso: antes de mandar o PDF do plano ou um laudo, corte nome, CPF, endereço e telefone. A IA só precisa das refeições e dos números.",
    ],
  },
  {
    icone: "sino",
    cor: "pulso",
    titulo: "Notificações",
    texto: [
      "As notificações saem do servidor do ritmo, que olha só o necessário: água do dia, horários do plano e as refeições registradas.",
    ],
  },
  {
    icone: "baixar",
    cor: "agua",
    titulo: "Você manda nos seus dados",
    texto: [
      "Baixar uma cópia de tudo, sair de todos os aparelhos e apagar a conta ficam em Perfil → Privacidade e segurança.",
      "Apagar a conta apaga todos os dados do ritmo na hora, sem volta.",
      "Ao sair, o app também apaga a cópia que guardava no aparelho para funcionar offline.",
    ],
  },
  {
    icone: "corpo",
    cor: "corpo",
    titulo: "Quem cuida do app",
    texto: [
      "O ritmo é um app pessoal, mantido por uma pessoa, não por uma empresa. Quem administra o projeto no Google tem acesso técnico ao banco, como em qualquer app. Use o ritmo com quem você confia.",
      "As contas e estimativas do app (calorias, porções, metas) são um apoio, não substituem nutricionista ou médico.",
    ],
  },
];

/** Como os dados são guardados e protegidos. Abre também sem login. */
export default function Privacidade() {
  return (
    <main className="app sem-barra">
      <header className="topo">
        <button className="botao-icone liso" onClick={() => voltar("/")} aria-label="Voltar">
          <Icone nome="voltar" />
        </button>
        <h1 className="titulo">Privacidade</h1>
      </header>
      <p className="suave" style={{ margin: "0 2px 18px" }}>
        Em poucas palavras: o que o ritmo guarda, quem vê e o que vai para a IA.
      </p>
      <div className="pilha" style={{ gap: 14 }}>
        {SECOES.map((s) => (
          <section key={s.titulo} className={`card cor-${s.cor}`}>
            <div className="card-cabeca">
              <span className="selo-icone"><Icone nome={s.icone} tamanho={18} /></span>
              <p className="subtitulo">{s.titulo}</p>
            </div>
            <div className="pilha" style={{ gap: 8 }}>
              {s.texto.map((t) => (
                <p key={t} style={{ margin: 0, lineHeight: "23px" }}>{t}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Link para="/" className="botao cheio" style={{ marginTop: 20, width: "100%" }}>
        Entendi
      </Link>
    </main>
  );
}
