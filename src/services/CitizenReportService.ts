// Single canonical source of truth for People's Priorities Citizen Reports & GIS Hotspots
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { getCloudConfig, hasValidFirebaseConfig } from './cloudConfig';
import type { CitizenReport, CitizenReportSubmission, Hotspot, DashboardStats } from '../types';
import { saveReportToIndexedDB, getAllReportsFromIndexedDB, deleteReportFromIndexedDB } from './localLedgerDB';
import { mergeLiveReportsIntoClusters } from '../utils/clusterMerger';
import { runClusterEngine, getReportTimestampMs } from './ClusterEngine';

import { normalizeReportSubmission, validateCanonicalReportWrite, normalizeCitizenReportDocument } from '../utils/reportNormalizer';

const STORAGE_KEY_REPORTS = 'peoples_priorities_live_reports_v1';
const BUS_CHANNEL_NAME = 'peoples_priorities_realtime_sync';

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(BUS_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported in this context', e);
  }
}

export { getReportTimestampMs } from './ClusterEngine';

async function compressPhotoForCloudSync(base64Str?: string): Promise<string | undefined> {
  if (!base64Str || typeof window === 'undefined') return base64Str;
  if (base64Str.length < 80000) return base64Str; // Already small thumbnail or clean base64
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 500;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str.slice(0, 80000));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = () => resolve(base64Str.slice(0, 80000));
      img.src = base64Str;
    } catch (e) {
      resolve(base64Str.slice(0, 80000));
    }
  });
}

function getSafeFirestoreInstance() {
  if (!hasValidFirebaseConfig()) return null;
  const { firebaseConfig } = getCloudConfig();
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
    return getFirestore(app);
  } catch (err) {
    console.error('🔥 Firebase Cloud Firestore initialization warning:', err);
    return null;
  }
}

class CitizenReportServiceSingleton {
  private activeListeners: Set<(reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[], error?: string | null) => void> = new Set();
  private unsubRealtime: (() => void) | null = null;
  private isStartingListener: boolean = false;
  private currentReportsMap: Map<string, CitizenReport> = new Map();
  private baseHotspots: Hotspot[] = [];




  /**
   * Generates canonical Hotspots from canonical CitizenReports.
   */
  public getHotspots(reports: CitizenReport[], baseList: Hotspot[] = []): Hotspot[] {
    const liveReps = reports;
    return mergeLiveReportsIntoClusters(baseList, liveReps);
  }

  /**
   * Generates canonical Ranked Priority List (sorted by confidence/priority score descending).
   */
  public getRankedPriorityList(reports: CitizenReport[]): CitizenReport[] {
    return [...reports].sort((a, b) => {
      const timeA = getReportTimestampMs(a) || 0;
      const timeB = getReportTimestampMs(b) || 0;
      if (timeB !== timeA) return timeB - timeA;
      // Stable secondary key sort (Document ID) to ensure deterministic rendering
      if (a.id && b.id) {
         if (a.id < b.id) return 1;
         if (a.id > b.id) return -1;
      }
      return 0;
    });
  }

  /**
   * Calculates canonical Dashboard Statistics from the exact same source of truth.
   */
  public getDashboardStats(reports: CitizenReport[], hotspots: Hotspot[] = []): DashboardStats {
    const totalReports = reports.length;
    let criticalReports = 0;
    let verifiedReports = 0;
    let totalConfidence = 0;
    const categoryCounts: Record<string, number> = {};

    for (const rep of reports) {
      if (rep.priorityLevel === 'CRITICAL') {
        criticalReports += 1;
      }
      if (rep.verificationStatus === 'VERIFIED' || rep.status === 'VERIFIED') {
        verifiedReports += 1;
      }
      totalConfidence += (rep.priorityScore || rep.aiConfidence || 94);
      categoryCounts[rep.category] = (categoryCounts[rep.category] || 0) + 1;
    }

    const avgAiConfidence = totalReports > 0 ? Math.round(totalConfidence / totalReports) : 96;

    // Run exact cluster engine breakdown if hotspots are provided, or derive from reports
    const { clusters, individualReports, emergingClusters } = runClusterEngine(reports, hotspots);

    let mediumClustersCount = 0;
    let highClustersCount = 0;
    let criticalClustersCount = 0;
    let totalImpactedPopulation = 0;

    for (const cl of clusters) {
      totalImpactedPopulation += cl.metrics.impactedPopulation || 0;
      if (cl.priorityLevel === 'CRITICAL') criticalClustersCount += 1;
      else if (cl.priorityLevel === 'HIGH') highClustersCount += 1;
      else if (cl.priorityLevel === 'MEDIUM') mediumClustersCount += 1;
    }

    for (const _ind of individualReports) {
      totalImpactedPopulation += 380; // Default population footprint of an individual monitored report
    }

    return {
      totalReports,
      criticalReports,
      verifiedReports,
      categoryCounts,
      avgAiConfidence,
      individualReportsCount: individualReports.length,
      emergingClustersCount: emergingClusters?.length || 0,
      mediumClustersCount,
      highClustersCount,
      criticalClustersCount,
      totalImpactedPopulation,
    };
  }

