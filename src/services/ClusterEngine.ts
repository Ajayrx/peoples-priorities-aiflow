import type { CitizenReport, Hotspot, PriorityLevel } from '../types';

/**
 * Configurable parameters for Nationwide GIS Clustering across all of India.
 */
export const CLUSTER_CONFIG = {
  /** Geographic proximity threshold in meters. Reports beyond this distance will not cluster together. */
  PROXIMITY_METERS: 300,
  /** Minimum number of recent reports required to form an active cluster (Emerging/Medium/High/Critical). */
  THRESHOLD: 10,
  /** Time window in days to consider active contributions. Older complaints contribute less to density weight. */
  TIME_WINDOW_DAYS: 90,
  /** Default fallback coordinates for all-India center if needed */
  INDIA_CENTER: { lat: 20.5937, lng: 78.9629 },
};

/**
 * Haversine formula to compute exact distance in meters between two GPS coordinates.
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parses age of a report in days based on createdAt or timestamp string.
 */
export function getReportAgeDays(report: CitizenReport): number {
  if (typeof report.createdAt === 'number') {
    return Math.max(0, (Date.now() - report.createdAt) / (1000 * 60 * 60 * 24));
  }
  if (typeof report.createdAt === 'string') {
    const parsed = Date.parse(report.createdAt);
    if (!isNaN(parsed)) {
      return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60 * 24));
    }
  }
  // Fallback for "Just now" or relative strings
  if (report.timestamp?.toLowerCase().includes('just now') || report.timestamp?.toLowerCase().includes('min')) {
    return 0.05;
  }
  if (report.timestamp?.toLowerCase().includes('hour')) {
    return 0.3;
  }
  if (report.timestamp?.toLowerCase().includes('day')) {
    const match = report.timestamp.match(/(\d+)\s*day/i);
    return match ? parseFloat(match[1]) : 2;
  }
  return 1; // Default recent
}

export function getReportTimestampMs(report: CitizenReport): number {
  if (report.createdAt) {
    if (typeof report.createdAt === 'number' && report.createdAt > 1000000000) {
      return report.createdAt > 100000000000 ? report.createdAt : report.createdAt * 1000;
    }
    if (typeof (report.createdAt as any)?.toDate === 'function') {
      const d = (report.createdAt as any).toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
    }
    if ((report.createdAt as any)?.seconds !== undefined) {
      return (report.createdAt as any).seconds * 1000;
    }
    if ((report.createdAt as any) instanceof Date && !isNaN((report.createdAt as any).getTime())) {
      return (report.createdAt as any).getTime();
    }
    if (typeof report.createdAt === 'string') {
      const parsed = Date.parse(report.createdAt);
      if (!isNaN(parsed)) return parsed;
    }
  }

  if (report.timestamp && typeof report.timestamp === 'string') {
    const tsLower = report.timestamp.toLowerCase();
    if (tsLower.includes('just now')) return Date.now();
    if (tsLower.includes('min')) {
      const m = tsLower.match(/(\d+)\s*min/);
      const mins = m ? parseInt(m[1], 10) : 5;
      return Date.now() - mins * 60 * 1000;
    }
    if (tsLower.includes('hour') || tsLower.includes('hr')) {
      const m = tsLower.match(/(\d+)\s*(hour|hr)/);
      const hrs = m ? parseInt(m[1], 10) : 1;
      return Date.now() - hrs * 60 * 60 * 1000;
    }
    if (tsLower.includes('day')) {
      const m = tsLower.match(/(\d+)\s*day/);
      const days = m ? parseInt(m[1], 10) : 1;
      return Date.now() - days * 24 * 60 * 60 * 1000;
    }
    const parsed = Date.parse(report.timestamp);
    if (!isNaN(parsed)) return parsed;
  }

  if (report.id && typeof report.id === 'string') {
    const m = report.id.match(/(\d{13})/);
    if (m) {
      const num = Number(m[1]);
      if (num > 1600000000000 && num < 2500000000000) return num;
    }
  }

  return 0;
}

/**
 * Checks if two citizen reports belong to the same category and semantic/geographic bucket.
 * 1. Must match Category exactly (e.g. Road vs Road). Never cluster Road + Water + School.
 * 2. Must be within CLUSTER_CONFIG.PROXIMITY_METERS (300m) OR match exact locality/ward string when coordinates are identical.
 * 3. Must be within recent time window (90 days).
 */
