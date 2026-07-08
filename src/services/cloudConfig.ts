// Secure LocalStorage & Environment Variable Config Manager for Gemini & Firebase

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface CloudConfigState {
  geminiApiKey: string;
  firebaseConfig: FirebaseConfig;
  useLiveFirebase: boolean;
}

const CONFIG_STORAGE_KEY = 'peoples_priorities_cloud_config_v1';

export function getCloudConfig(): CloudConfigState {
  // 1. Check Vercel / Vite environment variables first
  const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const envFirebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
  const envFirebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';

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

  const geminiApiKey = savedConfig.geminiApiKey || envGeminiKey || '';
  const firebaseConfig: FirebaseConfig = {
    apiKey: savedConfig.firebaseConfig?.apiKey || envFirebaseApiKey || '',
    authDomain: savedConfig.firebaseConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: savedConfig.firebaseConfig?.projectId || envFirebaseProjectId || '',
    storageBucket: savedConfig.firebaseConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: savedConfig.firebaseConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: savedConfig.firebaseConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
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
