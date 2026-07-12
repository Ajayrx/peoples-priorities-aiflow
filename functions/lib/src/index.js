"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeReportImage = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const vertexai_1 = require("@google-cloud/vertexai");
const zod_1 = require("zod");
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
// Vertex AI setup
const VERTEX_LOCATION = 'asia-south1';
const VERTEX_IMAGE_MODEL = 'gemini-1.5-flash-001';
// We must configure VertexAI with the project ID of the Firebase project
// This uses ADC (Application Default Credentials) of the Cloud Function Service Account
const vertexAi = new vertexai_1.VertexAI({
    project: process.env.GCLOUD_PROJECT || 'peoples-priorities-cloud',
    location: VERTEX_LOCATION,
});
const generativeModel = vertexAi.getGenerativeModel({
    model: VERTEX_IMAGE_MODEL,
    generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
            type: "object", // SchemaType.OBJECT
            properties: {
                imageRelevant: { type: "boolean" },
                detectedIssue: { type: "string" },
                category: { type: "string" },
                visualSeverity: { type: "string" },
                confidenceScore: { type: "number" },
                visualEvidence: { type: "array", items: { type: "string" } },
                shortSummary: { type: "string" }
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
const VertexAnalysisSchema = zod_1.z.object({
    imageRelevant: zod_1.z.boolean(),
    detectedIssue: zod_1.z.string().min(1),
    category: zod_1.z.enum(['ROAD', 'DRAINAGE', 'WATER', 'SCHOOLS', 'HEALTHCARE', 'ELECTRICITY', 'STREET LIGHTS', 'GARBAGE', 'AGRICULTURE', 'PUBLIC SAFETY']),
    visualSeverity: zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    confidenceScore: zod_1.z.number().min(0).max(1),
    visualEvidence: zod_1.z.array(zod_1.z.string()),
    shortSummary: zod_1.z.string().min(1),
});
exports.analyzeReportImage = functions.https.onCall({
    region: 'asia-south1',
    enforceAppCheck: false, // Set true if AppCheck is used
    memory: '256MiB',
}, async (request) => {
    // 1. Authorization checks
    // if (!request.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    // }
    var _a;
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
        const sizeBytes = parseInt(metadata.size || '0', 10);
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
        const responseText = (_a = response.response.candidates) === null || _a === void 0 ? void 0 : _a[0].content.parts[0].text;
        if (!responseText) {
            throw new Error('Empty response from model');
        }
        let jsonPayload = responseText;
        jsonPayload = jsonPayload.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const parsedJson = JSON.parse(jsonPayload);
        // 7. Validate with Zod
        const validatedData = VertexAnalysisSchema.parse(Object.assign(Object.assign({}, parsedJson), { category: parsedJson.category.toUpperCase() }));
        // 8. Return normalized analysis
        return {
            status: 'COMPLETED',
            data: validatedData,
        };
    }
    catch (error) {
        console.error('Error analyzing image:', error);
        // Fail gracefully, don't invent fallbacks
        return {
            status: 'FAILED',
            error: error.message,
        };
    }
});
//# sourceMappingURL=index.js.map