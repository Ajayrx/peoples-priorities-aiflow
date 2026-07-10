// Single canonical source of truth for People's Priorities Citizen Reports & GIS Hotspots
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { getCloudConfig, hasValidFirebaseConfig } from './cloudConfig';
import type { CitizenReport, Hotspot, CategoryType, PriorityLevel, DashboardStats } from '../types';
import { saveReportToIndexedDB, getAllReportsFromIndexedDB, deleteReportFromIndexedDB } from './localLedgerDB';
import { mergeLiveReportsIntoClusters } from '../utils/clusterMerger';
import { runClusterEngine } from './ClusterEngine';
import type { LiveCitizenReport } from './liveCloudBus';

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

function getSafeFirestoreInstance() {
  if (!hasValidFirebaseConfig()) return null;
  const { firebaseConfig } = getCloudConfig();
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
    return getFirestore(app);
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
    return null;
  }
}

class CitizenReportServiceSingleton {
  private activeListeners: Set<(reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[]) => void> = new Set();
  private unsubFirestore: (() => void) | null = null;
  private currentReportsMap: Map<string, CitizenReport> = new Map();
  private baseHotspots: Hotspot[] = [];

  /**
   * Normalizes any raw data object (from Firestore, IndexedDB, or localStorage) into a canonical CitizenReport.
   */
  public normalizeReport(raw: any): CitizenReport {
    const id = raw.id || `rep-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const category: CategoryType = raw.category || 'Road';
    const priorityLevel: PriorityLevel = raw.priorityLevel || raw.priority || 'HIGH';
    const priorityScore = Number(raw.priorityScore || raw.aiConfidence || raw.aiProcessing?.aiConfidenceScore || 94);
    const title = raw.title || raw.detectedIssue || raw.name || 'Verified Locality Infrastructure Defect';
    const description = raw.description || raw.urgencyReasoning || raw.rawText || 'Verified citizen civic intake requiring immediate evaluation.';
    const photoUrl = raw.photoBase64 || raw.rawMediaUrl || (raw.images && raw.images.length > 0 ? raw.images[0] : undefined);
    const intakeMethod: 'VOICE' | 'PHOTO' | 'TEXT' = raw.inputMethod || raw.intakeType || (photoUrl ? 'PHOTO' : 'TEXT');
    const timestampStr = raw.timestamp || (raw.createdAt ? String(raw.createdAt) : 'Just now');
    
    const location = raw.location || {
      lat: raw.latitude || 20.5937,
      lng: raw.longitude || 78.9629,
      state: raw.state || 'India',
      district: raw.district || 'Nationwide District',
      constituency: raw.constituency || 'National PC',
      blockOrTown: raw.address || 'Verified Civic Locality',
      villageOrWard: 'Verified Citizen Pin',
    };

    const aiSummary = raw.aiSummary || raw.aiProcessing?.aiSummary || description;

    return {
      id,
      title,
      description,
      category,
      priority: priorityLevel,
      status: raw.status || raw.verificationStatus || 'VERIFIED',
      latitude: location.lat || 20.5937,
      longitude: location.lng || 78.9629,
      address: raw.address || location.blockOrTown || 'Verified Locality',
      images: photoUrl ? [photoUrl] : (raw.images || []),
      voiceUrl: raw.voiceUrl,
      createdAt: raw.createdAt || timestampStr,
      updatedAt: raw.updatedAt || timestampStr,
      userId: raw.userId || 'anonymous-citizen',
      verificationStatus: raw.verificationStatus || raw.status || 'VERIFIED',
      aiSummary,
      aiCategory: raw.aiCategory || category,
      aiPriority: raw.aiPriority || priorityLevel,
      aiConfidence: raw.aiConfidence || priorityScore,
      hotspotId: raw.hotspotId || raw.assignedHotspotId,

      // Canonical mappings for backward compatibility across all UI components
      timestamp: timestampStr,
      location: {
        lat: location.lat || 20.5937,
        lng: location.lng || 78.9629,
        state: location.state || 'India',
        district: location.district || 'Nationwide District',
        constituency: location.constituency || 'National PC',
        blockOrTown: location.blockOrTown || raw.address || 'Verified Locality',
        villageOrWard: location.villageOrWard || 'Ward / Village',
      },
      inputMethod: intakeMethod,
      intakeType: intakeMethod,
      rawMediaUrl: photoUrl,
      photoBase64: photoUrl,
      rawText: description,
      detectedIssue: title,
      urgencyReasoning: description,
      priorityLevel: priorityLevel,
      priorityScore: priorityScore,
      aiProcessing: raw.aiProcessing || {
        transcription: description,
        imageDefectDetected: photoUrl ? title : undefined,
        extractedKeywords: ['Citizen Report', category, location.blockOrTown || 'Locality'],
        sentimentUrgency: (priorityLevel === 'CRITICAL' || priorityLevel === 'HIGH' ? priorityLevel : 'NORMAL') as any,
        aiConfidenceScore: priorityScore,
        aiSummary: aiSummary,
      },
      assignedHotspotId: raw.assignedHotspotId || raw.hotspotId,
      duplicateStatus: raw.duplicateStatus || 'UNIQUE',
    };
  }

  /**
   * Converts canonical CitizenReport array into LiveCitizenReport array for clusterMerger compatibility.
   */
  public toLiveReports(reports: CitizenReport[]): LiveCitizenReport[] {
    return reports.map((r) => ({
      id: r.id,
      name: r.title || 'Verified Locality Demand',
      category: r.category,
      priorityLevel: r.priorityLevel || r.priority || 'HIGH',
      priorityScore: r.priorityScore || r.aiConfidence || 94,
      detectedIssue: r.detectedIssue || r.title || 'Verified Infrastructure Defect & Transit Gap',
      urgencyReasoning: r.urgencyReasoning || r.description || 'Verified citizen civic intake requiring immediate evaluation.',
      photoBase64: r.photoBase64 || r.rawMediaUrl || (r.images?.[0]),
      intakeType: r.intakeType || r.inputMethod || 'TEXT',
      timestamp: r.timestamp || 'Just now',
      location: {
        lat: r.location.lat,
        lng: r.location.lng,
        blockOrTown: r.location.blockOrTown,
      },
      isRealCloudItem: Boolean(r.id.startsWith('live-') || r.id !== 'mock'),
    }));
  }

  /**
   * Generates canonical Hotspots from canonical CitizenReports.
   */
  public getHotspots(reports: CitizenReport[], baseList: Hotspot[] = []): Hotspot[] {
    const liveReps = this.toLiveReports(reports);
    return mergeLiveReportsIntoClusters(baseList, liveReps);
  }

  /**
   * Generates canonical Ranked Priority List (sorted by confidence/priority score descending).
   */
  public getRankedPriorityList(reports: CitizenReport[]): CitizenReport[] {
    return [...reports].sort((a, b) => {
      const scoreA = a.priorityScore || a.aiConfidence || 0;
      const scoreB = b.priorityScore || b.aiConfidence || 0;
      return scoreB - scoreA;
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
      if (rep.priorityLevel === 'CRITICAL' || rep.priority === 'CRITICAL') {
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
  public async submitCitizenReport(payload: Partial<CitizenReport> & { photoBase64?: string; detectedIssue?: string; urgencyReasoning?: string; intakeType?: 'VOICE' | 'PHOTO' | 'TEXT' }): Promise<CitizenReport> {
    const newReport = this.normalizeReport({
      ...payload,
      id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: 'Just now',
    });

    // Save to map
    this.currentReportsMap.set(newReport.id, newReport);

    // Save to IndexedDB (zero quota limit, holds high-res images)
    await saveReportToIndexedDB(this.toLiveReports([newReport])[0]);

    // Non-blocking Cloud Firestore sync
    const db = getSafeFirestoreInstance();
    if (db) {
      const cloudPayload = {
        ...newReport,
        photoBase64: newReport.photoBase64 && newReport.photoBase64.length > 600000
          ? newReport.photoBase64.slice(0, 600000)
          : newReport.photoBase64,
        images: newReport.images?.map(img => img.length > 600000 ? img.slice(0, 600000) : img) || [],
        createdAt: serverTimestamp(),
      };
      addDoc(collection(db, 'citizen_reports'), cloudPayload)
        .then((docRef: any) => console.log('✅ Synchronized to Google Cloud Firestore:', docRef?.id))
        .catch((err) => console.warn('Cloud write fallback (stored in local ledger):', err.message));
    }

    // Save to localStorage safely
    try {
      const rawLocal = localStorage.getItem(STORAGE_KEY_REPORTS);
      const existing = rawLocal ? JSON.parse(rawLocal) : [];
      const safeForLocal = {
        ...newReport,
        photoBase64: newReport.photoBase64 && newReport.photoBase64.length > 100000 ? undefined : newReport.photoBase64,
        images: [],
      };
      const updated = [safeForLocal, ...existing].slice(0, 50);
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
    } catch (e) {
      console.warn('localStorage quota warning (safely in IndexedDB):', e);
    }

    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'NEW_REPORT', report: newReport });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('liveReportPublished', { detail: newReport }));
    }

    this.notifyAll();
    return newReport;
  }

  /**
   * Updates an existing citizen report.
   */
  public async updateCitizenReport(id: string, updates: Partial<CitizenReport>): Promise<void> {
    const existing = this.currentReportsMap.get(id);
    if (!existing) return;
    const updated = this.normalizeReport({ ...existing, ...updates });
    this.currentReportsMap.set(id, updated);
    await saveReportToIndexedDB(this.toLiveReports([updated])[0]);

    const db = getSafeFirestoreInstance();
    if (db && !id.startsWith('live-') && id !== 'mock') {
      try {
        await updateDoc(doc(db, 'citizen_reports', id), updates as any);
      } catch (err) {
        console.warn('Cloud update warning:', err);
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
    if (db && !id.startsWith('live-')) {
      try {
        await deleteDoc(doc(db, 'citizen_reports', id));
      } catch (err) {
        console.warn('Cloud delete warning:', err);
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
   * Guarantees EXACTLY ONE active Firestore onSnapshot listener regardless of how many pages subscribe.
   */
  public subscribe(
    onUpdate: (reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[]) => void
  ): () => void {
    this.activeListeners.add(onUpdate);

    // If this is our very first subscriber, start the single real-time Firestore listener
    if (this.activeListeners.size === 1) {
      this.startSingletonListener();
    } else {
      // Immediately emit current state to the new subscriber
      this.emitToListener(onUpdate);
    }

    return () => {
      this.activeListeners.delete(onUpdate);
      if (this.activeListeners.size === 0 && this.unsubFirestore) {
        this.unsubFirestore();
        this.unsubFirestore = null;
      }
    };
  }

  private getAllUnifiedReports(reportsList: CitizenReport[], hotspotsList: Hotspot[]): CitizenReport[] {
    const map = new Map<string, CitizenReport>();
    hotspotsList.forEach((hs) => {
      (hs.recentReports || []).forEach((r) => {
        const norm = this.normalizeReport({
          ...r,
          assignedHotspotId: hs.id,
          hotspotId: hs.id,
          location: r.location || hs.location?.center || { lat: 20.5937, lng: 78.9629, blockOrTown: hs.location?.blockOrTown || 'Verified Locality' },
          latitude: r.latitude || r.location?.lat || hs.location?.center?.lat || 20.5937,
          longitude: r.longitude || r.location?.lng || hs.location?.center?.lng || 78.9629,
        });
        map.set(norm.id, norm);
      });
    });
    reportsList.forEach((r) => {
      map.set(r.id, r);
    });
    return Array.from(map.values()).sort((a, b) => {
      const scoreA = a.priorityScore || a.aiConfidence || 90;
      const scoreB = b.priorityScore || b.aiConfidence || 90;
      return scoreB - scoreA;
    });
  }

  private emitToListener(onUpdate: (reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[]) => void) {
    const rawReportsList = Array.from(this.currentReportsMap.values());
    const hotspotsList = this.getHotspots(rawReportsList, this.baseHotspots);
    const unifiedReports = this.getAllUnifiedReports(rawReportsList, hotspotsList);
    const stats = this.getDashboardStats(unifiedReports, hotspotsList);
    const rankedList = this.getRankedPriorityList(unifiedReports);
    onUpdate(unifiedReports, hotspotsList, stats, rankedList);
  }

  private notifyAll() {
    const rawReportsList = Array.from(this.currentReportsMap.values());
    const hotspotsList = this.getHotspots(rawReportsList, this.baseHotspots);
    const unifiedReports = this.getAllUnifiedReports(rawReportsList, hotspotsList);
    const stats = this.getDashboardStats(unifiedReports, hotspotsList);
    const rankedList = this.getRankedPriorityList(unifiedReports);
    for (const listener of this.activeListeners) {
      listener(unifiedReports, hotspotsList, stats, rankedList);
    }
  }

  private async startSingletonListener() {
    // 1. Initial local load from IndexedDB and localStorage
    await this.refreshAndEmit();

    // 2. Setup single global Firestore subscription
    const db = getSafeFirestoreInstance();
    if (db && !this.unsubFirestore) {
      try {
        const q = query(collection(db, 'citizen_reports'), orderBy('createdAt', 'desc'), limit(50));
        this.unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const normalized = this.normalizeReport({ ...data, id: docSnap.id });
              this.currentReportsMap.set(normalized.id, normalized);
            });
            this.notifyAll();
          },
          (err) => {
            console.warn('Firestore subscription status:', err.message);
          }
        );
      } catch (e) {
        console.warn('Error connecting to Firestore:', e);
      }
    }

    // 3. Setup window and BroadcastChannel listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('liveReportPublished', () => this.refreshAndEmit());
      window.addEventListener('storage', () => this.refreshAndEmit());
    }
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', (evt) => {
        if (evt.data?.type === 'NEW_REPORT' && evt.data.report) {
          const norm = this.normalizeReport(evt.data.report);
          this.currentReportsMap.set(norm.id, norm);
          this.notifyAll();
        }
      });
    }
  }

  private async refreshAndEmit() {
    const indexedDBReports = await getAllReportsFromIndexedDB();
    for (const item of indexedDBReports) {
      const norm = this.normalizeReport(item);
      this.currentReportsMap.set(norm.id, norm);
    }

    try {
      const rawLocal = localStorage.getItem(STORAGE_KEY_REPORTS);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        for (const item of parsed) {
          if (!this.currentReportsMap.has(item.id)) {
            const norm = this.normalizeReport(item);
            this.currentReportsMap.set(norm.id, norm);
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
