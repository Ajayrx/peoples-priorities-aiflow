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
  assemblyConstituency?: string;
  wardOrVillage?: string;
  isAllIndia?: boolean;
}

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'MONITORED';

export interface CitizenReportSubmission {
  clientSubmissionId?: string;
  category?: string;
  title?: string;
  description?: string;
  rawText?: string;
  transcription?: string;
  aiSummary?: string;
  detectedIssue?: string;
  urgencyReasoning?: string;
  
  inputMethod?: 'VOICE' | 'PHOTO' | 'TEXT';
  intakeType?: 'VOICE' | 'PHOTO' | 'TEXT';
  
  photoBase64?: string;
  imageStoragePath?: string;
  images?: string[];
  rawMediaUrl?: string;
  voiceUrl?: string;
  
  aiCategory?: string;
  aiConfidence?: number;
  priorityScore?: number;
  priorityLevel?: PriorityLevel;
  
  location?: {
    lat?: number;
    lng?: number;
    state?: string;
    district?: string;
    constituency?: string;
    blockOrTown?: string;
    villageOrWard?: string;
  };

  aiProcessing?: any;
}

export interface CanonicalCitizenReportWrite {
  clientSubmissionId: string;
  
  inputMethod: 'VOICE' | 'PHOTO' | 'TEXT';
  intakeType: 'VOICE' | 'PHOTO' | 'TEXT';
  
  category: CategoryType;
  aiCategory: string;
  
  title: string;
  description: string;
  rawText: string;
  transcription: string;
  aiSummary: string;
  detectedIssue: string;
  
  aiConfidence: number;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  urgencyReasoning: string;
  
  hotspotId?: string;
  assignedHotspotId?: string;
  
  status: string;
  verificationStatus: string;
  duplicateStatus: string;
  
  location: {
    blockOrTown: string;
    villageOrWard: string;
    district: string;
    constituency: string;
    state: string;
    lat: number;
    lng: number;
  };
  
  voiceUrl?: string;
  images: string[];
  photoBase64: string;
  imageStoragePath: string;
  
  aiProcessing: any;
}

export interface CitizenReport extends CanonicalCitizenReportWrite {
  id: string;
  createdAt: number;
  updatedAt: number;
  // Fallback for components that still rely on timestamp strings. Will be dynamically added on read.
  timestamp: string; 
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
  dynamicScore?: number; // Optional dynamic priority score from live engine
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
  individualReportsCount?: number;
  emergingClustersCount?: number;
  mediumClustersCount?: number;
  highClustersCount?: number;
  criticalClustersCount?: number;
  totalImpactedPopulation?: number;
}
