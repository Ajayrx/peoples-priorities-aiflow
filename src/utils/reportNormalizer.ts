import type { CitizenReportSubmission, CanonicalCitizenReportWrite, CitizenReport, CategoryType, PriorityLevel } from '../types';

export function normalizeReportSubmission(raw: CitizenReportSubmission): CanonicalCitizenReportWrite {
  const inputMethod = raw.inputMethod || raw.intakeType || 'TEXT';
  const intakeType = raw.intakeType || raw.inputMethod || 'TEXT';

  const category = (raw.category || 'Road') as CategoryType;
  const aiCategory = raw.aiCategory || '';
  
  const title = raw.title || raw.detectedIssue || '';
  const description = raw.description || '';
  const rawText = raw.rawText || raw.transcription || '';
  const transcription = raw.transcription || '';
  const aiSummary = raw.aiSummary || '';
  const detectedIssue = raw.detectedIssue || '';
  
  const aiConfidence = raw.aiConfidence || 0;
  const priorityScore = raw.priorityScore || 0;
  const priorityLevel = (raw.priorityLevel || 'MONITORED') as PriorityLevel;
  const urgencyReasoning = raw.urgencyReasoning || '';
  
  const status = 'ACTIVE';
  const verificationStatus = 'VERIFIED';
  const duplicateStatus = 'UNIQUE';
  
  const location = {
    blockOrTown: raw.location?.blockOrTown || 'Unknown Region',
    villageOrWard: raw.location?.villageOrWard || '',
    district: raw.location?.district || '',
    constituency: raw.location?.constituency || '',
    state: raw.location?.state || '',
    lat: raw.location?.lat || 0,
    lng: raw.location?.lng || 0,
  };
  
  const images = Array.isArray(raw.images) ? raw.images : [];
  const photoBase64 = raw.photoBase64 || raw.photoBase64 || '';
  const imageStoragePath = raw.imageStoragePath || '';
  const voiceUrl = raw.voiceUrl || '';
  
  const aiProcessing = raw.aiProcessing || {};
  
  return {
    clientSubmissionId: raw.clientSubmissionId || crypto.randomUUID(),
    inputMethod,
    intakeType,
    category,
    aiCategory,
    title,
    description,
    rawText,
    transcription,
    aiSummary,
    detectedIssue,
    aiConfidence,
    priorityScore,
    priorityLevel,
    urgencyReasoning,
    status,
    verificationStatus,
    duplicateStatus,
    location,
    images,
    photoBase64,
    imageStoragePath,
    voiceUrl,
    aiProcessing,
  };
}

export function validateCanonicalReportWrite(payload: CanonicalCitizenReportWrite) {
  if (typeof payload.clientSubmissionId !== 'string') throw new Error("Invalid clientSubmissionId");
  if (!['VOICE', 'PHOTO', 'TEXT'].includes(payload.inputMethod)) throw new Error("Invalid inputMethod");
  if (typeof payload.category !== 'string') throw new Error("Invalid category");
  
  // Strict schema checks in dev
  if (import.meta.env && import.meta.env.DEV) {
    if (typeof payload.rawText !== 'string') throw new Error("rawText must be string");
    if (typeof payload.description !== 'string') throw new Error("description must be string");
    if (typeof payload.detectedIssue !== 'string') throw new Error("detectedIssue must be string");
  }
}

export function normalizeCitizenReportDocument(docId: string, data: any): CitizenReport {
  // Read from the DB and ensure it strictly matches CitizenReport
  
  // Safely parse timestamps. Some might be Firestore Timestamps.
  let createdAt = 0;
  if (data.createdAt) {
    if (typeof data.createdAt.toMillis === 'function') {
      createdAt = data.createdAt.toMillis();
    } else if (typeof data.createdAt === 'number') {
      createdAt = data.createdAt;
    } else {
      createdAt = new Date(data.createdAt).getTime();
    }
  }

  let updatedAt = 0;
  if (data.updatedAt) {
    if (typeof data.updatedAt.toMillis === 'function') {
      updatedAt = data.updatedAt.toMillis();
    } else if (typeof data.updatedAt === 'number') {
      updatedAt = data.updatedAt;
    } else {
      updatedAt = new Date(data.updatedAt).getTime();
    }
  }

  // Create formatted timestamp for UI fallback
  const d = new Date(createdAt || 0);
  const timestamp = `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  return {
    id: docId,
    createdAt,
    updatedAt,
    timestamp,
    
    clientSubmissionId: data.clientSubmissionId || docId,
    
    inputMethod: data.inputMethod || data.intakeType || 'TEXT',
    intakeType: data.intakeType || data.inputMethod || 'TEXT',
    
    category: data.category || 'Road',
    aiCategory: data.aiCategory || '',
    
    title: data.title || '',
    description: data.description || '',
    rawText: data.rawText || '',
    transcription: data.transcription || '',
    aiSummary: data.aiSummary || '',
    detectedIssue: data.detectedIssue || '',
    
    aiConfidence: data.aiConfidence || 0,
    priorityScore: data.priorityScore || 0,
    priorityLevel: data.priorityLevel || 'MONITORED',
    urgencyReasoning: data.urgencyReasoning || '',
    
    status: data.status || 'ACTIVE',
    verificationStatus: data.verificationStatus || 'VERIFIED',
    duplicateStatus: data.duplicateStatus || 'UNIQUE',
    
    location: {
      blockOrTown: data.location?.blockOrTown || 'Unknown',
      villageOrWard: data.location?.villageOrWard || '',
      district: data.location?.district || '',
      constituency: data.location?.constituency || '',
      state: data.location?.state || '',
      lat: data.location?.lat || 0,
      lng: data.location?.lng || 0,
    },
    
    images: Array.isArray(data.images) ? data.images : [],
    photoBase64: data.photoBase64 || '',
    imageStoragePath: data.imageStoragePath || '',
    voiceUrl: data.voiceUrl || '',
    
    aiProcessing: data.aiProcessing || {},
  };
}

export function getReportDisplayText(report: CitizenReport): string {
  if (report.detectedIssue) return report.detectedIssue;
  if (report.title) return report.title;
  if (report.aiSummary) return report.aiSummary;
  if (report.description) return report.description;
  if (report.rawText) return report.rawText;
  return 'Verified Civic Intake';
}