export function isSemanticClusterMatch(repA: CitizenReport, repB: CitizenReport): boolean {
  if (repA.category !== repB.category) {
    return false;
  }

  const ageA = getReportAgeDays(repA);
  const ageB = getReportAgeDays(repB);
  if (ageA > CLUSTER_CONFIG.TIME_WINDOW_DAYS || ageB > CLUSTER_CONFIG.TIME_WINDOW_DAYS) {
    return false;
  }

  const latA = repA.location?.lat || repA.latitude || 0;
  const lngA = repA.location?.lng || repA.longitude || 0;
  const latB = repB.location?.lat || repB.latitude || 0;
  const lngB = repB.location?.lng || repB.longitude || 0;

  const distance = calculateDistanceMeters(latA, lngA, latB, lngB);
  if (distance <= CLUSTER_CONFIG.PROXIMITY_METERS) {
    return true;
  }

  // If coordinates are regional block centers (e.g. exact same fallback lat/lng), check block/ward name similarity
  if (distance < 2000) {
    const blockA = (repA.location?.blockOrTown || repA.address || '').toLowerCase().trim();
    const blockB = (repB.location?.blockOrTown || repB.address || '').toLowerCase().trim();
    if (blockA && blockB && (blockA === blockB || blockA.includes(blockB) || blockB.includes(blockA))) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates weighted Priority Score (`0-100`) for a group of reports:
 * Priority Score = (Complaint Density × 40%) + (Population Impact × 25%) + (Severity × 20%) + (Verification × 10%) + (Recency × 5%)
 */
export function calculateWeightedPriorityScore(
  reports: CitizenReport[],
  impactedPopulation: number
): { finalScore: number; priorityLevel: PriorityLevel; breakdown: any } {
  const reportCount = reports.length;

  // 1. Complaint Density (40% weight): 35+ reports = 100 density score
  const densityScore = Math.min(100, (reportCount / 35) * 100);

  // 2. Population Impact (25% weight): 10,000+ population = 100 population score
  const populationScore = Math.min(100, (impactedPopulation / 10000) * 100);

  // 3. Severity (20% weight): average of aiConfidenceScore / sentiment urgency across reports
  let totalSeverity = 0;
  for (const rep of reports) {
    const urgency = rep.aiProcessing?.sentimentUrgency || rep.priorityLevel || rep.priority;
    if (urgency === 'CRITICAL') totalSeverity += 96;
    else if (urgency === 'HIGH') totalSeverity += 78;
    else if (urgency === 'MEDIUM') totalSeverity += 55;
    else totalSeverity += rep.priorityScore || rep.aiConfidence || 60;
  }
  const severityScore = reportCount > 0 ? Math.min(100, totalSeverity / reportCount) : 60;

  // 4. Verification Status (10% weight): ratio of verified reports
  let verifiedCount = 0;
  for (const rep of reports) {
    if (rep.verificationStatus === 'VERIFIED' || rep.status === 'VERIFIED') {
      verifiedCount += 1;
    }
  }
  const verificationScore = reportCount > 0 ? (verifiedCount / reportCount) * 100 : 100;

  // 5. Recency (5% weight): based on average age in days (< 7 days = 100 score, up to 90 days)
  let totalAgeDays = 0;
  for (const rep of reports) {
    totalAgeDays += getReportAgeDays(rep);
  }
  const avgAgeDays = reportCount > 0 ? totalAgeDays / reportCount : 1;
  const recencyScore = Math.max(10, 100 - Math.min(100, (avgAgeDays / CLUSTER_CONFIG.TIME_WINDOW_DAYS) * 100));

  // Compute final weighted sum
  const rawScore =
    densityScore * 0.4 +
    populationScore * 0.25 +
    severityScore * 0.2 +
    verificationScore * 0.1 +
    recencyScore * 0.05;

  const finalScore = Math.round(Math.min(100, Math.max(1, rawScore)));

  // Classify based on score & threshold
  let priorityLevel: PriorityLevel = 'MONITORED';
  if (reportCount < CLUSTER_CONFIG.THRESHOLD || finalScore < 40) {
    priorityLevel = 'MONITORED'; // Remain individual violet markers (🟣)
  } else if (finalScore >= 80) {
    priorityLevel = 'CRITICAL'; // 🔴 Red Critical Cluster
  } else if (finalScore >= 60) {
    priorityLevel = 'HIGH'; // 🟠 Orange High Cluster
  } else {
    priorityLevel = 'MEDIUM'; // 🟡 Yellow Medium Cluster
  }

  return {
    finalScore,
    priorityLevel,
    breakdown: {
      demandVelocityMultiplier: Math.round(densityScore),
      demographicImpactMultiplier: Math.round(populationScore),
      infrastructureGapMultiplier: Math.round(severityScore),
      seasonalUrgencyMultiplier: Math.round(verificationScore),
      aiConfidenceMultiplier: Math.round(recencyScore),
      existingPlanDiscount: 1.0,
      finalScore,
      explanation: `Weighted Score ${finalScore}/100 based on ${reportCount} submissions across ${impactedPopulation.toLocaleString()} affected population.`,
    },
  };
}

/**
 * Main Nationwide Cluster Engine run loop.
 * Takes all canonical citizen reports across India, groups them by proximity (<300m) + category + locality within the last 90 days,
 * and splits them into active `clusters` (>= 10 reports and score >= 40) vs `individualReports` (< 10 reports or score < 40).
 */
export function runClusterEngine(allReports: CitizenReport[], baseHotspots: Hotspot[] = []): {
  clusters: Hotspot[];
  individualReports: CitizenReport[];
  emergingClusters: Hotspot[];
} {
  if (!allReports || allReports.length === 0) {
    return { clusters: baseHotspots, individualReports: [], emergingClusters: [] };
  }

  // 1. Group reports into candidate clusters
  const candidateGroups: { reports: CitizenReport[]; baseCluster?: Hotspot }[] = [];

  // Pre-populate candidate groups from existing base hotspots if applicable
  const baseHotspotMap = new Map<string, Hotspot>();
  for (const bh of baseHotspots) {
    baseHotspotMap.set(bh.id, bh);
  }

  for (const rep of allReports) {
    let matchedGroup: { reports: CitizenReport[]; baseCluster?: Hotspot } | undefined = undefined;

    // First check if rep explicitly belongs to an existing candidate group by semantic cluster rules
    for (const group of candidateGroups) {
      if (group.reports.length > 0 && isSemanticClusterMatch(group.reports[0], rep)) {
        matchedGroup = group;
        break;
      }
    }

    if (matchedGroup) {
      matchedGroup.reports.push(rep);
    } else {
      // Check if rep matches one of the base hotspots
      let matchedBase: Hotspot | undefined = undefined;
      if (rep.assignedHotspotId && baseHotspotMap.has(rep.assignedHotspotId)) {
        matchedBase = baseHotspotMap.get(rep.assignedHotspotId);
      } else if (rep.hotspotId && baseHotspotMap.has(rep.hotspotId)) {
        matchedBase = baseHotspotMap.get(rep.hotspotId);
      } else {
        for (const bh of baseHotspots) {
          if (bh.category === rep.category) {
            const dist = calculateDistanceMeters(
              bh.location.center.lat,
              bh.location.center.lng,
              rep.location?.lat || rep.latitude || 0,
              rep.location?.lng || rep.longitude || 0
            );
            if (dist <= CLUSTER_CONFIG.PROXIMITY_METERS || (dist < 2000 && bh.location.blockOrTown.toLowerCase().includes((rep.location?.blockOrTown || '').toLowerCase()))) {
              matchedBase = bh;
              break;
            }
          }
        }
      }

      candidateGroups.push({
        reports: [rep],
        baseCluster: matchedBase,
      });
    }
  }

  const clusters: Hotspot[] = [];
  const emergingClusters: Hotspot[] = [];
  const individualReports: CitizenReport[] = [];

  // 2. Evaluate each candidate group with weighted scoring & threshold rules
  for (const group of candidateGroups) {
    const repCount = group.reports.length;
    const firstRep = group.reports[0];

    // Calculate center coordinates
    let sumLat = 0;
    let sumLng = 0;
    for (const r of group.reports) {
      sumLat += r.location?.lat || r.latitude || CLUSTER_CONFIG.INDIA_CENTER.lat;
      sumLng += r.location?.lng || r.longitude || CLUSTER_CONFIG.INDIA_CENTER.lng;
    }
    const centerLat = repCount > 0 ? sumLat / repCount : CLUSTER_CONFIG.INDIA_CENTER.lat;
    const centerLng = repCount > 0 ? sumLng / repCount : CLUSTER_CONFIG.INDIA_CENTER.lng;

    // Estimate population impacted based on base cluster or density
    const basePop = group.baseCluster?.metrics.impactedPopulation || (repCount * 380 + 2500);
    const { finalScore, priorityLevel, breakdown } = calculateWeightedPriorityScore(group.reports, basePop);

    const blockOrTownName = group.baseCluster?.location.blockOrTown || firstRep.location?.blockOrTown || firstRep.address || 'Verified Locality';
    const constituencyName = firstRep.location?.constituency || group.baseCluster?.location.constituency || 'Regional PC';

    // If candidate has < CLUSTER_CONFIG.THRESHOLD OR score < 40, treat individual reports as Monitored violet markers (🟣)
    // UNLESS it is already a pre-existing curated cluster from baseHotspots with priorityLevel !== 'MONITORED'
    const isPreExistingActive = group.baseCluster && group.baseCluster.priorityLevel !== 'MONITORED' && group.baseCluster.metrics.citizenReportCount >= CLUSTER_CONFIG.THRESHOLD;

    if (!isPreExistingActive && (repCount < CLUSTER_CONFIG.THRESHOLD || priorityLevel === 'MONITORED')) {
      // These remain individual violet markers (🟣)
      for (const r of group.reports) {
        individualReports.push({
          ...r,
          priorityLevel: 'MONITORED',
          priorityScore: r.priorityScore || finalScore || 35,
        });
      }

      // If repCount is between 4 and 9, mark as Emerging Cluster for Hero Radar awareness
      if (repCount >= 4 && repCount < CLUSTER_CONFIG.THRESHOLD) {
        emergingClusters.push({
          id: group.baseCluster?.id || `emerging-${firstRep.id}`,
          name: `${blockOrTownName} • ${firstRep.category} Emerging Cluster`,
          category: firstRep.category,
          location: {
            center: { lat: centerLat, lng: centerLng },
            boundingRadiusMeters: CLUSTER_CONFIG.PROXIMITY_METERS,
            blockOrTown: blockOrTownName,
            constituency: constituencyName,
          },
          clusterSizeClass: 'small',
          metrics: {
            citizenReportCount: repCount,
            reportGrowthVelocity: `Emerging cluster (${repCount}/${CLUSTER_CONFIG.THRESHOLD} needed for active mandate)`,
            impactedPopulation: basePop,
            nearbySchoolsCount: group.baseCluster?.metrics.nearbySchoolsCount || 1,
            nearbyHealthCentresCount: group.baseCluster?.metrics.nearbyHealthCentresCount || 0,
            infrastructureStatus: 'Poor',
          },
          existingDevelopmentPlan: group.baseCluster?.existingDevelopmentPlan || { hasProposal: false },
          priorityLevel: 'MONITORED',
          priorityScore: finalScore,
          priorityBreakdown: breakdown,
          aiSynthesis: {
            headline: `${repCount} emerging citizen intakes tracked in ${blockOrTownName}.`,
            reasoning: `Requires ${CLUSTER_CONFIG.THRESHOLD - repCount} additional verified reports within 300m to elevate to Active Action Mandate.`,
            recommendedAction: `Continue monitoring citizen submissions across ${blockOrTownName}.`,
          },
          recentReports: group.reports,
        });
      }
    } else {
      // Active Cluster (Medium 🟡, High 🟠, or Critical 🔴)
      const activeCluster: Hotspot = {
        id: group.baseCluster?.id || `cluster-${firstRep.id}-${firstRep.category.toLowerCase()}`,
        name: group.baseCluster?.name || `${blockOrTownName} • ${firstRep.category} Demand Cluster`,
        category: firstRep.category,
        location: {
          center: { lat: centerLat, lng: centerLng },
          boundingRadiusMeters: Math.max(300, Math.min(1500, repCount * 30)),
          blockOrTown: blockOrTownName,
          constituency: constituencyName,
        },
        clusterSizeClass: repCount > 35 ? 'large' : repCount > 20 ? 'medium' : 'small',
        metrics: {
          citizenReportCount: Math.max(group.baseCluster?.metrics.citizenReportCount || 0, repCount),
          reportGrowthVelocity: `+${repCount} verified citizen demands across ${blockOrTownName}`,
          impactedPopulation: basePop,
          nearbySchoolsCount: group.baseCluster?.metrics.nearbySchoolsCount || 2,
          nearbyHealthCentresCount: group.baseCluster?.metrics.nearbyHealthCentresCount || 1,
          infrastructureStatus: priorityLevel === 'CRITICAL' ? 'Critical' : 'Poor',
        },
        existingDevelopmentPlan: group.baseCluster?.existingDevelopmentPlan || { hasProposal: false },
        priorityLevel: priorityLevel,
        priorityScore: finalScore,
        priorityBreakdown: breakdown,
        aiSynthesis: {
          headline: group.baseCluster?.aiSynthesis.headline || `High density ${firstRep.category} priority cluster in ${blockOrTownName}.`,
          reasoning: group.baseCluster?.aiSynthesis.reasoning || `Aggregated ${repCount} citizen voice/photo/text verified complaints with ${finalScore}/100 priority score.`,
          recommendedAction: group.baseCluster?.aiSynthesis.recommendedAction || `Immediate engineering evaluation recommended under ${constituencyName} mandate.`,
        },
        recentReports: group.reports,
      };

      clusters.push(activeCluster);
    }
  }

  // Sort clusters descending by priority score
  clusters.sort((a, b) => b.priorityScore - a.priorityScore);
  emergingClusters.sort((a, b) => b.priorityScore - a.priorityScore);

  // Sort individual reports strictly descending by date / creation timestamp (latest complaint on top)
  individualReports.sort((a, b) => {
    const timeA = getReportTimestampMs(a);
    const timeB = getReportTimestampMs(b);
    if (timeB !== timeA) return timeB - timeA;
    return (b.priorityScore || b.aiConfidence || 90) - (a.priorityScore || a.aiConfidence || 90);
  });

  return {
    clusters,
    individualReports,
    emergingClusters,
  };
}
