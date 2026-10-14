<div align="center">

# Ritmo

### Seu corpo, no seu ritmo: passos, corridas, comida com IA, água e corpo num app só.

![React](https://img.shields.io/badge/React-20232a?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=flat-square&logo=firebase&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-AI_Logic-8E75B2?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-instalável-FF5A4E?style=flat-square)

![Telas do Ritmo](docs/telas.png)

</div>

## O que tem dentro

| Módulo | O que faz |
| --- | --- |
| **Hoje** | 3 anéis (passos, água, comida), a frase útil do dia, água em 1 toque, a próxima refeição do plano e a última corrida. |
| **Passos** | Total do dia, semana e mês com a meta, média, melhor dia e sequência. Vêm do app Saúde por um Atalho do iPhone. |
| **Corrida** | GPS com mapa, tempo, pace atual e médio, pausa, parciais por km, recordes e importação de GPX. A tela fica acesa durante a corrida. |
| **Comer** | Foto do prato → a IA lista os alimentos, estima calorias e macros e compara com o seu plano. Você corrige as porções antes de salvar. Também dá para descrever em texto, perguntar e salvar pratos frequentes. |
| **Meu plano** | Mande o PDF ou as fotos do plano da nutricionista: a IA organiza por refeição e horário, e as metas do plano viram as metas do app. |
| **Água** | Copos personalizados, desfazer, ritmo do dia e sequência. Ao bater a meta, marca o hábito no **Minha Rotina**. |
| **Corpo** | Peso, gordura, água corporal, músculo e cintura com gráfico e meta. Gera os pontos de atenção que a IA usa nas dicas. |

Funciona offline (registra sem internet e sincroniza depois) e tem tema claro e escuro.

## Ver as telas agora (sem configurar nada)

```bash
npm install
npm run demo
```

Abre em `http://localhost:5180` com uma semana de dados de exemplo e a IA simulada.

## Três jeitos de rodar

| Modo | Como | Dados |
| --- | --- | --- |
| **Publicado** | Vercel + Firebase (abaixo) | Firestore, login Google, IA Gemini, passos do iPhone |
| **Demo** | `npm run demo` | Exemplo, no navegador |
| **Pessoal no Claude** | build com `--mode pessoal`, publicado como página do Claude | Na conta do Claude, IA do Claude |

No primeiro acesso do modo publicado, o plano da nutricionista, a meta de 1.500 kcal e a bioimpedância de 01/10 entram sozinhos (`src/dados/paloma.ts`).

## Colocar no ar

### 1. Firebase

**Recomendado: usar o mesmo projeto do Minha Rotina** (`minha-rotina-4524d`). O login já funciona, as regras já protegem tudo embaixo de `users/{uid}`, e o Ritmo consegue marcar o hábito de água lá. O Ritmo grava em coleções próprias (`pulsoDias`, `pulsoRefeicoes`, `pulsoPlano`, `pulsoFavoritos`, `pulsoCorridas`, `pulsoMedidas`) e no campo `pulso` do perfil, então nada colide.

Se preferir um projeto separado: crie o projeto, ative **Authentication → Google**, crie o **Firestore** (`southamerica-east1`), publique o `firestore.rules` e troque o domínio no `vercel.json`.

### 2. IA (Gemini pelo Firebase AI Logic)

1. Console do Firebase → **AI Logic** → Começar → **Gemini Developer API** (grátis, plano Spark).
2. **App Check** (obrigatório para a IA a partir de 02/11/2026): Console → App Check → registre o app web com **reCAPTCHA v3** (grátis) ou reCAPTCHA Enterprise e cole a chave do site em `VITE_RECAPTCHA_V3_KEY` (ou `VITE_RECAPTCHA_ENTERPRISE_KEY`). Depois, em App Check → APIs → Firebase AI Logic, clique em **Aplicar**.
3. Para testar no computador com o App Check ligado: rode `npm run dev`, copie o token de depuração que aparece no console do navegador e cadastre em App Check → Apps → Gerenciar tokens de depuração.

O modelo vem de `VITE_GEMINI_MODEL` (padrão `gemini-3.8-flash`). Quando o Google aposentar um modelo, troque a variável na Vercel e publique de novo.

> No nível grátis, o Google pode usar o que é enviado à IA para melhorar os produtos dele. Foto de prato tudo bem; no plano alimentar, apague nome, CPF e contatos; o laudo de bioimpedância dá para digitar em vez de mandar a foto.

### 3. Vercel

1. Suba a pasta para um repositório `ritmo` no GitHub e importe na Vercel (Framework: Vite).
2. Em **Settings → Environment Variables**, cadastre as variáveis do `.env.example`. Em `VITE_FIREBASE_AUTH_DOMAIN` use o domínio do Ritmo na Vercel (ex.: `ritmo-paloma.vercel.app`): o `vercel.json` encaminha `/__/auth` para o Firebase, que é o que faz o login funcionar no app da tela inicial do iPhone.
3. No Firebase: **Authentication → Settings → Authorized domains** → adicione o domínio do Ritmo.
4. No Google Cloud (APIs e serviços → Credenciais → o cliente OAuth "Web client (auto created by Google Service)"): adicione `https://SEU-DOMINIO/__/auth/handler` em **URIs de redirecionamento autorizados**.
5. Abra no Safari do iPhone → Compartilhar → **Adicionar à Tela de Início**.

### 4. Passos do iPhone

No app: **Perfil → Passos do iPhone**. O passo a passo do Atalho está lá, com os valores prontos para copiar. O Atalho lê o app Saúde e grava pela API REST do Firestore entrando com o seu próprio token, então as regras de segurança continuam valendo.

## Como é feito

| Camada | Escolha |
| --- | --- |
| Frontend | React · Vite · TypeScript · CSS próprio (sem framework) |
| Login | Firebase Auth (Google), redirect no celular |
| Banco | Cloud Firestore com cache offline |
| IA | Firebase AI Logic + Gemini, com resposta em JSON por schema |
| Mapa | Leaflet + OpenStreetMap (e um desenho em SVG quando não há internet) |
| Deploy | Vercel |

As contas (distância por Haversine, filtro de GPS, parciais, ritmo da água, sequências, porções, pontos de atenção, insight do dia) moram em funções puras em `src/lib`, testadas com `npm test`.

```
src/
  app/          estado global, rotas, ações compartilhadas
  componentes/  anel, gráficos, mapa, barra inferior, ícones
  dados/        Firestore de verdade e o modo demonstração (mesma interface)
  ia/           prompts e a chamada ao Gemini
  lib/          as contas, cada uma com teste
  telas/        uma tela por arquivo
```

## Comandos

| Comando | Para quê |
| --- | --- |
| `npm run dev` | Rodar com o Firebase de verdade |
| `npm run demo` | Rodar com dados de exemplo |
| `npm run build` | Gerar a versão de produção |
| `npm test` | Rodar os testes |
| `npm run typecheck` | Checar os tipos |
| `npm run icones` | Regerar ícones e telas de abertura a partir de `public/logo.svg` |
