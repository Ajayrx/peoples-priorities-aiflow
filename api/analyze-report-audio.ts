/**
 * Vercel Serverless API — /api/analyze-report-audio
 *
 * Secure bridge: Browser MediaRecorder Blob → this endpoint → Gemini Multimodal Audio.
 *
 * Security:
 *  - POST only
 *  - Firebase ID token verified server-side
 *  - Audio Blob accepted as multipart/form-data — no URL-based audio
 *  - MIME and size validation
 *  - Gemini API key via process.env.GEMINI_API_KEY only
 *
 * Responsibility boundary:
 *  - Gemini: transcription, language detection, translation, categorisation
 *  - ClusterEngine (frontend): priority scoring — NEVER Gemini
 *
 * Supported citizen languages: Odia, Hindi, Telugu, English
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

// ── In-Memory Rate Limiter (Per Vercel Instance Burst Protection) ─────────────
// Note: This is NOT global distributed rate limiting. It only provides basic
// burst protection per cold-start instance. For global limits, use Upstash/Redis.
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 5;

// ── Canonical application categories ──────────────────────────────────────────
const CANONICAL_CATEGORIES = [
  'ROAD', 'SCHOOLS', 'HEALTHCARE', 'WATER',
  'DRAINAGE', 'ELECTRICITY', 'GARBAGE', 'STREET_LIGHTS', 'AGRICULTURE',
] as const;
type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

// Allowed audio MIME types from MediaRecorder
const ALLOWED_AUDIO_MIMES = [
  'audio/webm', 'audio/webm;codecs=opus',
  'audio/mp4', 'audio/ogg', 'audio/ogg;codecs=opus',
  'audio/wav', 'audio/mpeg', 'audio/flac',
];

function normaliseCategory(raw: string): CanonicalCategory | null {
  const upper = (raw || '').toUpperCase().replace(/[^A-Z_]/g, '');
  if (CANONICAL_CATEGORIES.includes(upper as CanonicalCategory)) {
    return upper as CanonicalCategory;
  }
  return null;
}

function getCleanMimeType(raw: string): string {
  const base = (raw || '').split(';')[0].trim().toLowerCase();
  const supported = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/flac'];
  return supported.includes(base) ? base : 'audio/webm';
}


// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Rate Limiting (Per-Instance)
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown_ip';
  const now = Date.now();
  const rateRecord = rateLimitMap.get(clientIp);

  if (rateRecord && now < rateRecord.resetTime) {
    if (rateRecord.count >= MAX_REQUESTS_PER_MINUTE) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    rateRecord.count++;
  } else {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + 60000 });
  }

  // Periodic cleanup of rate limit map to prevent memory leaks
  if (rateLimitMap.size > 1000) {
    for (const [ip, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) rateLimitMap.delete(ip);
    }
  }

  // 3. Gemini API key guard
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return res.status(500).json({ error: 'AI service not configured' });

  // 4. Parse multipart form data
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(415).json({ error: 'Expected multipart/form-data' });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req as any) {
    chunks.push(chunk);
    const total = chunks.reduce((a, b) => a + b.length, 0);
    if (total > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Audio too large. Maximum 10 MB.' });
    }
  }
  const rawBody = Buffer.concat(chunks);

  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) return res.status(400).json({ error: 'Invalid multipart boundary' });
  const boundary = boundaryMatch[1].replace(/^"|"$/g, '');

  let audioBase64 = '';
  let audioMimeType = '';
  let selectedLanguage = 'ENGLISH';
  let fallbackText = '';

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let startIndex = 0;
  while (true) {
    const partStart = rawBody.indexOf(boundaryBuffer, startIndex);
    if (partStart === -1) break;
    
    const nextBoundary = rawBody.indexOf(boundaryBuffer, partStart + boundaryBuffer.length);
    const partEnd = nextBoundary !== -1 ? nextBoundary : rawBody.length;
    
    const partBuffer = rawBody.subarray(partStart + boundaryBuffer.length, partEnd);
    
    const headerEnd = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headerText = partBuffer.subarray(0, headerEnd).toString('utf-8');
      if (headerText.includes('name="audioBlob"')) {
        const mimeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
        audioMimeType = mimeMatch ? mimeMatch[1].trim() : 'audio/webm';
        const dataBuffer = partBuffer.subarray(headerEnd + 4, Math.max(headerEnd + 4, partBuffer.length - 2));
        audioBase64 = dataBuffer.toString('base64');
      }
      if (headerText.includes('name="selectedLanguage"')) {
        const dataBuffer = partBuffer.subarray(headerEnd + 4, Math.max(headerEnd + 4, partBuffer.length - 2));
        selectedLanguage = dataBuffer.toString('utf-8').trim().toUpperCase();
      }
      if (headerText.includes('name="fallbackText"')) {
        const dataBuffer = partBuffer.subarray(headerEnd + 4, Math.max(headerEnd + 4, partBuffer.length - 2));
        fallbackText = dataBuffer.toString('utf-8').trim();
      }
    }
    
    if (nextBoundary === -1) break;
    startIndex = nextBoundary;
  }

  // 5. Validate audio MIME (accept with or without codec params)
  const baseMime = (audioMimeType || '').split(';')[0].trim().toLowerCase();
  const allowedBases = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/flac'];
  if (!allowedBases.includes(baseMime)) {
    return res.status(415).json({ error: `Unsupported audio type: ${audioMimeType}` });
  }

  if (!audioBase64 || audioBase64.length < 50) {
    return res.status(400).json({ error: 'No valid audio data received' });
  }

  const cleanMime = getCleanMimeType(audioMimeType);

  // 6. Validate selectedLanguage
  const validLanguages = ['ODIA', 'HINDI', 'TELUGU', 'ENGLISH'];
  if (!validLanguages.includes(selectedLanguage)) selectedLanguage = 'ENGLISH';

  const languageLabel: Record<string, string> = {
    ODIA: 'Odia (ଓଡ଼ିଆ)',
    HINDI: 'Hindi (हिन्दी)',
    TELUGU: 'Telugu (తెలుగు)',
    ENGLISH: 'English',
  };

  // 7. Build Gemini audio prompt
  const prompt = `You are an expert multilingual speech analysis AI for a citizen grievance platform serving rural communities in Odisha, India.

The citizen spoke into their microphone. Their selected language is: ${selectedLanguage} (${languageLabel[selectedLanguage]}).
${fallbackText && fallbackText.trim() !== '' ? `Browser speech recognition captured this preliminary snippet: "${fallbackText.trim()}" (Use this as a strong hint if the audio is unclear).` : ''}

Your tasks:
1. Detect the actual language spoken (it may differ from the selected language).
2. Transcribe EXACTLY what the citizen said, preserving their original language.
3. Translate the meaning of the complaint into clear English.
4. Categorize the development issue into ONE of these categories only: ROAD, SCHOOLS, HEALTHCARE, WATER, DRAINAGE, ELECTRICITY, GARBAGE, STREET_LIGHTS, AGRICULTURE.
5. Write a concise English summary (1-2 sentences).
6. Extract 3-5 relevant keywords in English.
7. Estimate your transcription confidence between 0.0 and 1.0.

If there is NO speech (silence, static, wind, noise only), set "noSpeech" to true and all text fields to null.

Do NOT invent complaint content. Do NOT fill in information not spoken by the citizen.

Respond ONLY with this exact JSON:
{
  "noSpeech": boolean,
  "originalLanguage": "ODIA | HINDI | TELUGU | ENGLISH | OTHER",
  "originalTranscript": "exact words spoken in original language, or null",
  "englishTranscript": "meaning translated to English, or null",
  "category": "one of the canonical categories above, or null",
  "summary": "1-2 sentence English summary, or null",
  "keywords": ["array of English keywords"],
  "confidence": number between 0.0 and 1.0
}`;

  // 8. Call Gemini Multimodal Audio
  const geminiModel = process.env.GEMINI_AUDIO_MODEL || 'gemini-2.5-flash';

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
              { inlineData: { mimeType: cleanMime, data: audioBase64 } },
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
      console.error(`Gemini audio error ${geminiRes.status}:`, errText);
      return res.status(200).json({ status: 'AI_ANALYSIS_FAILED', error: 'Gemini audio analysis failed' });
    }

    const geminiJson = await geminiRes.json();
    let rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    geminiData = JSON.parse(rawText);
  } catch (err) {
    console.error('Gemini audio call or parse error:', err);
    return res.status(200).json({ status: 'AI_ANALYSIS_FAILED', error: 'AI audio analysis temporarily unavailable' });
  }

  // 9. Handle no-speech case
  if (geminiData.noSpeech === true) {
    return res.status(200).json({
      status: 'NO_SPEECH_DETECTED',
      originalLanguage: null,
      originalTranscript: null,
      englishTranscript: null,
      category: null,
      summary: null,
      keywords: [],
      confidence: 0,
    });
  }

  // 10. Validate and normalise output
  const originalLanguage = typeof geminiData.originalLanguage === 'string'
    ? geminiData.originalLanguage.toUpperCase()
    : selectedLanguage;
  const originalTranscript = typeof geminiData.originalTranscript === 'string'
    ? geminiData.originalTranscript.trim()
    : null;
  const englishTranscript = typeof geminiData.englishTranscript === 'string'
    ? geminiData.englishTranscript.trim()
    : null;
  const category = normaliseCategory(geminiData.category || '');
  const summary = typeof geminiData.summary === 'string' ? geminiData.summary.trim() : null;
  const keywords: string[] = Array.isArray(geminiData.keywords)
    ? geminiData.keywords.filter((k: any) => typeof k === 'string').slice(0, 8)
    : [];
  const confidence = typeof geminiData.confidence === 'number'
    ? Math.min(1, Math.max(0, geminiData.confidence))
    : 0;

  // Require at minimum a transcript or a summary
  if (!originalTranscript && !englishTranscript) {
    return res.status(200).json({ status: 'AI_ANALYSIS_FAILED', error: 'No transcript returned from Gemini' });
  }

  return res.status(200).json({
    status: 'COMPLETED',
    originalLanguage,
    originalTranscript,
    englishTranscript,
    category,
    summary,
    keywords,
    confidence,
  });
}
