export type CategoryType =
  | 'Road'
  | 'Schools'
  | 'Healthcare'
  | 'Water'
  | 'Drainage'
  | 'Electricity'
  | 'Street Lights'
  | 'Garbage'
  | 'Agriculture'
  | 'Public Safety';

export type UserRole = 'CITIZEN' | 'VOLUNTEER' | 'DISTRICT_OFFICER' | 'MP' | 'ADMIN';

export interface Region {
  state: string;
  district: string;
  constituency: string;
}

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'MONITORED';

export interface CitizenReport {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  category: CategoryType;
  priority?: PriorityLevel;
  status?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  images?: string[];
  voiceUrl?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  userId?: string;
  verificationStatus?: 'VERIFIED' | 'FLAGGED_LOW_CONFIDENCE' | 'PENDING_FIELD_CHECK' | string;
  aiSummary?: string;
  aiCategory?: string;
  aiPriority?: string;
  aiConfidence?: number;
  hotspotId?: string;

  // Backwards-compatible canonical mappings for UI components
  timestamp: string;
  location: {
    lat: number;
    lng: number;
    state?: string;
    district?: string;
    constituency?: string;
    blockOrTown: string;
    villageOrWard?: string;
  };
  inputMethod?: 'VOICE' | 'PHOTO' | 'TEXT';
  intakeType?: 'VOICE' | 'PHOTO' | 'TEXT';
  rawMediaUrl?: string;
  photoBase64?: string;
  rawText?: string;
  detectedIssue?: string;
  urgencyReasoning?: string;
  priorityLevel?: PriorityLevel;
  priorityScore?: number;
  aiProcessing?: {
    transcription?: string;
    imageDefectDetected?: string;
    extractedKeywords: string[];
    sentimentUrgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
    aiConfidenceScore: number; // 0-100%
    aiSummary: string;
  };
  assignedHotspotId?: string;
  duplicateStatus?: 'UNIQUE' | 'DUPLICATE_CLUSTERED';
}

export interface PriorityBreakdown {
  demandVelocityMultiplier: number;
  demographicImpactMultiplier: number;
  infrastructureGapMultiplier: number;
  seasonalUrgencyMultiplier: number;
  aiConfidenceMultiplier: number;
  existingPlanDiscount: number;
  finalScore: number;
  explanation: string;
}

export interface Hotspot {
  id: string;
  name: string;
  category: CategoryType;
  location: {
    center: { lat: number; lng: number };
    boundingRadiusMeters: number;
    blockOrTown: string;
    constituency: string;
  };
  clusterSizeClass: 'small' | 'medium' | 'large'; // small: ~10, medium: ~40, large: ~150+
  metrics: {
    citizenReportCount: number;
    reportGrowthVelocity: string; // e.g., "+45% in last 7 days"
    impactedPopulation: number; // From Census
    nearbySchoolsCount: number;
    nearbyHealthCentresCount: number;
    infrastructureStatus: 'Good' | 'Moderate' | 'Poor' | 'Critical';
  };
  existingDevelopmentPlan: {
    hasProposal: boolean;
    schemeName?: string;
    status?: 'Proposed' | 'Under Audit' | 'In Progress' | 'Mandate Issued';
    actionPriority?: string;
  } | null;
  priorityLevel: PriorityLevel;
  priorityScore: number; // 0-100
  priorityBreakdown: PriorityBreakdown;
  aiSynthesis: {
    headline: string;
    reasoning: string;
    recommendedAction: string;
  };
  recentReports: CitizenReport[];
  beforeAfterComparison?: {
    hasCompletedWork: boolean;
    beforePhotoUrl?: string;
    afterPhotoUrl?: string;
    impactMetrics?: string[];
  };
}

export interface PublicDatasetAsset {
  id: string;
  name: string;
  assetType: 'SCHOOL' | 'HOSPITAL' | 'HEALTH_SUB_CENTRE' | 'WATER_OVERHEAD_TANK' | 'ROAD_SEGMENT' | 'TRANSFORMER';
  coordinates: { lat: number; lng: number };
  condition: 'Functional' | 'Needs Repair' | 'Defunct';
  demographicServed: number;
  lastUpdated: string;
}

export interface DatasetHealthRecord {
  id: string;
  datasetName: string;
  status: 'Verified' | 'Warning' | 'Error';
  lastUpdated: string;
  recordsCount: number;
  validationSummary: string;
  version: string;
}

export interface WhatIfScenario {
  hotspotId: string;
  targetCategory: CategoryType;
  proposedBudget: string;
  proposedAction: string;
  simulatedResults: {
    populationBenefited: number;
    priorityReductionPercent: number;
    newPriorityScore: number;
    secondaryBenefits: string[];
  };
}

export interface DashboardStats {
  totalReports: number;
  criticalReports: number;
  verifiedReports: number;
  categoryCounts: Record<string, number>;
  avgAiConfidence: number;
}
