import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { VertexAI } from '@google-cloud/vertexai';
import { z } from 'zod';

admin.initializeApp();
const storage = admin.storage();

// Vertex AI setup
const VERTEX_LOCATION = 'asia-south1';
const VERTEX_IMAGE_MODEL = 'gemini-1.5-flash-001';

// We must configure VertexAI with the project ID of the Firebase project
// This uses ADC (Application Default Credentials) of the Cloud Function Service Account
const vertexAi = new VertexAI({
  project: process.env.GCLOUD_PROJECT || 'peoples-priorities-cloud',
  location: VERTEX_LOCATION,
});

const generativeModel = vertexAi.getGenerativeModel({
  model: VERTEX_IMAGE_MODEL,
  generationConfig: {
    temperature: 0.1,
    responseMimeType: 'application/json',
    responseSchema: {
      type: "object" as any, // SchemaType.OBJECT
      properties: {
        imageRelevant: { type: "boolean" as any },
        detectedIssue: { type: "string" as any },
        category: { type: "string" as any },
        visualSeverity: { type: "string" as any },
        confidenceScore: { type: "number" as any },
        visualEvidence: { type: "array" as any, items: { type: "string" as any } },
        shortSummary: { type: "string" as any }
      },
      required: [
        "imageRelevant",
        "detectedIssue",
        "category",
        "visualSeverity",
        "confidenceScore",
        "visualEvidence",
        "shortSummary"
      ]
    }
  }
});

// Zod Schema for rigid backend validation
const VertexAnalysisSchema = z.object({
  imageRelevant: z.boolean(),
  detectedIssue: z.string().min(1),
  category: z.enum(['ROAD', 'DRAINAGE', 'WATER', 'SCHOOLS', 'HEALTHCARE', 'ELECTRICITY', 'STREET LIGHTS', 'GARBAGE', 'AGRICULTURE', 'PUBLIC SAFETY']),
  visualSeverity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  confidenceScore: z.number().min(0).max(1),
  visualEvidence: z.array(z.string()),
  shortSummary: z.string().min(1),
});

export const analyzeReportImage = functions.https.onCall(
  {
    region: 'asia-south1',
    enforceAppCheck: false, // Set true if AppCheck is used
    memory: '256MiB',
  },
  async (request) => {
    // 1. Authorization checks
    // if (!request.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    // }

    const { imageStoragePath } = request.data;
    if (!imageStoragePath || typeof imageStoragePath !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Missing imageStoragePath');
    }

    // 2. Strict Path Validation
    const pathRegex = /^citizen-reports\/[a-zA-Z0-9_-]+\/evidence\.(jpg|jpeg|webp)$/;
    if (!pathRegex.test(imageStoragePath)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid storage path format');
    }

    try {
      // 3. Verify file exists in Cloud Storage
      const bucket = storage.bucket();
      const file = bucket.file(imageStoragePath);
      const [exists] = await file.exists();
      if (!exists) {
        throw new functions.https.HttpsError('not-found', 'Image file does not exist in Storage');
      }

      // Check MIME type and size (optional but recommended)
      const [metadata] = await file.getMetadata();
      const mimeType = metadata.contentType;
      if (!mimeType || !['image/jpeg', 'image/webp'].includes(mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid MIME type');
      }
      
      const sizeBytes = parseInt(metadata.size?.toString() || '0', 10);
      if (sizeBytes > 4 * 1024 * 1024) { // 4MB max
        throw new functions.https.HttpsError('invalid-argument', 'File too large');
      }

      // 4. Download file to buffer and convert to base64 for Gemini
      const [buffer] = await file.download();
      const base64Data = buffer.toString('base64');

      // 5. Build prompt
      const promptText = `Analyze this citizen-uploaded infrastructure photo. Determine if it shows a local development issue.
      Identify visible infrastructure problems and estimate the visual severity.
      Extract visible evidence and generate a concise factual image summary.
      DO NOT hallucinate facts not visible in the image.`;

      // 6. Call Gemini Multimodal on Vertex AI
      const response = await generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      });

      const responseText = response.response.candidates?.[0].content.parts[0].text;
      if (!responseText) {
        throw new Error('Empty response from model');
      }

      let jsonPayload = responseText;
      jsonPayload = jsonPayload.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsedJson = JSON.parse(jsonPayload);

      // 7. Validate with Zod
      const validatedData = VertexAnalysisSchema.parse({
        ...parsedJson,
        category: parsedJson.category.toUpperCase()
      });

      // 8. Return normalized analysis
      return {
        status: 'COMPLETED',
        data: validatedData,
      };

    } catch (error: any) {
      console.error('Error analyzing image:', error);
      // Fail gracefully, don't invent fallbacks
      return {
        status: 'FAILED',
        error: error.message,
      };
    }
  }
);
