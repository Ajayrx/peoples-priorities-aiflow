/**
 * Vercel Serverless API — /api/analyze-report-text
 *
 * Secure bridge: citizen-written text → this endpoint → Gemini Text Understanding.
 *
 * Security:
 *  - POST only
 *  - Firebase ID token verified server-side
 *  - JSON body with text field only — max 5000 characters
 *  - Gemini API key via process.env.GEMINI_API_KEY only
 *
 * Responsibility boundary:
 *  - Gemini: language detection, translation, categorisation, summarisation
 *  - ClusterEngine (frontend): priority scoring — NEVER Gemini
 *
 * Supported citizen languages: Odia, Hindi, Telugu, English
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Canonical application categories ──────────────────────────────────────────
const CANONICAL_CATEGORIES = [
  'ROAD', 'SCHOOLS', 'HEALTHCARE', 'WATER',
  'DRAINAGE', 'ELECTRICITY', 'GARBAGE', 'STREET_LIGHTS', 'AGRICULTURE',
] as const;
type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

function normaliseCategory(raw: string): CanonicalCategory | null {
  const upper = (raw || '').toUpperCase().replace(/[^A-Z_]/g, '');
  if (CANONICAL_CATEGORIES.includes(upper as CanonicalCategory)) {
    return upper as CanonicalCategory;
  }
  return null;
}

// ── Firebase ID token verification ────────────────────────────────────────────
async function verifyFirebaseToken(token: string): Promise<{ uid: string } | null> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) { console.error('FIREBASE_WEB_API_KEY not set'); return null; }
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

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Firebase Auth token verification
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing Authorization token' });
  const tokenPayload = await verifyFirebaseToken(token);
  if (!tokenPayload) return res.status(403).json({ error: 'Invalid or expired Firebase ID token' });

  // 3. Gemini API key guard
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return res.status(500).json({ error: 'AI service not configured' });

  // 4. Parse and validate JSON body
  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const rawText: string = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!rawText || rawText.length < 2) {
    return res.status(400).json({ error: 'text field is required and must not be empty' });
  }
  if (rawText.length > 5000) {
    return res.status(400).json({ error: 'text field exceeds maximum length of 5000 characters' });
  }

  const selectedLanguage: string = typeof body?.selectedLanguage === 'string'
    ? body.selectedLanguage.toUpperCase()
    : 'ENGLISH';
  const validLanguages = ['ODIA', 'HINDI', 'TELUGU', 'ENGLISH'];
  const language = validLanguages.includes(selectedLanguage) ? selectedLanguage : 'ENGLISH';

  // 5. Build Gemini text prompt
  const prompt = `You are an expert multilingual civic grievance analyst for a citizen platform serving rural communities in Odisha, India.

The citizen wrote this complaint. Their selected language is: ${language}.

Citizen complaint text:
"""
${rawText}
"""

Your tasks:
1. Detect the actual language of the complaint text.
2. Keep the original text as-is (do not modify it).
3. Translate the meaning to clear English if not already in English.
4. Categorize the development issue into ONE of: ROAD, SCHOOLS, HEALTHCARE, WATER, DRAINAGE, ELECTRICITY, GARBAGE, STREET_LIGHTS, AGRICULTURE.
5. Write a concise English summary (1-2 sentences).
6. Extract 3-5 relevant English keywords.
7. Estimate your confidence between 0.0 and 1.0.

Do NOT invent details not present in the original text.
Do NOT calculate a priority score or severity — that is handled separately.

Respond ONLY with this exact JSON:
{
  "originalLanguage": "ODIA | HINDI | TELUGU | ENGLISH | OTHER",
  "originalText": "the citizen's original text unchanged",
  "englishText": "meaning translated to English",
  "category": "one of the canonical categories above",
  "summary": "1-2 sentence English summary",
  "keywords": ["array of English keywords"],
  "confidence": number between 0.0 and 1.0
}`;

  // 6. Call Gemini Text
  const geminiModel = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

  let geminiData: any;
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error(`Gemini text error ${geminiRes.status}:`, errText);
      return res.status(200).json({ status: 'AI_ANALYSIS_FAILED', error: 'Gemini text analysis failed' });
    }

    const geminiJson = await geminiRes.json();
    let rawResponse = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawResponse = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    geminiData = JSON.parse(rawResponse);
  } catch (err) {
    console.error('Gemini text call or parse error:', err);
    return res.status(200).json({ status: 'AI_ANALYSIS_FAILED', error: 'AI text analysis temporarily unavailable' });
  }

  // 7. Validate and normalise Gemini output
  const originalLanguage = typeof geminiData.originalLanguage === 'string'
    ? geminiData.originalLanguage.toUpperCase()
    : language;
  const originalText = typeof geminiData.originalText === 'string'
    ? geminiData.originalText.trim()
    : rawText;
  const englishText = typeof geminiData.englishText === 'string'
    ? geminiData.englishText.trim()
    : null;
  const category = normaliseCategory(geminiData.category || '');
  const summary = typeof geminiData.summary === 'string' ? geminiData.summary.trim() : null;
  const keywords: string[] = Array.isArray(geminiData.keywords)
    ? geminiData.keywords.filter((k: any) => typeof k === 'string').slice(0, 8)
    : [];
  const confidence = typeof geminiData.confidence === 'number'
    ? Math.min(1, Math.max(0, geminiData.confidence))
    : 0;

  if (!englishText && !summary) {
    return res.status(200).json({ status: 'AI_ANALYSIS_FAILED', error: 'Incomplete response from Gemini' });
  }

  return res.status(200).json({
    status: 'COMPLETED',
    originalLanguage,
    originalText,
    englishText,
    category,
    summary,
    keywords,
    confidence,
  });
}
