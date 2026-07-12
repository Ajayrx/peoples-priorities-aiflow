/**
 * geminiText.ts — Frontend client for /api/analyze-report-text
 *
 * This service POSTs raw text to the Vercel serverless endpoint.
 * The Gemini API key NEVER touches the browser — it lives in Vercel as GEMINI_API_KEY.
 *
 * Responsibility:
 *  - Obtain Firebase Auth ID token
 *  - POST text + selected language to /api/analyze-report-text
 *  - Return structured complaint analysis
 *  - Return AI_ANALYSIS_FAILED on any failure — no fake transcripts
 */

import { getAuth, signInAnonymously } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { getCloudConfig } from './cloudConfig';
import type { CategoryType } from '../types';

export interface GeminiTextResult {
  status: 'COMPLETED' | 'AI_ANALYSIS_FAILED';
  originalLanguage?: string | null;
  englishTranscript?: string | null;
  category?: CategoryType | null;
  summary?: string | null;
  keywords?: string[];
  confidence?: number;
  detectedIssue?: string;
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
 * Analyzes and translates a citizen text report via /api/analyze-report-text.
 *
 * @param text - Raw text from the citizen
 * @param selectedLanguage - Citizen's selected language hint
 */
export async function analyzeLocalityText(
  text: string,
  selectedLanguage: 'ODIA' | 'HINDI' | 'TELUGU' | 'ENGLISH' = 'ENGLISH',
): Promise<GeminiTextResult> {
  const AI_FAILED: GeminiTextResult = {
    status: 'AI_ANALYSIS_FAILED',
    isRealApiEval: false,
    error: 'Text analysis is temporarily unavailable. Your report can still be submitted.',
  };

  if (!text || text.trim().length < 2) {
    return { ...AI_FAILED, error: 'Text too short' };
  }

  // 1. Get Firebase Auth token
  const idToken = await getFirebaseIdToken();
  if (!idToken) {
    return { ...AI_FAILED, error: 'Authentication required for text analysis' };
  }

  // 2. POST to Vercel serverless endpoint
  let responseData: any;
  try {
    const response = await fetch('/api/analyze-report-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        text,
        selectedLanguage,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`/api/analyze-report-text ${response.status}:`, errText);
      return { ...AI_FAILED, error: `Endpoint error ${response.status}` };
    }

    responseData = await response.json();
  } catch (err: any) {
    console.error('Network error calling /api/analyze-report-text:', err);
    return { ...AI_FAILED, error: err?.message || 'Network error' };
  }

  // 3. Handle failure states from backend
  if (responseData.status === 'AI_ANALYSIS_FAILED' || responseData.error) {
    return {
      status: 'AI_ANALYSIS_FAILED',
      isRealApiEval: false,
      error: responseData.error || 'AI text analysis failed',
    };
  }

  // 4. Normalise category
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
    englishTranscript: responseData.englishTranscript || null,
    category,
    summary: responseData.summary || null,
    keywords: responseData.keywords || [],
    confidence: responseData.confidence ?? 0,
    detectedIssue: responseData.summary || responseData.englishTranscript?.slice(0, 60) || 'Text Civic Complaint',
    isRealApiEval: true,
  };
}
