<div align="center">

<img src="public/favicon.svg" width="88" alt="ritmo" />

# ritmo

### Saúde do dia a dia num app só: passos, água, comida com IA, corpo e corridas.

**Beba água. Cuide do seu ritmo.**

[![Abrir o ritmo](https://img.shields.io/badge/▶_Abrir_o_ritmo-6366F1?style=for-the-badge)](https://ritmo-tau-inky.vercel.app/)

![React](https://img.shields.io/badge/React-20232a?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=flat-square&logo=firebase&logoColor=white)
![Gemini](https://img.shields.io/badge/IA-Gemini-8E75B2?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-instalável-3B82F6?style=flat-square)

<br />

![O ritmo no computador e no celular](docs/hero.png)

</div>

## O problema

Quem segue um plano alimentar e tenta se mexer mais acaba com cinco apps abertos: um para a água, um para os passos, outro para contar calorias, uma planilha para o peso e o PDF da nutricionista perdido no WhatsApp. Nenhum conversa com o outro, e anotar tudo vira trabalho.

## A solução

O **ritmo** junta tudo numa tela só e tira o trabalho do caminho:

- **Uma foto do prato** e a IA lista os alimentos, estima porções, calorias e macros, e diz se a refeição está dentro do seu plano.
- **O plano da nutricionista vira o app.** Mande o PDF ou fotos: a IA organiza as refeições por horário, com as opções de substituição, e as metas do plano passam a ser as metas do dia.
- **Os passos chegam sozinhos** do app Saúde do iPhone, várias vezes ao dia.
- **Água em um toque**, com o ritmo do dia: o app sabe se você está atrasada para a meta, e quanto.
- **Corpo com contexto**: peso, gordura, músculo e água corporal com gráfico, e uma balança para anotar o peso em segundos.

Tudo isso com a cara de um app nativo: instala na tela inicial do iPhone, abre em tela cheia e funciona offline.

<div align="center">

![Telas do ritmo no celular](docs/telas.png)

</div>

## Funcionalidades

### Hoje
O painel do dia. A **linha do tempo** mostra do acordar ao dormir, com um ponto colorido para cada registro e um marcador no agora. Logo abaixo, passos, água e comida com barras de progresso, um **lembrete inteligente** ("Faltam **900 ml** para ficar no ritmo da água") e a próxima refeição do plano.

### Comer
- **Foto do prato** com análise por IA e revisão das porções antes de salvar.
- **Descrever em texto** ("2 ovos e 1 pão francês") quando não dá para fotografar.
- **Perguntar**: dúvidas rápidas respondidas com base no seu plano ("posso trocar arroz por batata?").
- **Pratos frequentes** com um toque, e fotos sem internet que esperam na fila para analisar depois.

### Mover
- **Passos** do dia, da semana e do mês, com média, melhor dia e sequência na meta.
- **Corrida com GPS**: mapa da rota, pace atual e médio, parciais por km, recordes e importação de GPX. A tela fica acesa durante a corrida.

### Corpo
- **Balança**: anote o peso com um toque e veja a variação.
- **Bioimpedância**: tire foto do laudo e a IA preenche peso, gordura, músculo e água.
- **Pontos de atenção** a partir das suas metas, que a IA leva em conta nas dicas de comida.

### Água
Copos personalizados, desfazer, histórico de 7 e 30 dias e sequência de dias na meta.

## Design

Vidro fosco sobre luz azul difusa, tipografia Inter, azul e azul-violeta como marca e uma cor por área (verde para passos, azul para água, laranja para comida, violeta para o corpo).

- **Celular:** barra de navegação flutuante, botão central para registrar qualquer coisa.
- **Notebook e PC:** navegação lateral e o Hoje vira um painel em colunas.
- **Claro e escuro**, seguindo o sistema ou escolhido no Perfil.
- Ícone e telas de abertura próprios para o iPhone.

## Privacidade

- Cada pessoa só enxerga os próprios dados: as regras do banco bloqueiam qualquer acesso que não seja o da dona da conta.
- A IA é protegida por **App Check**: só o app publicado consegue usá-la.
- O token dos passos é pessoal, pode ser trocado a qualquer momento e só grava os passos do dia.

## Como é feito

| Camada | Escolha |
| --- | --- |
| Interface | React 18 · Vite · TypeScript · CSS próprio, sem framework visual |
| App instalável | PWA com cache offline e telas de abertura do iOS |
| Login | Firebase Authentication (Google) |
| Banco | Cloud Firestore com cache offline |
| IA | Firebase AI Logic + Gemini, respostas em JSON por schema, troca de modelo automática se um estiver lotado |
| Proteção | App Check com Fraud Defense (reCAPTCHA Enterprise) |
| Passos | Atalho do iPhone → função serverless `/api/passos` |
| Mapa | Leaflet + OpenStreetMap, com desenho em SVG quando não há internet |
| Hospedagem | Vercel |

As contas (distância por Haversine, filtro de GPS, parciais, ritmo da água, sequências, porções, pontos de atenção e o lembrete do dia) são funções puras em `src/lib`, cada uma com teste.

```
api/            função que recebe os passos do Atalho
src/
  app/          estado global, rotas e ações compartilhadas
  componentes/  linha do dia, balança, gráficos, mapa, navegação, ícones
  dados/        Firestore e o modo demonstração (mesma interface)
  ia/           prompts e chamadas ao Gemini
  lib/          as contas, cada uma com teste
  telas/        uma tela por arquivo
```

## Rodar no computador

```bash
npm install
npm run demo   # dados de exemplo, sem configurar nada
npm run dev    # com o Firebase de verdade (precisa do .env)
```

| Comando | Para quê |
| --- | --- |
| `npm run demo` | Ver todas as telas com uma semana de dados de exemplo |
| `npm run dev` | Rodar com Firebase, login e IA |
| `npm run build` | Gerar a versão de produção |
| `npm test` | Rodar os testes |
| `npm run typecheck` | Checar os tipos |
| `npm run icones` | Regerar ícones e telas de abertura a partir de `public/logo.svg` |

## Publicar

### Firebase
1. Crie o projeto, ative **Authentication → Google** e crie o **Firestore** (edição Standard, `southamerica-east1`).
2. Cole o conteúdo de `firestore.rules` na aba **Regras** do Firestore e publique.
3. **AI Logic → Começar → Gemini Developer API** (funciona no plano grátis).
4. **App Check → Apps →** registre o app web com **Fraud Defense** usando a chave de site do reCAPTCHA (criada em Google Cloud → Segurança → reCAPTCHA, tipo Web, sem desafio de caixa).
5. **Authentication → Configurações → Domínios autorizados:** adicione o domínio da Vercel.

### Google Cloud
Em **APIs e serviços → Credenciais → Web client (auto created by Google Service)**, adicione o domínio em *Origens JavaScript autorizadas* e `https://SEU-DOMINIO/__/auth/handler` em *URIs de redirecionamento autorizados*.

### Vercel
Importe o repositório (framework **Vite**) e cadastre as variáveis do `.env.example`:

| Variável | Valor |
| --- | --- |
| `VITE_FIREBASE_*` | A config do app web do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | O domínio da **Vercel** (não o `firebaseapp.com`): é o que faz o login funcionar no app instalado no iPhone |
| `VITE_RECAPTCHA_ENTERPRISE_KEY` | A chave de site usada no App Check |
| `VITE_GEMINI_MODEL` | Opcional. Padrão `gemini-3.5-flash-lite`, com `gemini-3.5-flash` de reserva |

O `vercel.json` encaminha `/__/auth` para o `firebaseapp.com` do projeto. Se trocar de projeto Firebase, troque ali também.

### Passos do iPhone
No app, **Perfil → Passos do iPhone** mostra o endereço e o token para copiar. O Atalho tem só três ações: *Localizar Amostras de Saúde* (Passos, hoje), *Calcular Estatísticas* (Soma) e *Obter Conteúdo do URL* (POST, JSON com `passos` e `token`). Uma automação por horário faz o resto.

## Próximos passos

- Lembretes de água e de refeição por notificação.
- Resumo semanal com o que melhorou e o que vale ajustar.
- Compartilhar o progresso com a nutricionista.
- Planos para mais de uma pessoa (hoje o app é pessoal).

---

<div align="center">

**ritmo** · pequenos hábitos, grandes resultados.

© 2026 Paloma Lorenzon. Todos os direitos reservados.

</div>