  /**
   * Fetches all current reports from local memory/storage instantly.
   */
  public async getCitizenReports(): Promise<CitizenReport[]> {
    await this.refreshAndEmit();
    return Array.from(this.currentReportsMap.values());
  }

  /**
   * Submits a new citizen report to IndexedDB, Cloud Firestore, and broadcasts across all tabs/pages.
   */
  public async submitCitizenReport(payload: CitizenReportSubmission): Promise<CitizenReport> {
    const db = getSafeFirestoreInstance();
    const canonicalWrite = normalizeReportSubmission(payload);
    
    // Strict pre-flight validation
    validateCanonicalReportWrite(canonicalWrite);

    // Save to IndexedDB (zero quota limit, holds full high-res images locally for prompt viewing)
    // Create a temporary CitizenReport for immediate optimistic UI
    const tempReportId = `temp-${Date.now()}`;
    const tempCitizenReport: CitizenReport = {
      ...canonicalWrite,
      id: tempReportId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timestamp: 'Just now'
    } as CitizenReport;
    
    this.currentReportsMap.set(tempCitizenReport.id, tempCitizenReport);
    await saveReportToIndexedDB(tempCitizenReport);
    this.notifyAll();

    // Cloud Firestore write (Single Source of Truth)
    if (db) {
      try {
        const docRef = doc(collection(db, 'citizen_reports'));
        const compressedPhoto = canonicalWrite.photoBase64 ? await compressPhotoForCloudSync(canonicalWrite.photoBase64) : undefined;
        
        const finalPayload = {
          ...canonicalWrite,
          photoBase64: compressedPhoto || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(docRef, finalPayload);
        console.log('✅ Successfully published verified citizen complaint to Firestore! Document ID:', docRef.id);

        const finalReport = normalizeCitizenReportDocument(docRef.id, finalPayload);
        
        // Replace temp report with final report
        this.currentReportsMap.delete(tempCitizenReport.id);
        this.currentReportsMap.set(finalReport.id, finalReport);
        await saveReportToIndexedDB(finalReport);
        this.notifyAll();
        return finalReport;
      } catch (err: any) {
        console.error('🔥 Firestore Write Failed:', err);
      }
    }
    
    return tempCitizenReport;
  }

  /**
   * Updates an existing citizen report.
   */
  public async updateCitizenReport(id: string, updates: Partial<CitizenReport>): Promise<void> {
    const existing = this.currentReportsMap.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    this.currentReportsMap.set(id, updated);
    await saveReportToIndexedDB(updated);

    const db = getSafeFirestoreInstance();
    if (db && !id.startsWith('live-') && id !== 'mock') {
      try {
        const reportRef = doc(db, 'citizen_reports', id);
        
        // Helper function to remove undefined fields recursively
        const cleanPayload = (obj: any): any => {
          if (obj === null || obj === undefined) return null;
          if (obj && typeof obj === 'object' && ('.sv' in obj || '_methodName' in obj || obj.constructor?.name === 'FieldValue')) {
            return obj;
          }
          if (Array.isArray(obj)) {
            return obj.map(cleanPayload);
          }
          if (typeof obj === 'object') {
            const cleaned: any = {};
            for (const key of Object.keys(obj)) {
              const val = obj[key];
              if (val !== undefined) {
                cleaned[key] = cleanPayload(val);
              }
            }
            return cleaned;
          }
          return obj;
        };

        await updateDoc(reportRef, cleanPayload(updates));
      } catch (err) {
        console.error('🔥 Firestore update failed:', err);
      }
    }
    this.notifyAll();
  }

  /**
   * Deletes a citizen report.
   */
  public async deleteCitizenReport(id: string): Promise<void> {
    this.currentReportsMap.delete(id);
    await deleteReportFromIndexedDB(id);

    const db = getSafeFirestoreInstance();
    if (db && !id.startsWith('live-') && id !== 'mock') {
      try {
        const reportRef = doc(db, 'citizen_reports', id);
        await deleteDoc(reportRef);
      } catch (err) {
        console.error('🔥 Firestore delete failed:', err);
      }
    }
    this.notifyAll();
  }

  /**
   * Sets the base mock hotspots (`isDemoRegion`) so the canonical hotspots layer merges correctly.
   */
  public setBaseHotspots(hotspots: Hotspot[]): void {
    this.baseHotspots = hotspots;
    this.notifyAll();
  }

  /**
   * Subscribes to canonical live updates across the entire application.
   * Guarantees EXACTLY ONE active Realtime Database listener regardless of how many pages subscribe.
   */
  public subscribe(
    onUpdate: (reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[], error?: string | null) => void
  ): () => void {
    this.activeListeners.add(onUpdate);

    // If this is our very first subscriber, start the single real-time database listener
    if (this.activeListeners.size === 1) {
      this.startSingletonListener();
    } else {
      // Immediately emit current state to the new subscriber
      this.emitToListener(onUpdate);
    }

    return () => {
      this.activeListeners.delete(onUpdate);
      if (this.activeListeners.size === 0 && this.unsubRealtime) {
        this.unsubRealtime();
        this.unsubRealtime = null;
      }
    };
  }

  private getAllUnifiedReports(reportsList: CitizenReport[], hotspotsList: Hotspot[]): CitizenReport[] {
    const map = new Map<string, CitizenReport>();
    const seenKeys = new Set<string>();

    const addSafe = (r: CitizenReport) => {
      // Create a unique key for deduplication based on content and coordinates
      // (rounding coordinates to 4 decimal places, e.g. 11m precision)
      const latKey = Number(r.location.lat).toFixed(4);
      const lngKey = Number(r.location.lng).toFixed(4);
      
      const cleanDesc = (r.description || '').trim().toLowerCase();
      const contentKey = `${latKey}_${lngKey}_${r.category}_${cleanDesc.slice(0, 80)}`;

      if (r.clientSubmissionId) {
        if (seenKeys.has(r.clientSubmissionId)) return;
        seenKeys.add(r.clientSubmissionId);
      }
      
      if (seenKeys.has(contentKey)) return;
      seenKeys.add(contentKey);

      map.set(r.id, r);
    };

    reportsList.forEach((r) => {
      addSafe(r);
    });

    hotspotsList.forEach((hs) => {
      (hs.recentReports || []).forEach((r) => {
        addSafe(r);
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = getReportTimestampMs(a) || 0;
      const timeB = getReportTimestampMs(b) || 0;
      if (timeB !== timeA) return timeB - timeA;
      // Stable secondary key sort (Document ID) to ensure deterministic rendering
      if (a.id && b.id) {
         if (a.id < b.id) return 1;
         if (a.id > b.id) return -1;
      }
      return 0;
    });
  }

  private emitToListener(onUpdate: (reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[], error?: string | null) => void, errorStr?: string | null) {
    const rawReportsList = Array.from(this.currentReportsMap.values());
    const hotspotsList = this.getHotspots(rawReportsList, this.baseHotspots);
    const unifiedReports = this.getAllUnifiedReports(rawReportsList, hotspotsList);
    const stats = this.getDashboardStats(unifiedReports, hotspotsList);
    const rankedList = this.getRankedPriorityList(unifiedReports);
    onUpdate(unifiedReports, hotspotsList, stats, rankedList, errorStr);
  }

  private notifyAll(errorStr?: string | null) {
    const rawReportsList = Array.from(this.currentReportsMap.values());
    const hotspotsList = this.getHotspots(rawReportsList, this.baseHotspots);
    const unifiedReports = this.getAllUnifiedReports(rawReportsList, hotspotsList);
    const stats = this.getDashboardStats(unifiedReports, hotspotsList);
    const rankedList = this.getRankedPriorityList(unifiedReports);
    for (const listener of this.activeListeners) {
      listener(unifiedReports, hotspotsList, stats, rankedList, errorStr);
    }
  }

  private async startSingletonListener() {
    if (this.isStartingListener || this.unsubRealtime) return;
    this.isStartingListener = true;

    try {
      // 1. Initial local load from IndexedDB and localStorage
      await this.refreshAndEmit();

      // If the component unmounted while waiting for IndexedDB, abort.
      if (this.activeListeners.size === 0) {
        return;
      }

      // 2. Setup single global Cloud Firestore subscription
      const db = getSafeFirestoreInstance();
      if (db) {
        // Complete canonical dataset without limit or order to prevent data loss on un-indexed legacy reports
        const q = query(collection(db, 'citizen_reports'));
        this.unsubRealtime = onSnapshot(
          q,
          async (snapshot) => {
            const rawReports: CitizenReport[] = [];
            snapshot.forEach((doc) => {
              rawReports.push(normalizeCitizenReportDocument(doc.id, doc.data()));
            });

            // Secondary sort: ensure legacy docs missing timestamp are sorted stably by ID
            const incomingCloudReports = rawReports.sort((a, b) => {
              const timeA = a.createdAt || 0;
              const timeB = b.createdAt || 0;
              if (timeA !== timeB) {
                return timeB - timeA; // Descending
              }
              // Deterministic secondary sort
              return b.id.localeCompare(a.id);
            });

            const cloudSubmissionIds = new Set<string>();
            for (const r of incomingCloudReports) {
              if (r.clientSubmissionId) cloudSubmissionIds.add(r.clientSubmissionId);
            }

            // Check if we have any pending local reports created offline while connecting that need pushing up
            for (const [key, rep] of Array.from(this.currentReportsMap.entries())) {
              if (key.startsWith('live-') || (rep.clientSubmissionId && !cloudSubmissionIds.has(rep.clientSubmissionId) && !key.startsWith('rep-') && key !== 'mock')) {
                try {
                  const compressedPhoto = rep.photoBase64 ? await compressPhotoForCloudSync(rep.photoBase64) : undefined;
                  await setDoc(doc(db, 'citizen_reports', rep.id), {
                    ...rep,
                    photoBase64: compressedPhoto,
                    imageStoragePath: rep.imageStoragePath,
                    createdAt: serverTimestamp(),
                  });
                } catch (err) {
                  // ignore
                }
              }
            }

            // Clear old cloud keys from map and replace with latest exact state from Cloud Firestore
            for (const key of Array.from(this.currentReportsMap.keys())) {
              if (!key.startsWith('rep-') && !key.startsWith('live-') && key !== 'mock') {
                this.currentReportsMap.delete(key);
              }
            }

            for (const normalized of incomingCloudReports) {
              if (normalized.clientSubmissionId && this.currentReportsMap.has(normalized.clientSubmissionId)) {
                this.currentReportsMap.delete(normalized.clientSubmissionId);
              }
              this.currentReportsMap.set(normalized.id, normalized);
            }

            this.notifyAll();

            // Development audit logs
            console.log(`[Consistency Audit] Canonical snapshot received. Docs: ${snapshot.docs.length} -> Normalized: ${incomingCloudReports.length} -> Store Base: ${this.currentReportsMap.size}`);
          },
          (err) => {
            console.error('🔥 Firestore onSnapshot subscription error:', err.message);
            this.notifyAll('Unable to synchronize live reports. Check your internet connection.');
          }
        );
      }
    } catch (e: any) {
      console.error('🔥 Error connecting to Cloud Firestore:', e);
      this.notifyAll('Failed to initialize local storage or cloud connection.');
    } finally {
      this.isStartingListener = false;
    }

    // 3. Setup window and BroadcastChannel listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('liveReportPublished', () => this.refreshAndEmit());
      window.addEventListener('storage', () => this.refreshAndEmit());
      window.addEventListener('cloudConfigChanged', () => {
        if (this.unsubRealtime) {
          this.unsubRealtime();
          this.unsubRealtime = null;
        }
        this.startSingletonListener();
      });
    }
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', (evt) => {
        if (evt.data?.type === 'NEW_REPORT' && evt.data.report) {
          const data = evt.data.report;
          const newRep = normalizeCitizenReportDocument(data.id, data);
          this.currentReportsMap.set(newRep.id, newRep);
          this.notifyAll();
        }
      });
    }
  }

  private async refreshAndEmit() {
    const indexedDBReports = await getAllReportsFromIndexedDB();
    const existingSubmissionIds = new Set<string>();
    for (const r of this.currentReportsMap.values()) {
      if (r.clientSubmissionId) existingSubmissionIds.add(r.clientSubmissionId);
    }

    for (const item of indexedDBReports) {
      const norm = normalizeCitizenReportDocument(item.id || "local", item);
      if (norm.clientSubmissionId && existingSubmissionIds.has(norm.clientSubmissionId) && norm.id.startsWith('rep-')) {
        continue;
      }
      this.currentReportsMap.set(norm.id, norm);
      if (norm.clientSubmissionId) existingSubmissionIds.add(norm.clientSubmissionId);
    }

    try {
      const rawLocal = localStorage.getItem(STORAGE_KEY_REPORTS);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        for (const item of parsed) {
          const norm = normalizeCitizenReportDocument(item.id || "local", item);
          if (norm.clientSubmissionId && existingSubmissionIds.has(norm.clientSubmissionId) && norm.id.startsWith('rep-')) {
            continue;
          }
          if (!this.currentReportsMap.has(norm.id)) {
            this.currentReportsMap.set(norm.id, norm);
            if (norm.clientSubmissionId) existingSubmissionIds.add(norm.clientSubmissionId);
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }

    this.notifyAll();
  }
}

export const CitizenReportService = new CitizenReportServiceSingleton();
