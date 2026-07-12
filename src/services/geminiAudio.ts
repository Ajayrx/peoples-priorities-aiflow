// Gemini Multilingual Audio Transcription Engine for Voice Grievances
import { getCloudConfig, hasValidGeminiKey } from './cloudConfig';
import type { CategoryType, PriorityLevel } from '../types';

export interface GeminiAudioResult {
  englishTranscript: string;
  category: CategoryType;
  detectedIssue: string;
  priorityLevel: PriorityLevel;
  confidenceScore: number;
  isRealApiEval: boolean;
  error?: string;
}

/**
 * Convert a Blob to a pure base64 string using ArrayBuffer.
 * This is the only reliable method in browsers — FileReader.readAsDataURL
 * can produce malformed base64 when the blob MIME type contains codec params.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  // Process in chunks to avoid call-stack overflow on large audio
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Returns a clean MIME type accepted by Gemini (strips codec params).
 * Maps common browser MediaRecorder output types to Gemini-supported types.
 */
function getCleanMimeType(rawType: string): string {
  if (!rawType) return 'audio/webm';
  const base = rawType.split(';')[0].trim().toLowerCase();
  // Gemini supports: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg,
  // audio/flac, audio/webm, audio/mp4
  const SUPPORTED = ['audio/wav', 'audio/mp3', 'audio/aac', 'audio/ogg',
                     'audio/flac', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return SUPPORTED.includes(base) ? base : 'audio/webm';
}

export async function transcribeAndTranslateAudio(
  audioBlob: Blob,
  selectedLanguage: 'ODIA' | 'HINDI' | 'TELUGU' | 'ENGLISH',
  fallbackText?: string
): Promise<GeminiAudioResult> {
  const config = getCloudConfig();

  // ── Guard: API key missing ───────────────────────────────────────────────
  if (!hasValidGeminiKey() || !config.geminiApiKey || config.geminiApiKey.trim().length <= 10) {
    return {
      englishTranscript: '',
      category: 'Road',
      detectedIssue: 'Missing Gemini API Key',
      priorityLevel: 'MEDIUM',
      confidenceScore: 0,
      isRealApiEval: false,
      error: 'Gemini API Key is missing or invalid. Please click Cloud Settings (top right gear icon) and paste your Gemini API Key, or verify VITE_GEMINI_API_KEY in Vercel.',
    };
  }

  // ── Guard: truly empty recording ─────────────────────────────────────────
  if ((!audioBlob || audioBlob.size < 500) && (!fallbackText || fallbackText.trim() === '')) {
    return {
      englishTranscript: 'No speech detected. Please try again.',
      category: 'Road',
      detectedIssue: 'No Speech Detected',
      priorityLevel: 'MEDIUM',
      confidenceScore: 0,
      isRealApiEval: false,
      error: 'No speech detected. Please try again.',
    };
  }

  // ── Convert audio blob to clean base64 ───────────────────────────────────
  let base64Audio = '';
  let mimeType = 'audio/webm';
  if (audioBlob && audioBlob.size >= 500) {
    try {
      base64Audio = await blobToBase64(audioBlob);
      mimeType = getCleanMimeType(audioBlob.type);
    } catch (err) {
      console.warn('Failed to encode audio blob to base64:', err);
    }
  }

  const languageLabel =
    selectedLanguage === 'ODIA'
      ? 'Odia (ଓଡ଼ିଆ)'
      : selectedLanguage === 'HINDI'
      ? 'Hindi (हिन्दी)'
      : selectedLanguage === 'TELUGU'
      ? 'Telugu (తెలుగు)'
      : 'English';

  // ── Build Gemini prompt ───────────────────────────────────────────────────
  // Goal: transcribe exactly what the user said in their own language.
  // No forced English translation. User reads & submits in their spoken language.
  const promptText = `You are an expert multilingual speech transcription AI for a citizen grievance platform in India.
The citizen spoke into their microphone. Their selected language is: ${selectedLanguage} (${languageLabel}).
${fallbackText && fallbackText.trim() !== '' ? `Browser speech recognition captured this preliminary snippet: "${fallbackText.trim()}"` : ''}

Your job:
1. Listen to the audio and transcribe EXACTLY what the citizen said, in the SAME language they spoke.
   - If they spoke Hindi → transcribe in Hindi.
   - If they spoke Odia → transcribe in Odia.
   - If they spoke Telugu → transcribe in Telugu.
   - If they spoke English → transcribe in English.
   - Do NOT translate to English. Preserve the original language.
2. If the audio has NO speech (only silence, static, wind, muffled noise with zero identifiable words), set "noSpeech" to true.
3. Also categorize the complaint into ONE of: "Road", "Drainage", "Water", "Schools", "Healthcare", "Electricity".
4. Provide a short 3–6 word issue title in English (for internal tagging only).
5. Determine priority: "CRITICAL", "HIGH", or "MEDIUM".

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "noSpeech": boolean,
  "transcript": string,
  "category": string,
  "detectedIssue": string,
  "priorityLevel": string,
  "confidenceScore": number
}`;

  // ── Attempt 1: Gemini multimodal audio upload (inlineData) ───────────────
  let lastStatus = 0;
  let lastErrText = '';

  if (base64Audio.length > 0) {
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash-lite',
    ];

    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.geminiApiKey.trim()}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Audio,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (response.ok) {
          const json = await response.json();
          let raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            try {
              const parsed = JSON.parse(raw);

              if (parsed.noSpeech === true || !parsed.transcript) {
                return {
                  englishTranscript: 'No speech detected. Please try again.',
                  category: 'Road',
                  detectedIssue: 'No Speech Detected',
                  priorityLevel: 'MEDIUM',
                  confidenceScore: 0,
                  isRealApiEval: true,
                  error: 'No speech detected. Please try again.',
                };
              }

              const rawPriority = parsed.priorityLevel === 'LOW' ? 'MEDIUM' : parsed.priorityLevel;
              const validCategory = (
                ['Road', 'Drainage', 'Water', 'Schools', 'Healthcare', 'Electricity']
                  .includes(parsed.category)
                  ? parsed.category
                  : 'Road'
              ) as CategoryType;

              return {
                englishTranscript: parsed.transcript.trim(),
                category: validCategory,
                detectedIssue: parsed.detectedIssue || 'Spoken Civic Complaint',
                priorityLevel: (
                  ['CRITICAL', 'HIGH', 'MEDIUM'].includes(rawPriority) ? rawPriority : 'HIGH'
                ) as PriorityLevel,
                confidenceScore: Number(parsed.confidenceScore) || 95,
                isRealApiEval: true,
              };
            } catch (jsonErr) {
              console.warn(`JSON parse error from model ${modelName}:`, raw);
            }
          }
        } else {
          lastStatus = response.status;
          lastErrText = await response.text().catch(() => '');
          console.warn(`Gemini Audio [${modelName}] status ${response.status}:`, lastErrText);
        }
      } catch (err: any) {
        lastErrText = err?.message || 'Network fetch error';
        console.warn(`Network error with Gemini Audio [${modelName}]:`, err);
      }
    }
  }

  // ── Attempt 2: Text-only fallback via browser SpeechRecognition ──────────
  // If browser's SpeechRecognition captured words, send those to Gemini text model
  if (fallbackText && fallbackText.trim() !== '' && !fallbackText.includes('No speech')) {
    if (hasValidGeminiKey() && config.geminiApiKey) {
      try {
        const textEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey.trim()}`;
        const textPrompt = `A citizen spoke a civic grievance. Browser speech recognition captured this text in ${languageLabel}: "${fallbackText.trim()}"

Clean up and keep the text in the same language (do NOT translate to English unless they spoke English).
Also categorize the complaint into ONE of: "Road", "Drainage", "Water", "Schools", "Healthcare", "Electricity".
Provide a short 3–6 word issue title in English for internal tagging.
Determine priority: "CRITICAL", "HIGH", or "MEDIUM".

Respond ONLY with this JSON:
{
  "transcript": string,
  "category": string,
  "detectedIssue": string,
  "priorityLevel": string,
  "confidenceScore": number
}`;
        const res = await fetch(textEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: textPrompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          let txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) {
            txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            const p = JSON.parse(txt);
            return {
              englishTranscript: p.transcript || fallbackText.trim(),
              category: (
                ['Road', 'Drainage', 'Water', 'Schools', 'Healthcare', 'Electricity']
                  .includes(p.category) ? p.category : 'Road'
              ) as CategoryType,
              detectedIssue: p.detectedIssue || 'Spoken Civic Complaint',
              priorityLevel: (
                ['CRITICAL', 'HIGH', 'MEDIUM'].includes(p.priorityLevel) ? p.priorityLevel : 'HIGH'
              ) as PriorityLevel,
              confidenceScore: p.confidenceScore || 93,
              isRealApiEval: true,
            };
          }
        }
      } catch (textErr) {
        console.warn('Text fallback Gemini error:', textErr);
      }
    }

    // Last resort: return browser-captured text as-is (no API needed)
    return {
      englishTranscript: fallbackText.trim(),
      category: 'Road',
      detectedIssue: 'Spoken Civic Intake',
      priorityLevel: 'HIGH',
      confidenceScore: 85,
      isRealApiEval: false,
    };
  }

  // ── Build specific error message ─────────────────────────────────────────
  let specificError =
    'Audio processing failed. Please try recording again or check your Gemini API key in Cloud Settings.';
  if (lastStatus === 403) {
    specificError =
      'Gemini API Key authorization failed (403). Please verify your key is active in Google AI Studio and that the Generative Language API is enabled.';
  } else if (lastStatus === 429) {
    specificError =
      'Gemini API Rate Limit hit (429). Free tier quota temporarily exceeded. Wait 10 seconds and try again.';
  } else if (lastStatus === 400) {
    specificError = `Gemini API rejected the audio (400 Bad Request): ${lastErrText.slice(0, 200) || 'Invalid audio payload'}.`;
  } else if (lastStatus === 404) {
    specificError = `Gemini model not found (404): ${lastErrText.slice(0, 120)}`;
  } else if (lastErrText) {
    specificError = `Gemini Audio Error (${lastStatus || 'Network'}): ${lastErrText.slice(0, 200)}`;
  }

  return {
    englishTranscript: '',
    category: 'Road',
    detectedIssue: 'Audio Processing Error',
    priorityLevel: 'MEDIUM',
    confidenceScore: 0,
    isRealApiEval: false,
    error: specificError,
  };
}
