// Gemini Multilingual Audio Understanding Engine for Voice Grievances
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

// Helper: Convert Blob to clean Base64 string without data URL header
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAndTranslateAudio(
  audioBlob: Blob,
  selectedLanguage: 'ODIA' | 'HINDI' | 'TELUGU' | 'ENGLISH',
  fallbackText?: string
): Promise<GeminiAudioResult> {
  const config = getCloudConfig();

  // If audio is practically empty (0 bytes) and no fallback text exists
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

  let base64Audio = '';
  let mimeType = 'audio/webm';
  if (audioBlob && audioBlob.size >= 500) {
    try {
      base64Audio = await blobToBase64(audioBlob);
      mimeType = audioBlob.type ? audioBlob.type.split(';')[0] : 'audio/webm';
    } catch (err) {
      console.warn('Failed to encode audio blob to base64:', err);
    }
  }

  const languageLabel =
    selectedLanguage === 'ODIA'
      ? 'Odia / ଓଡ଼ିଆ'
      : selectedLanguage === 'HINDI'
      ? 'Hindi / हिन्दी'
      : selectedLanguage === 'TELUGU'
      ? 'Telugu / తెలుగు'
      : 'English';

  const promptText = `You are an expert multilingual AI audio analysis, transcription, and translation engine for a citizen grievance platform in India.
The citizen recorded a voice complaint into their microphone. The selected input language is: ${selectedLanguage} (${languageLabel}).
${fallbackText && fallbackText.trim() !== '' ? `The browser's preliminary speech recognition captured this text snippet: "${fallbackText.trim()}"` : ''}

Your strict responsibility is:
1. Listen carefully to the actual audio recording (and check the preliminary text if audio is noisy).
2. If the audio has NO speech detected (only silence, wind, background static, or unclear muffle with zero identifiable words), respond EXACTLY with JSON where "noSpeech" is true and "englishTranscript" is "No speech detected. Please try again."
3. If the citizen spoke in Odia, Hindi, Telugu, or any regional language, transcribe what they said and faithfully TRANSLATE the meaning into clear, natural, grammatically correct ENGLISH complaint text while preserving exact factual details (such as road washout, water supply stopped for days, school roof leak, etc.).
4. If the citizen spoke in English, transcribe and clean up the spoken content into clear English complaint text.
5. Analyze the resulting English complaint text to categorize the issue into ONE of: "Road", "Drainage", "Water", "Schools", "Healthcare", or "Electricity".
6. Determine a concise 3-to-6 word title ("detectedIssue") summarizing the complaint (for example: "Severe Village Water Supply Shortage" or "Damaged School Approach Road").
7. Determine the "priorityLevel" ("CRITICAL", "HIGH", or "MEDIUM") and a "confidenceScore" (85 to 98) based on urgency and clarity.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "noSpeech": boolean (true ONLY if no speech/words were detected),
  "englishTranscript": string (the faithful English complaint transcript of what the citizen spoke, or "No speech detected. Please try again." if noSpeech is true),
  "category": string (MUST be one of: "Road", "Drainage", "Water", "Schools", "Healthcare", "Electricity"),
  "detectedIssue": string (concise 3-6 word title in English),
  "priorityLevel": string ("CRITICAL", "HIGH", or "MEDIUM"),
  "confidenceScore": number (85 to 98)
}`;

  // 1. Try Gemini Multimodal Audio API if key is valid and base64Audio is available
  if (hasValidGeminiKey() && config.geminiApiKey && base64Audio.length > 0) {
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
    ];

    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.geminiApiKey}`;
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
          let textResult = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResult) {
            textResult = textResult
              .replace(/^```(?:json)?\s*/i, '')
              .replace(/\s*```$/, '')
              .trim();
            try {
              const parsed = JSON.parse(textResult);
              if (
                parsed.noSpeech === true ||
                parsed.englishTranscript === 'No speech detected. Please try again.' ||
                !parsed.englishTranscript
              ) {
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
              const validCategory = [
                'Road',
                'Drainage',
                'Water',
                'Schools',
                'Healthcare',
                'Electricity',
              ].includes(parsed.category)
                ? (parsed.category as CategoryType)
                : 'Road';

              return {
                englishTranscript: parsed.englishTranscript.trim(),
                category: validCategory,
                detectedIssue: parsed.detectedIssue || 'Spoken Civic Complaint',
                priorityLevel: (['CRITICAL', 'HIGH', 'MEDIUM'].includes(rawPriority)
                  ? rawPriority
                  : 'HIGH') as PriorityLevel,
                confidenceScore: Number(parsed.confidenceScore) || 95,
                isRealApiEval: true,
              };
            } catch (jsonErr) {
              console.warn(`Failed to parse JSON from audio model ${modelName}:`, textResult);
            }
          }
        } else {
          const errText = await response.text().catch(() => '');
          console.warn(`Gemini Audio model ${modelName} returned status ${response.status}:`, errText);
        }
      } catch (err) {
        console.warn(`Network error trying Gemini Audio model ${modelName}:`, err);
      }
    }
  }

  // 2. If real audio upload API failed or key rate-limited, check if browser SpeechRecognition captured real words
  if (fallbackText && fallbackText.trim() !== '' && !fallbackText.includes('No speech')) {
    // If we have Gemini API key, use text-only model to translate and categorize the recognized words
    if (hasValidGeminiKey() && config.geminiApiKey) {
      try {
        const textEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`;
        const textPrompt = `A citizen recorded a voice grievance. Preliminary speech recognition recognized this text in ${selectedLanguage}: "${fallbackText.trim()}"
Translate this faithfully into clean, natural English complaint text. Then categorize into ONE of: "Road", "Drainage", "Water", "Schools", "Healthcare", "Electricity". Provide a 3-6 word title ("detectedIssue") and priority ("CRITICAL", "HIGH", or "MEDIUM").
Respond ONLY with JSON:
{
  "englishTranscript": string,
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
              englishTranscript: p.englishTranscript || fallbackText.trim(),
              category: (['Road', 'Drainage', 'Water', 'Schools', 'Healthcare', 'Electricity'].includes(p.category) ? p.category : 'Road') as CategoryType,
              detectedIssue: p.detectedIssue || 'Spoken Civic Complaint',
              priorityLevel: (['CRITICAL', 'HIGH', 'MEDIUM'].includes(p.priorityLevel) ? p.priorityLevel : 'HIGH') as PriorityLevel,
              confidenceScore: p.confidenceScore || 93,
              isRealApiEval: true,
            };
          }
        }
      } catch (textErr) {
        console.warn('Text fallback translation error:', textErr);
      }
    }

    // If Gemini is offline/unreachable but we have English speech recognized or real text
    if (selectedLanguage === 'ENGLISH') {
      return {
        englishTranscript: fallbackText.trim(),
        category: 'Road',
        detectedIssue: 'Spoken Civic Intake',
        priorityLevel: 'HIGH',
        confidenceScore: 90,
        isRealApiEval: false,
      };
    }

    // If regional language recognized without Gemini API translation available
    return {
      englishTranscript: fallbackText.trim(),
      category: 'Road',
      detectedIssue: `${selectedLanguage === 'ODIA' ? 'Odia' : selectedLanguage === 'HINDI' ? 'Hindi' : 'Telugu'} Spoken Intake`,
      priorityLevel: 'HIGH',
      confidenceScore: 88,
      isRealApiEval: false,
    };
  }

  // 3. If zero speech was captured by browser AND audio processing via Gemini failed/missing API key
  return {
    englishTranscript: '',
    category: 'Road',
    detectedIssue: 'Audio Processing Error',
    priorityLevel: 'MEDIUM',
    confidenceScore: 0,
    isRealApiEval: false,
    error: 'Audio processing failed: Unable to connect to Gemini Audio API. Please verify your Gemini API key in Cloud Settings and try recording again.',
  };
}
