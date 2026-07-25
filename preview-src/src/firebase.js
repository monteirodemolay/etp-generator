// Inicialização do Firebase.
//
// Estas credenciais são públicas por natureza — ficam visíveis no código de qualquer
// site que use Firebase. A proteção real vem das Regras de Segurança do Firestore,
// que definem quem pode ler e gravar. Sem elas, o banco fica aberto.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAa7sSUfiQWLfrs6zWYC9QGKFhzJ1xr7RY",
  authDomain: "gerador-de-etp.firebaseapp.com",
  projectId: "gerador-de-etp",
  storageBucket: "gerador-de-etp.firebasestorage.app",
  messagingSenderId: "768241796403",
  appId: "1:768241796403:web:f963a0b016255e1266aa46",
  measurementId: "G-7D8ZBEVE5W",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Cache local persistente: o app continua funcionando se a internet cair no meio do
// trabalho, e sincroniza sozinho quando a conexão volta.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});
