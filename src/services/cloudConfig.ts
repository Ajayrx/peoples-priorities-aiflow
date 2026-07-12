/**
 * Firebase Web SDK Configuration Manager
 *
 * SECURITY MODEL:
 *  - VITE_FIREBASE_* variables: Firebase Web SDK config (public by design — they are client identifiers, not secrets)
 *  - geminiApiKey: no longer used for direct AI calls. The Gemini API key lives
 *    exclusively in Vercel server-side env as GEMINI_API_KEY.
 *    All AI calls route through /api/analyze-report-image, /api/analyze-report-audio,
 *    /api/analyze-report-text.
 *  - The CloudConfigModal may still allow users to enter a key for the localStorage
 *    field (legacy support), but it is NOT forwarded to any AI request.
 */

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  databaseURL?: string;
}

export interface CloudConfigState {
  /** @deprecated No longer used for AI calls. Gemini API key is server-side only. */
  geminiApiKey: string;
  firebaseConfig: FirebaseConfig;
  useLiveFirebase: boolean;
}

const CONFIG_STORAGE_KEY = 'peoples_priorities_cloud_config_v2';

const DEFAULT_FIREBASE: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC2Qufkje5ySeQut5ht7RKBDZTbfZvNrw0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'peoples-priorities-cloud.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'peoples-priorities-cloud',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'peoples-priorities-cloud.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '470632059939',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:470632059939:web:8a5490234d70e072bc0d96',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-17612VHQS4',
};

export function getCloudConfig(): CloudConfigState {
  let savedConfig: Partial<CloudConfigState> = {};
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) savedConfig = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse cloud config from storage', e);
  }

  const projectId = savedConfig.firebaseConfig?.projectId || DEFAULT_FIREBASE.projectId || '';
  const firebaseConfig: FirebaseConfig = {
    apiKey: savedConfig.firebaseConfig?.apiKey || DEFAULT_FIREBASE.apiKey,
    authDomain: savedConfig.firebaseConfig?.authDomain || DEFAULT_FIREBASE.authDomain,
    projectId,
    storageBucket: savedConfig.firebaseConfig?.storageBucket || DEFAULT_FIREBASE.storageBucket,
    messagingSenderId: savedConfig.firebaseConfig?.messagingSenderId || DEFAULT_FIREBASE.messagingSenderId,
    appId: savedConfig.firebaseConfig?.appId || DEFAULT_FIREBASE.appId,
    measurementId: savedConfig.firebaseConfig?.measurementId || DEFAULT_FIREBASE.measurementId,
    databaseURL: savedConfig.firebaseConfig?.databaseURL ||
      (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined),
  };

  const useLiveFirebase = Boolean(
    savedConfig.useLiveFirebase !== undefined
      ? savedConfig.useLiveFirebase
      : firebaseConfig.apiKey && firebaseConfig.projectId
  );

  return {
    // geminiApiKey kept for legacy CloudConfigModal UI field only — not used for AI
    geminiApiKey: savedConfig.geminiApiKey?.trim() || '',
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

/**
 * Always returns true — Gemini API key is server-side only (GEMINI_API_KEY in Vercel).
 * AI readiness is determined by whether the /api endpoints respond, not a client-side key check.
 * @deprecated Use server-side AI endpoints instead of checking this.
 */
export function hasValidGeminiKey(): boolean {
  // The key is server-side. We optimistically report ready.
  // Actual availability is determined by the /api endpoint responses.
  return true;
}

export function hasValidFirebaseConfig(): boolean {
  const config = getCloudConfig();
  return Boolean(config.firebaseConfig.apiKey && config.firebaseConfig.projectId && config.useLiveFirebase);
}
