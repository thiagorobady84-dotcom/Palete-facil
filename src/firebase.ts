import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suporta configurações nativas ou via variáveis de ambiente da Vercel
export const resolvedFirebaseConfig = {
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  firestoreDatabaseId:
    import.meta.env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

// CRITICAL: Must use firebaseConfig.firestoreDatabaseId if specified
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configurações do Google Auth Provider
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot per Firebase guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
    }
    return false;
  }
}

/**
 * Login via janela popup do Google
 */
export async function loginWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error('Google Sign In Error:', err);
    throw err;
  }
}

/**
 * Login alternativo via redirecionamento (útil para celulares ou navegadores com bloqueio rígido de popup)
 */
export async function loginWithGoogleRedirect() {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (err) {
    console.error('Google Sign In Redirect Error:', err);
    throw err;
  }
}

/**
 * Processa o resultado do redirecionamento se houver
 */
export async function checkRedirectResult() {
  try {
    return await getRedirectResult(auth);
  } catch (err) {
    console.error('Redirect result error:', err);
    throw err;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Logout error:', err);
    throw err;
  }
}

export interface ParsedAuthError {
  code: string;
  isUnauthorizedDomain: boolean;
  isPopupBlocked: boolean;
  currentDomain: string;
  projectId: string;
  settingsUrl: string;
  title: string;
  message: string;
  actionGuide?: string[];
}

/**
 * Analisa e traduz erros de autenticação do Firebase para diagnósticos claros e acionáveis
 */
export function parseAuthError(err: any): ParsedAuthError {
  const code = err?.code || (err instanceof Error ? err.name : 'unknown');
  const rawMessage = err?.message || String(err || '');
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = resolvedFirebaseConfig.projectId;
  const settingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('unauthorized-domain')) {
    return {
      code: 'auth/unauthorized-domain',
      isUnauthorizedDomain: true,
      isPopupBlocked: false,
      currentDomain,
      projectId,
      settingsUrl,
      title: 'Domínio da Vercel não autorizado no Firebase',
      message: `O Firebase bloqueou a autenticação porque o domínio "${currentDomain}" ainda não foi incluído na lista de domínios autorizados do seu projeto.`,
      actionGuide: [
        `1. Acesse o Firebase Console do seu projeto (${projectId}).`,
        `2. Vá em Authentication > Configurações (Settings) > Domínios autorizados (Authorized domains).`,
        `3. Clique em "Adicionar domínio" e cole o endereço: ${currentDomain}`,
        `4. Salve e tente fazer login novamente nesta tela (não precisa refazer o deploy na Vercel!).`,
      ],
    };
  }

  if (code === 'auth/popup-blocked' || rawMessage.includes('popup-blocked')) {
    return {
      code: 'auth/popup-blocked',
      isUnauthorizedDomain: false,
      isPopupBlocked: true,
      currentDomain,
      projectId,
      settingsUrl,
      title: 'Janela de login bloqueada pelo navegador',
      message:
        'O seu navegador ou celular bloqueou a janela pop-up do Google. Permita pop-ups para este site ou utilize o botão "Entrar com Redirecionamento".',
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      code: 'auth/popup-closed-by-user',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      currentDomain,
      projectId,
      settingsUrl,
      title: 'Login cancelado',
      message: 'A janela de autenticação do Google foi fechada antes de concluir o processo.',
    };
  }

  if (code === 'auth/cancelled-popup-request') {
    return {
      code: 'auth/cancelled-popup-request',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      currentDomain,
      projectId,
      settingsUrl,
      title: 'Tentativa concorrente',
      message: 'Uma nova solicitação de login foi disparada antes da anterior finalizar.',
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      code: 'auth/operation-not-allowed',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      currentDomain,
      projectId,
      settingsUrl,
      title: 'Provedor Google não habilitado',
      message:
        'O método de login com Google precisa estar ativado na aba "Sign-in method" do Firebase Authentication.',
    };
  }

  return {
    code,
    isUnauthorizedDomain: false,
    isPopupBlocked: false,
    currentDomain,
    projectId,
    settingsUrl,
    title: 'Erro na autenticação com Google',
    message: rawMessage || 'Ocorreu um erro ao tentar conectar com a conta Google.',
  };
}
