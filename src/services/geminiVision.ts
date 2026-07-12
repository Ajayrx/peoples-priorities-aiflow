/**
 * geminiVision.ts — Frontend client for /api/analyze-report-image
 *
 * This service POSTs a compressed image Blob directly to the Vercel serverless endpoint.
 * The Gemini API key NEVER touches the browser — it lives in Vercel as GEMINI_API_KEY.
 *
 * Responsibility:
 *  - Obtain Firebase Auth ID token
 *  - POST image Blob + complaint category to /api/analyze-report-image
 *  - Return structured visual evidence result
 *  - Return AI_ANALYSIS_FAILED on any failure — no fake evidence
 *
 * Gemini does NOT calculate priority. ClusterEngine is the only priority engine.
 */

import type { CategoryType } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageEvidenceStatus =
  | 'VERIFIED_EVIDENCE'
  | 'UNCERTAIN_EVIDENCE'
  | 'IRRELEVANT_IMAGE'
  | 'IMAGE_QUALITY_FAILED'
  | 'AI_ANALYSIS_FAILED';

export type ImageQualityFailureReason =
  | 'BLANK_IMAGE'
  | 'IMAGE_TOO_SMALL'
  | 'SEVERELY_OVEREXPOSED'
  | 'SEVERELY_UNDEREXPOSED'
  | null;

export interface GeminiVisionResult {
  imageEvidenceStatus: ImageEvidenceStatus;
  /** Populated only when imageEvidenceStatus === IMAGE_QUALITY_FAILED */
  imageQualityFailureReason?: ImageQualityFailureReason;
  /** Gemini visual severity — does NOT map to priority score */
  visualSeverity?: string;
  confidenceScore: number;
  detectedIssue: string;
  /** Canonical category from Gemini — for UI display only, NOT for priority */
  category?: CategoryType;
  visualEvidence?: string[];
  shortSummary?: string;
  sceneType?: string;
  /** True if a real API call was made and returned a structured result */
  isRealApiEval: boolean;
  error?: string;
}



// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Analyzes a compressed image Blob via the Vercel /api/analyze-report-image endpoint.
 *
 * @param imageBlob - Compressed JPEG or WebP Blob from the citizen upload
 * @param complaintCategory - The citizen's selected complaint category (for Stage 3 consistency)
 */
export async function evaluateLocalityPhoto(
  imageBlob: Blob,
  complaintCategory: string,
): Promise<GeminiVisionResult> {
  const AI_FAILED: GeminiVisionResult = {
    imageEvidenceStatus: 'AI_ANALYSIS_FAILED',
    confidenceScore: 0,
    detectedIssue: 'AI Photo Analysis temporarily unavailable',
    shortSummary: 'Photo analysis is temporarily unavailable. Your report can still be submitted.',
    isRealApiEval: false,
    error: 'AI_ANALYSIS_FAILED',
  };



  // 2. Build multipart form data
  const formData = new FormData();
  formData.append('imageBlob', imageBlob, 'evidence.jpg');
  formData.append('complaintCategory', complaintCategory.toUpperCase());

  // 3. POST to Vercel serverless endpoint
  let responseData: any;
  try {
    const response = await fetch('/api/analyze-report-image', {
      method: 'POST',
      headers: {
        // Do NOT set Content-Type — browser sets it automatically with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`/api/analyze-report-image ${response.status}:`, errText);
      return { ...AI_FAILED, error: `Endpoint error ${response.status}` };
    }

    responseData = await response.json();
  } catch (err: any) {
    console.error('Network error calling /api/analyze-report-image:', err);
    return { ...AI_FAILED, error: err?.message || 'Network error' };
  }

  // 4. Return AI_ANALYSIS_FAILED if backend reports failure
  if (responseData.imageEvidenceStatus === 'AI_ANALYSIS_FAILED' || responseData.error) {
    return {
      ...AI_FAILED,
      error: responseData.error || 'AI analysis failed',
    };
  }

  // 5. Return structured result — no priority calculation here
  return {
    imageEvidenceStatus: responseData.imageEvidenceStatus || 'AI_ANALYSIS_FAILED',
    visualSeverity: responseData.visualSeverity,
    confidenceScore: typeof responseData.confidenceScore === 'number'
      ? Math.round(responseData.confidenceScore * 100)
      : 0,
    detectedIssue: responseData.detectedIssue || '',
    category: responseData.suggestedCategory
      ? (responseData.suggestedCategory.charAt(0) + responseData.suggestedCategory.slice(1).toLowerCase()) as CategoryType
      : undefined,
    visualEvidence: responseData.visualEvidence || [],
    shortSummary: responseData.shortSummary || '',
    sceneType: responseData.sceneType,
    isRealApiEval: true,
  };
}
