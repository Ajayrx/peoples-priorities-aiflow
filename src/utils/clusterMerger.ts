import type { Hotspot, CitizenReport } from '../types';
import { runClusterEngine } from '../services/ClusterEngine';

/**
 * Merges live real-time citizen reports into spatial & category clusters using the Nationwide Cluster Engine.
 * Delegates density + category + proximity + time + AI similarity evaluations to `ClusterEngine.ts`.
 */
export function mergeLiveReportsIntoClusters(baseHotspots: Hotspot[], liveReports: CitizenReport[]): Hotspot[] {
  // Since we now enforce a strict canonical schema, we can pass liveReports directly to the cluster engine.
  const { clusters } = runClusterEngine(liveReports, baseHotspots);
  return clusters;
}
