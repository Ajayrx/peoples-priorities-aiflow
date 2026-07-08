import type { Hotspot, CitizenReport } from '../types';
import type { LiveCitizenReport } from '../services/liveCloudBus';

/**
 * Merges live real-time citizen reports into spatial & category clusters.
 * Ensures that multiple complaints from the same location & category increment the citizenReportCount
 * (+1, +2, +3... as per complaint) rather than spawning fragmented separate dots.
 */
export function mergeLiveReportsIntoClusters(baseHotspots: Hotspot[], liveReports: LiveCitizenReport[]): Hotspot[] {
  // Deep clone base hotspots so we mutate cleanly
  const clusters: Hotspot[] = baseHotspots.map((hs) => ({
    ...hs,
    metrics: { ...hs.metrics },
    priorityBreakdown: { ...hs.priorityBreakdown },
    aiSynthesis: { ...hs.aiSynthesis },
    recentReports: [...(hs.recentReports || [])],
  }));

  for (const rep of liveReports) {
    // Convert LiveCitizenReport into our full CitizenReport interface
    const citizenRep: CitizenReport = {
      id: rep.id,
      timestamp: rep.timestamp || 'Just now',
      location: {
        lat: rep.location?.lat || 18.7083,
        lng: rep.location?.lng || 82.8465,
        state: 'Odisha',
        district: 'Koraput',
        constituency: 'Koraput PC',
        blockOrTown: rep.location?.blockOrTown || 'Semiliguda',
        villageOrWard: 'Verified Citizen Pin',
      },
      category: rep.category,
      inputMethod: rep.photoBase64 ? 'PHOTO' : 'TEXT',
      rawMediaUrl: rep.photoBase64,
      rawText: rep.detectedIssue,
      aiProcessing: {
        transcription: rep.detectedIssue,
        imageDefectDetected: rep.detectedIssue,
        extractedKeywords: ['Real-time Citizen Intake', rep.category, rep.location?.blockOrTown || 'Locality'],
        sentimentUrgency: (rep.priorityLevel === 'CRITICAL' || rep.priorityLevel === 'HIGH' ? rep.priorityLevel : 'NORMAL') as 'CRITICAL' | 'HIGH' | 'NORMAL',
        aiConfidenceScore: rep.priorityScore || 94,
        aiSummary: rep.urgencyReasoning || rep.detectedIssue,
      },
      verificationStatus: 'VERIFIED',
      duplicateStatus: 'UNIQUE',
    };

    // Check if an existing cluster matches BOTH Category AND Location (by town name substring or spatial proximity < 8km)
    const matchingClusterIndex = clusters.findIndex((cluster) => {
      const categoryMatch = cluster.category === rep.category;
      if (!categoryMatch) return false;

      const blockStrRep = (rep.location?.blockOrTown || '').toLowerCase().trim();
      const blockStrCluster = cluster.location.blockOrTown.toLowerCase().trim();
      const nameStrCluster = cluster.name.toLowerCase();

      const nameMatch =
        (blockStrRep.length > 2 && (blockStrCluster.includes(blockStrRep) || blockStrRep.includes(blockStrCluster) || nameStrCluster.includes(blockStrRep)));

      const latDiff = Math.abs(cluster.location.center.lat - (rep.location?.lat || 18.7083));
      const lngDiff = Math.abs(cluster.location.center.lng - (rep.location?.lng || 82.8465));
      const spatialMatch = latDiff < 0.08 && lngDiff < 0.08;

      return nameMatch || spatialMatch;
    });

    if (matchingClusterIndex >= 0) {
      // MERGE into existing cluster (+1, +2... as per complaint!)
      const target = clusters[matchingClusterIndex];
      target.metrics.citizenReportCount += 1;
      target.recentReports.unshift(citizenRep);
      target.priorityScore = Math.min(100, target.priorityScore + 2);
      target.metrics.reportGrowthVelocity = `+${target.recentReports.length} verified citizen intakes`;
      target.aiSynthesis.reasoning = `${target.metrics.citizenReportCount} total citizen demands verified from ${target.location.blockOrTown} (latest intake: "${rep.detectedIssue.slice(0, 65)}...")`;
    } else {
      // Create a new location + category cluster for this unique locality/category combination
      const newCluster: Hotspot = {
        id: `live-cluster-${rep.id}`,
        name: `${rep.location?.blockOrTown || 'Locality'} • ${rep.category} Cluster`,
        category: rep.category,
        location: {
          center: {
            lat: rep.location?.lat || 18.7083,
            lng: rep.location?.lng || 82.8465,
          },
          boundingRadiusMeters: 1000,
          blockOrTown: rep.location?.blockOrTown || 'Locality',
          constituency: 'Koraput PC (Live Sync)',
        },
        clusterSizeClass: 'small',
        metrics: {
          citizenReportCount: 1,
          reportGrowthVelocity: 'Live Citizen Cluster (+1 new demand)',
          impactedPopulation: 3500,
          nearbySchoolsCount: 1,
          nearbyHealthCentresCount: 0,
          infrastructureStatus: rep.priorityLevel === 'CRITICAL' ? 'Critical' : 'Poor',
        },
        existingDevelopmentPlan: { hasProposal: false },
        priorityLevel: rep.priorityLevel || 'HIGH',
        priorityScore: rep.priorityScore || 92,
        priorityBreakdown: {
          demandVelocityMultiplier: 1.5,
          demographicImpactMultiplier: 1.5,
          infrastructureGapMultiplier: 1.8,
          seasonalUrgencyMultiplier: 1.5,
          aiConfidenceMultiplier: 0.95,
          existingPlanDiscount: 1.0,
          finalScore: rep.priorityScore || 92,
          explanation: rep.urgencyReasoning || rep.detectedIssue,
        },
        aiSynthesis: {
          headline: rep.detectedIssue || 'Verified real-time citizen demand.',
          reasoning: `1 verified citizen demand from ${rep.location?.blockOrTown || 'this locality'} (` + rep.detectedIssue.slice(0, 65) + `...)`,
          recommendedAction: 'Inspect and allocate high-priority mandate under MP LAD / District Quota.',
        },
        recentReports: [citizenRep],
      };
      clusters.push(newCluster);
    }
  }

  return clusters;
}
