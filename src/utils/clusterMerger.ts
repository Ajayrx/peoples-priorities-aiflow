import type { Hotspot, CitizenReport } from '../types';
import type { LiveCitizenReport } from '../services/liveCloudBus';
import { runClusterEngine } from '../services/ClusterEngine';

/**
 * Merges live real-time citizen reports into spatial & category clusters using the Nationwide Cluster Engine.
 * Delegates density + category + proximity + time + AI similarity evaluations to `ClusterEngine.ts`.
 */
export function mergeLiveReportsIntoClusters(baseHotspots: Hotspot[], liveReports: LiveCitizenReport[]): Hotspot[] {
  const citizenReps: CitizenReport[] = liveReports.map((rep) => ({
    id: rep.id,
    timestamp: rep.timestamp || 'Just now',
    location: {
      lat: rep.location?.lat || 20.5937,
      lng: rep.location?.lng || 78.9629,
      state: (rep.location as any)?.state || 'India',
      district: (rep.location as any)?.district || 'Nationwide District',
      constituency: (rep.location as any)?.constituency || 'National PC',
      blockOrTown: rep.location?.blockOrTown || 'Verified Locality',
      villageOrWard: (rep.location as any)?.villageOrWard || 'Ward / Village',
    },
    category: rep.category,
    inputMethod: rep.intakeType || (rep.photoBase64 ? 'PHOTO' : 'TEXT'),
    rawMediaUrl: rep.photoBase64,
    rawText: rep.detectedIssue,
    aiProcessing: {
      transcription: rep.detectedIssue,
      imageDefectDetected: rep.detectedIssue,
      extractedKeywords: ['Citizen Intake', rep.category, rep.location?.blockOrTown || 'Locality'],
      sentimentUrgency: (rep.priorityLevel === 'CRITICAL' || rep.priorityLevel === 'HIGH' ? rep.priorityLevel : 'NORMAL') as 'CRITICAL' | 'HIGH' | 'NORMAL',
      aiConfidenceScore: rep.priorityScore || 94,
      aiSummary: rep.urgencyReasoning || rep.detectedIssue,
    },
    verificationStatus: 'VERIFIED',
    duplicateStatus: 'UNIQUE',
  }));

  const { clusters } = runClusterEngine(citizenReps, baseHotspots);
  return clusters;
}

