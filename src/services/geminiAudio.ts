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
    error: 'AI audio analysis is temporarily unavailable.',
  };

  // 1. Reject empty recordings early
  if (!audioBlob || audioBlob.size < 500) {
    return {
      status: 'NO_SPEECH_DETECTED',
      isRealApiEval: false,
      error: 'No speech detected. Please record again.',
    };
  }

  // 2. Build multipart form data
  const formData = new FormData();
  formData.append('audioBlob', audioBlob, 'complaint.webm');
  formData.append('selectedLanguage', selectedLanguage);

  // 3. POST to Vercel serverless endpoint
  let responseData: any;
  try {
    const response = await fetch('/api/analyze-report-audio', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error(`Vercel audio API error: ${response.status}`);
      if (response.status === 413 || response.status === 415 || response.status === 400) {
        return { ...AI_FAILED, error: 'Audio recording could not be processed.' };
      }
      return AI_FAILED;
    }

    responseData = await response.json();
  } catch (err) {
    console.error('Vercel audio network error:', err);
    return { ...AI_FAILED, error: 'Unable to connect to voice analysis.' };
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
