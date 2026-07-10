// Secure LocalStorage & Environment Variable Config Manager for Gemini & Firebase

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
}

export interface CloudConfigState {
  geminiApiKey: string;
  firebaseConfig: FirebaseConfig;
  useLiveFirebase: boolean;
}

const CONFIG_STORAGE_KEY = 'peoples_priorities_cloud_config_v1';

export function getCloudConfig(): CloudConfigState {
  // 1. Check Vercel / Vite environment variables first, otherwise use local storage or offline AI engine
  const defaultGeminiKey = '';
  const defaultFirebase = {
    apiKey: 'AIzaSyC2Qufkje5ySeQut5ht7RKBDZTbfZvNrw0',
    authDomain: 'peoples-priorities-cloud.firebaseapp.com',
    projectId: 'peoples-priorities-cloud',
    storageBucket: 'peoples-priorities-cloud.firebasestorage.app',
    messagingSenderId: '470632059939',
    appId: '1:470632059939:web:8a5490234d70e072bc0d96',
    databaseURL: 'https://peoples-priorities-cloud-default-rtdb.firebaseio.com',
  };

  const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY || defaultGeminiKey;

  // 2. Check localStorage for user overrides in the live web UI
  let savedConfig: Partial<CloudConfigState> = {};
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      savedConfig = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse cloud config from storage', e);
  }

  const geminiApiKey = savedConfig.geminiApiKey || envGeminiKey;
  const projectId = savedConfig.firebaseConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebase.projectId;
  const firebaseConfig: FirebaseConfig = {
    apiKey: savedConfig.firebaseConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebase.apiKey,
    authDomain: savedConfig.firebaseConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebase.authDomain,
    projectId: projectId,
    storageBucket: savedConfig.firebaseConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebase.storageBucket,
    messagingSenderId: savedConfig.firebaseConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebase.messagingSenderId,
    appId: savedConfig.firebaseConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebase.appId,
    databaseURL: savedConfig.firebaseConfig?.databaseURL || import.meta.env.VITE_FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : defaultFirebase.databaseURL),
  };

  const useLiveFirebase = Boolean(
    savedConfig.useLiveFirebase !== undefined
      ? savedConfig.useLiveFirebase
      : firebaseConfig.apiKey && firebaseConfig.projectId
  );

  return {
    geminiApiKey,
    firebaseConfig,
    useLiveFirebase,
  };
}

export function saveCloudConfig(config: CloudConfigState): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event('cloudConfigChanged'));
  } catch (e) {
    console.error('Failed to save cloud config', e);
  }
}

export function hasValidGeminiKey(): boolean {
  const config = getCloudConfig();
  return Boolean(config.geminiApiKey && config.geminiApiKey.length > 15 && config.geminiApiKey.startsWith('AIza'));
}

export function hasValidFirebaseConfig(): boolean {
  const config = getCloudConfig();
  return Boolean(config.firebaseConfig.apiKey && config.firebaseConfig.projectId && config.useLiveFirebase);
}
