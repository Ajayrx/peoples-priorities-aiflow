/**
 * Vercel Serverless API — /api/analyze-report-image
 *
 * Secure bridge: React client → this endpoint → Gemini Multimodal.
 *
 * Security:
 *  - POST only
 *  - Firebase ID token verified server-side via Firebase Auth REST
 *  - Image Blob accepted as multipart/form-data — no arbitrary URLs
 *  - MIME, size, and path validation
 *  - Per-request Gemini API key via process.env.GEMINI_API_KEY (never VITE_)
 *
 * Responsibility boundary:
 *  - Gemini: semantic visual understanding only
 *  - This endpoint: Stage 3 consistency check + imageEvidenceStatus assignment
 *  - ClusterEngine (frontend): priority scoring — NEVER Gemini
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Canonical application categories ──────────────────────────────────────────
const CANONICAL_CATEGORIES = [
  'ROAD', 'SCHOOLS', 'HEALTHCARE', 'WATER',
  'DRAINAGE', 'ELECTRICITY', 'GARBAGE', 'STREET_LIGHTS', 'AGRICULTURE',
] as const;
type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

// Scene types that indicate an irrelevant image
const IRRELEVANT_SCENE_TYPES = [
  'COMPUTER_SCREEN', 'KEYBOARD', 'DOCUMENT', 'INDOOR_OBJECT',
];

// Category compatibility for POSSIBLE_MATCH (bidirectional)
const COMPATIBLE_PAIRS: [CanonicalCategory, CanonicalCategory][] = [
  ['ROAD', 'DRAINAGE'],
  ['WATER', 'DRAINAGE'],
];

type ImageEvidenceStatus =
  | 'VERIFIED_EVIDENCE'
  | 'UNCERTAIN_EVIDENCE'
  | 'IRRELEVANT_IMAGE'
  | 'AI_ANALYSIS_FAILED';

type MatchLevel =
  | 'CATEGORY_MATCH'
  | 'POSSIBLE_MATCH'
  | 'CATEGORY_MISMATCH'
  | 'INSUFFICIENT_VISUAL_EVIDENCE';

// ── Firebase ID token verification ────────────────────────────────────────────
async function verifyFirebaseToken(token: string): Promise<{ uid: string } | null> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    console.error('FIREBASE_WEB_API_KEY not set');
    return null;
  }
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const uid = data?.users?.[0]?.localId;
    return uid ? { uid } : null;
  } catch {
    return null;
  }
}

// ── Category consistency check ────────────────────────────────────────────────
function checkCategoryMatch(
  complaintCategory: string,
  suggestedCategory: string,
): MatchLevel {
  const complaint = complaintCategory.toUpperCase() as CanonicalCategory;
  const suggested = suggestedCategory.toUpperCase() as CanonicalCategory;

  if (complaint === suggested) return 'CATEGORY_MATCH';

  const compatible = COMPATIBLE_PAIRS.some(
    ([a, b]) => (a === complaint && b === suggested) || (b === complaint && a === suggested)
  );
  if (compatible) return 'POSSIBLE_MATCH';

  return 'CATEGORY_MISMATCH';
}

// ── Derive canonical imageEvidenceStatus ─────────────────────────────────────
function deriveEvidenceStatus(
  sceneType: string,
  developmentIssueVisible: boolean,
  matchLevel: MatchLevel,
  confidenceScore: number,
): ImageEvidenceStatus {
  if (IRRELEVANT_SCENE_TYPES.includes(sceneType.toUpperCase())) {
    return 'IRRELEVANT_IMAGE';
  }
  if (!developmentIssueVisible || confidenceScore < 0.4) {
    return 'UNCERTAIN_EVIDENCE';
  }
  if (matchLevel === 'CATEGORY_MATCH' && confidenceScore >= 0.7) {
    return 'VERIFIED_EVIDENCE';
  }
  if (matchLevel === 'POSSIBLE_MATCH' && confidenceScore >= 0.7) {
    return 'VERIFIED_EVIDENCE';
  }
  return 'UNCERTAIN_EVIDENCE';
}

// ── Normalise Gemini suggested category to canonical list ─────────────────────
function normaliseCategory(raw: string): CanonicalCategory | null {
  const upper = (raw || '').toUpperCase().replace(/[^A-Z_]/g, '');
  if (CANONICAL_CATEGORIES.includes(upper as CanonicalCategory)) {
    return upper as CanonicalCategory;
  }
  return null;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Firebase Auth token verification
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization token' });
  }
  const tokenPayload = await verifyFirebaseToken(token);
  if (!tokenPayload) {
    return res.status(403).json({ error: 'Invalid or expired Firebase ID token' });
  }

  // 3. Gemini API key guard
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  // 4. Parse multipart form data
  // Vercel automatically parses multipart; body is available via busboy / raw stream.
  // We use a manual buffer approach since Vercel Node runtime supports it.
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(415).json({ error: 'Expected multipart/form-data' });
  }

  // Collect raw body chunks
  const chunks: Buffer[] = [];
  for await (const chunk of req as any) {
    chunks.push(chunk);
    const total = chunks.reduce((a, b) => a + b.length, 0);
    if (total > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large. Maximum 4 MB.' });
    }
  }
  const rawBody = Buffer.concat(chunks);

  // Parse multipart boundary
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    return res.status(400).json({ error: 'Invalid multipart boundary' });
  }
  const boundary = boundaryMatch[1];

  // Simple multipart parser — extract fields and file
  let imageBase64 = '';
  let imageMimeType = '';
  let complaintCategory = '';

  const parts = rawBody.toString('binary').split(`--${boundary}`);
  for (const part of parts) {
    if (part.includes('name="imageBlob"')) {
      const mimeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
      imageMimeType = mimeMatch ? mimeMatch[1].trim() : '';
      const dataStart = part.indexOf('\r\n\r\n');
      if (dataStart !== -1) {
        const binaryData = part.slice(dataStart + 4, part.lastIndexOf('\r\n'));
        imageBase64 = Buffer.from(binaryData, 'binary').toString('base64');
      }
    }
    if (part.includes('name="complaintCategory"')) {
      const dataStart = part.indexOf('\r\n\r\n');
      if (dataStart !== -1) {
        complaintCategory = part.slice(dataStart + 4).replace(/\r\n$/, '').trim();
      }
    }
  }

  // 5. Validate MIME type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(imageMimeType)) {
    return res.status(415).json({ error: `Unsupported image type: ${imageMimeType}. Use JPEG, PNG, or WebP.` });
  }

  if (!imageBase64 || imageBase64.length < 100) {
    return res.status(400).json({ error: 'No valid image data received' });
  }

  // 6. Validate complaint category
  const normalisedComplaintCategory = normaliseCategory(complaintCategory);

  // 7. Call Gemini Multimodal
  const geminiModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash';
  const prompt = `You are an infrastructure evidence analyst for a citizen grievance platform in rural India.

Analyze this actual citizen-uploaded photo. You must follow a STRICT 3-step order:

STEP 1: Classify the dominant scene.
Allowed scene types: ROAD, DRAINAGE, WATER_INFRASTRUCTURE, SCHOOL, HEALTHCARE, ELECTRICAL_INFRASTRUCTURE, AGRICULTURE, BUILDING, PERSON, SCREEN, DOCUMENT, INDOOR_OBJECT, BLANK, OTHER.

STEP 2: Determine whether a visible civic development issue actually exists in the scene.
Do NOT infer problems that are not clearly visible. Do NOT classify infrastructure based on color or texture alone.

STEP 3: ONLY IF developmentIssueVisible is true, detect the issue, suggest a category, estimate severity, and list visible evidence.
If the scene is a PERSON, SCREEN, DOCUMENT, INDOOR_OBJECT, or BLANK, developmentIssueVisible MUST be false.

Respond ONLY with valid JSON matching this schema exactly:
{
  "sceneType": "...",
  "developmentIssueVisible": boolean,
  "detectedIssue": "brief description of the visible issue, or null if none",
  "suggestedCategory": "one of: ROAD | SCHOOLS | HEALTHCARE | WATER | DRAINAGE | ELECTRICITY | GARBAGE | STREET_LIGHTS | AGRICULTURE | null",
  "visualSeverity": "one of: CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN | null",
  "confidenceScore": number between 0.0 and 1.0,
  "visualEvidence": ["array of specific visible observations"],
  "rejectionReason": "null if image is relevant, or brief reason if irrelevant"
}`;

  let geminiData: any;
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error(`Gemini image error ${geminiRes.status}:`, errText);
      return res.status(200).json({ imageEvidenceStatus: 'AI_ANALYSIS_FAILED', error: 'Gemini analysis failed' });
    }

    const geminiJson = await geminiRes.json();
    let rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    geminiData = JSON.parse(rawText);
  } catch (err) {
    console.error('Gemini call or parse error:', err);
    return res.status(200).json({ imageEvidenceStatus: 'AI_ANALYSIS_FAILED', error: 'AI analysis temporarily unavailable' });
  }

  // 8. Validate and normalise Gemini output
  const sceneType = typeof geminiData.sceneType === 'string' ? geminiData.sceneType.toUpperCase() : 'UNKNOWN';
  let developmentIssueVisible = Boolean(geminiData.developmentIssueVisible);
  
  // SERVER-SIDE GUARD: Never trust Gemini to find infrastructure on irrelevant scenes
  const strictIrrelevantScenes = ['PERSON', 'SCREEN', 'DOCUMENT', 'INDOOR_OBJECT', 'BLANK', 'COMPUTER_SCREEN', 'KEYBOARD'];
  if (strictIrrelevantScenes.includes(sceneType)) {
    developmentIssueVisible = false;
  }

  const detectedIssue = typeof geminiData.detectedIssue === 'string' ? geminiData.detectedIssue : '';
  const suggestedCategoryRaw = geminiData.suggestedCategory || '';
  const suggestedCategory = normaliseCategory(suggestedCategoryRaw);
  const visualSeverityRaw = geminiData.visualSeverity || 'UNKNOWN';
  const allowedSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  const visualSeverity = allowedSeverities.includes(visualSeverityRaw.toUpperCase())
    ? visualSeverityRaw.toUpperCase()
    : 'UNKNOWN';
  const confidenceScore = typeof geminiData.confidenceScore === 'number'
    ? Math.min(1, Math.max(0, geminiData.confidenceScore))
    : 0;
  const visualEvidence: string[] = Array.isArray(geminiData.visualEvidence)
    ? geminiData.visualEvidence.filter((v: any) => typeof v === 'string').slice(0, 8)
    : [];
  const shortSummary = typeof geminiData.detectedIssue === 'string' ? geminiData.detectedIssue : '';

  // 9. Stage 3: complaint ↔ image consistency check
  let matchLevel: MatchLevel = 'INSUFFICIENT_VISUAL_EVIDENCE';
  if (suggestedCategory && normalisedComplaintCategory) {
    matchLevel = checkCategoryMatch(normalisedComplaintCategory, suggestedCategory);
  } else if (!developmentIssueVisible) {
    matchLevel = 'INSUFFICIENT_VISUAL_EVIDENCE';
  }

  // 10. Derive canonical imageEvidenceStatus
  let imageEvidenceStatus: ImageEvidenceStatus = deriveEvidenceStatus(
    sceneType,
    developmentIssueVisible,
    matchLevel,
    confidenceScore,
  );

  if (strictIrrelevantScenes.includes(sceneType) || !developmentIssueVisible) {
    imageEvidenceStatus = 'IRRELEVANT_IMAGE';
  }

  // 11. Development logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n--- [DEV] GEMINI IMAGE ANALYSIS ---');
    console.log('Model:', geminiModel);
    console.log('Received MIME:', imageMimeType);
    console.log('Received Bytes:', Math.round((imageBase64.length * 3) / 4));
    console.log('Gemini JSON:', JSON.stringify(geminiData, null, 2));
    console.log('Final Status:', imageEvidenceStatus);
    console.log('-----------------------------------\n');
  }

  // 11. Return structured response — Gemini does NOT calculate priority
  return res.status(200).json({
    imageEvidenceStatus,
    matchLevel,
    sceneType,
    developmentIssueVisible,
    detectedIssue,
    suggestedCategory,
    visualSeverity,
    confidenceScore,
    visualEvidence,
    shortSummary,
  });
}
