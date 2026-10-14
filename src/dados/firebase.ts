// ==============================================
// Firebase: inicialização única e preguiçosa
// ==============================================
// Só roda quando o app usa os dados de verdade. No modo demonstração
// (`npm run demo`) nada daqui é chamado, então dá para ver as telas sem
// nenhuma configuração.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from "firebase/app-check";

export interface Firebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  google: GoogleAuthProvider;
  config: { apiKey: string; projectId: string };
}

let instancia: Firebase | null = null;

export function firebase(): Firebase {
  if (instancia) return instancia;

  const env = import.meta.env;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY as string,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: env.VITE_FIREBASE_APP_ID as string,
  };

  // Falha cedo e com nome: uma variável esquecida vira, lá na frente, um erro
  // de login confuso e longe da causa.
  const faltando = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (faltando.length > 0) {
    throw new Error(`Config do Firebase incompleta: ${faltando.join(", ")}. Confira o .env (veja .env.example).`);
  }

  const app = initializeApp(config);

  // App Check prova para o Google que quem chama a IA é o seu app, e não um
  // script qualquer com a sua chave. Obrigatório no AI Logic a partir de
  // 02/11/2026. No computador (npm run dev) usa o token de depuração, que
  // aparece no console e se cadastra no Firebase → App Check → Apps.
  const v3 = env.VITE_RECAPTCHA_V3_KEY as string | undefined;
  const enterprise = env.VITE_RECAPTCHA_ENTERPRISE_KEY as string | undefined;
  if (v3 || enterprise) {
    if (env.DEV) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    initializeAppCheck(app, {
      provider: enterprise ? new ReCaptchaEnterpriseProvider(enterprise) : new ReCaptchaV3Provider(v3!),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const google = new GoogleAuthProvider();
  google.setCustomParameters({ prompt: "select_account" });

  // Cache em disco: o app abre mostrando os dados mesmo sem sinal e grava
  // offline, sincronizando quando a internet volta.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  instancia = { app, auth: getAuth(app), db, google, config: { apiKey: config.apiKey, projectId: config.projectId } };
  return instancia;
}
