/**
 * geminiAudio.ts — Frontend client for /api/analyze-report-audio
 *
 * This service POSTs real MediaRecorder audio Blobs to the Vercel serverless endpoint.
 * The Gemini API key NEVER touches the browser — it lives in Vercel as GEMINI_API_KEY.
 *
 * Responsibility:
 *  - Obtain Firebase Auth ID token
 *  - POST real audio Blob + selected language to /api/analyze-report-audio
 *  - Return structured complaint analysis
 *  - Return AI_ANALYSIS_FAILED on any failure — no fake transcripts
 *
 * Supported languages: Odia, Hindi, Telugu, English
 */

import { getAuth, signInAnonymously } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { getCloudConfig } from './cloudConfig';
import type { CategoryType } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeminiAudioResult {
  status: 'COMPLETED' | 'NO_SPEECH_DETECTED' | 'AI_ANALYSIS_FAILED';
  originalLanguage?: string | null;
  originalTranscript?: string | null;
  englishTranscript?: string | null;
  category?: CategoryType | null;
  summary?: string | null;
  keywords?: string[];
  confidence?: number;
  /** Legacy field kept for backwards-compatible components */
  detectedIssue?: string;
  /** Legacy field — kept for backwards-compatible components; always false for AI_ANALYSIS_FAILED */
  isRealApiEval: boolean;
  error?: string;
}

// ── Firebase Auth helper ──────────────────────────────────────────────────────

async function getFirebaseIdToken(): Promise<string | null> {
  try {
    const { firebaseConfig } = getCloudConfig();
    const app = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0];
    const auth = getAuth(app);
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return await auth.currentUser!.getIdToken();
  } catch (err) {
    console.error('Failed to get Firebase ID token:', err);
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Transcribes and translates a real citizen audio Blob via /api/analyze-report-audio.
 *
 * @param audioBlob - Real MediaRecorder Blob from the browser
 * @param selectedLanguage - Citizen's selected language hint
 */
export async function transcribeAndTranslateAudio(
  audioBlob: Blob,
  selectedLanguage: 'ODIA' | 'HINDI' | 'TELUGU' | 'ENGLISH',
): Promise<GeminiAudioResult> {
  const AI_FAILED: GeminiAudioResult = {
    status: 'AI_ANALYSIS_FAILED',
    isRealApiEval: false,
    error: 'Audio analysis is temporarily unavailable. Your report can still be submitted.',
  };

  // 1. Reject empty recordings early
  if (!audioBlob || audioBlob.size < 500) {
    return {
      status: 'NO_SPEECH_DETECTED',
      isRealApiEval: false,
      error: 'No speech detected. Please try recording again.',
    };
  }

  // 2. Get Firebase Auth token
  const idToken = await getFirebaseIdToken();
  if (!idToken) {
    return { ...AI_FAILED, error: 'Authentication required for audio analysis' };
  }

  // 3. Build multipart form data
  const formData = new FormData();
  formData.append('audioBlob', audioBlob, 'complaint.webm');
  formData.append('selectedLanguage', selectedLanguage);

  // 4. POST to Vercel serverless endpoint
  let responseData: any;
  try {
    const response = await fetch('/api/analyze-report-audio', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        // Do NOT set Content-Type — browser sets it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`/api/analyze-report-audio ${response.status}:`, errText);
      return { ...AI_FAILED, error: `Endpoint error ${response.status}` };
    }

    responseData = await response.json();
  } catch (err: any) {
    console.error('Network error calling /api/analyze-report-audio:', err);
    return { ...AI_FAILED, error: err?.message || 'Network error' };
  }

  // 5. Handle explicit failure states from backend
  if (responseData.status === 'AI_ANALYSIS_FAILED') {
    return {
      status: 'AI_ANALYSIS_FAILED',
      isRealApiEval: false,
      error: responseData.error || 'AI audio analysis failed',
    };
  }

  if (responseData.status === 'NO_SPEECH_DETECTED') {
    return {
      status: 'NO_SPEECH_DETECTED',
      isRealApiEval: true,
      error: 'No speech detected in the recording. Please try again.',
    };
  }

  // 6. Normalise category for backwards compatibility
  const rawCategory = responseData.category;
  const categoryMap: Record<string, CategoryType> = {
    ROAD: 'Road', SCHOOLS: 'Schools', HEALTHCARE: 'Healthcare',
    WATER: 'Water', DRAINAGE: 'Drainage', ELECTRICITY: 'Electricity',
    GARBAGE: 'Garbage', STREET_LIGHTS: 'Street Lights', AGRICULTURE: 'Agriculture',
  };
  const category: CategoryType | null = rawCategory
    ? (categoryMap[rawCategory.toUpperCase()] || null)
    : null;

  return {
    status: 'COMPLETED',
    originalLanguage: responseData.originalLanguage || null,
    originalTranscript: responseData.originalTranscript || null,
    englishTranscript: responseData.englishTranscript || null,
    category,
    summary: responseData.summary || null,
    keywords: responseData.keywords || [],
    confidence: responseData.confidence ?? 0,
    // Legacy field mapping
    detectedIssue: responseData.summary || responseData.englishTranscript?.slice(0, 60) || 'Spoken Civic Complaint',
    isRealApiEval: true,
  };
}
