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
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { getCloudConfig, hasValidFirebaseConfig } from './cloudConfig';
import type { CitizenReport, Hotspot, CategoryType, PriorityLevel, DashboardStats } from '../types';
import { saveReportToIndexedDB, getAllReportsFromIndexedDB, deleteReportFromIndexedDB } from './localLedgerDB';
import { mergeLiveReportsIntoClusters } from '../utils/clusterMerger';
import { runClusterEngine, getReportTimestampMs } from './ClusterEngine';
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
  private activeListeners: Set<(reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[]) => void> = new Set();
  private unsubRealtime: (() => void) | null = null;
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
    
    const formatDayDateTime = (dateObj: Date): string => {
      if (isNaN(dateObj.getTime())) return 'Sat, 11 Jul • 11:45 AM';
      const day = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
      const date = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const time = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      return `${day}, ${date} • ${time}`;
    };

    let timestampStr = raw.timestamp;
    if (!timestampStr || timestampStr === 'Just now' || timestampStr === 'Updated just now' || timestampStr.toLowerCase().includes('just now')) {
      if (raw.createdAt) {
        if (typeof raw.createdAt === 'number' && raw.createdAt > 1000000000) {
          const ms = raw.createdAt > 100000000000 ? raw.createdAt : raw.createdAt * 1000;
          timestampStr = formatDayDateTime(new Date(ms));
        } else if (typeof raw.createdAt?.toDate === 'function') {
          timestampStr = formatDayDateTime(raw.createdAt.toDate());
        } else if (raw.createdAt?.seconds !== undefined) {
          timestampStr = formatDayDateTime(new Date(raw.createdAt.seconds * 1000));
        } else if (raw.createdAt instanceof Date) {
          timestampStr = formatDayDateTime(raw.createdAt);
        } else if (typeof raw.createdAt === 'string') {
          const parsed = new Date(raw.createdAt);
          timestampStr = !isNaN(parsed.getTime()) ? formatDayDateTime(parsed) : raw.createdAt;
        } else {
          timestampStr = formatDayDateTime(new Date());
        }
      } else {
        timestampStr = formatDayDateTime(new Date());
      }
    } else if (typeof timestampStr === 'string' && !timestampStr.includes('•') && !timestampStr.includes('ago')) {
      const parsed = new Date(timestampStr);
      if (!isNaN(parsed.getTime())) {
        timestampStr = formatDayDateTime(parsed);
      }
    }
    
    const rawLoc = raw.location || {};
    const location = {
      lat: rawLoc.lat || raw.latitude || 20.5937,
      lng: rawLoc.lng || raw.longitude || 78.9629,
      state: rawLoc.state || raw.state || 'India',
      district: rawLoc.district || raw.district || 'Nationwide District',
      constituency: rawLoc.constituency || raw.constituency || 'National PC',
      blockOrTown: rawLoc.blockOrTown || raw.address || 'Verified Civic Locality',
      villageOrWard: rawLoc.villageOrWard || 'Verified Citizen Pin',
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
      clientSubmissionId: raw.clientSubmissionId || (raw.id && typeof raw.id === 'string' && raw.id.startsWith('rep-') ? raw.id : undefined),

      // Canonical mappings for backward compatibility across all UI components
      timestamp: timestampStr,
      location: {
        lat: location.lat || 20.5937,
        lng: location.lng || 78.9629,
        state: location.state || 'India',
        district: location.district || 'Nationwide District',
        constituency: location.constituency || 'National PC',
        blockOrTown: location.blockOrTown || raw.address || 'Verified Civic Locality',
        villageOrWard: location.villageOrWard || 'Ward / Village',
      },
      inputMethod: intakeMethod,
      intakeType: intakeMethod,
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
      imageStoragePath: r.imageStoragePath,
      voiceUrl: r.voiceUrl,
      intakeType: r.intakeType || r.inputMethod || 'TEXT',
      timestamp: (r.timestamp && !r.timestamp.toLowerCase().includes('just now')) ? r.timestamp : new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ' • ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(),
      location: {
        lat: r.location.lat,
        lng: r.location.lng,
        state: r.location.state,
        district: r.location.district,
        constituency: r.location.constituency,
        blockOrTown: r.location.blockOrTown,
        villageOrWard: r.location.villageOrWard,
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
      const timeA = getReportTimestampMs(a);
      const timeB = getReportTimestampMs(b);
      if (timeB !== timeA) return timeB - timeA;
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
  public async submitCitizenReport(payload: Partial<CitizenReport> & { photoBase64?: string; imageStoragePath?: string; detectedIssue?: string; urgencyReasoning?: string; intakeType?: 'VOICE' | 'PHOTO' | 'TEXT' }): Promise<CitizenReport> {
    const db = getSafeFirestoreInstance();
    let newReportId = `live-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const now = new Date();
    const day = now.toLocaleDateString('en-IN', { weekday: 'short' });
    const date = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    const formattedNow = `${day}, ${date} • ${time}`;

    const newReport = this.normalizeReport({
      ...payload,
      id: newReportId,
      clientSubmissionId: payload.clientSubmissionId || newReportId,
      createdAt: now.getTime(),
      timestamp: formattedNow,
    });

    // Save to map initially
    this.currentReportsMap.set(newReport.id, newReport);

    // Save to IndexedDB (zero quota limit, holds full high-res images locally for prompt viewing)
    await saveReportToIndexedDB(this.toLiveReports([newReport])[0]);

    // Cloud Firestore write (Single Source of Truth)
    if (db) {
      try {
        const docRef = doc(collection(db, 'citizen_reports'));
        const compressedPhoto = newReport.photoBase64 ? await compressPhotoForCloudSync(newReport.photoBase64) : undefined;
        await setDoc(docRef, {
          ...newReport,
          photoBase64: compressedPhoto,
          imageStoragePath: newReport.imageStoragePath,
          createdAt: serverTimestamp(),
        });
        console.log('✅ Successfully published verified citizen complaint to Firestore! Document ID:', docRef.id);

        const finalReport = this.normalizeReport({
          ...newReport,
          id: docRef.id,
        });
        this.currentReportsMap.delete(newReport.id);
        this.currentReportsMap.set(finalReport.id, finalReport);
        await saveReportToIndexedDB(this.toLiveReports([finalReport])[0]);
        this.notifyAll();
        return finalReport;
      } catch (err: any) {
        console.error('🔥 Firestore Write Failed:', err);
      }
    }

    // Save to localStorage safely as offline fallback
    try {
      const rawLocal = localStorage.getItem(STORAGE_KEY_REPORTS);
      const existing = rawLocal ? JSON.parse(rawLocal) : [];
      const safeForLocal = {
        ...newReport,
        photoBase64: newReport.photoBase64 && newReport.photoBase64.length > 100000 ? undefined : newReport.photoBase64,
        imageStoragePath: newReport.imageStoragePath,
        intakeType: newReport.intakeType,
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
    onUpdate: (reports: CitizenReport[], hotspots: Hotspot[], stats: DashboardStats, rankedList: CitizenReport[]) => void
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
      const latKey = Number(r.latitude).toFixed(4);
      const lngKey = Number(r.longitude).toFixed(4);
      
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
        const norm = this.normalizeReport({
          ...r,
          assignedHotspotId: hs.id,
          hotspotId: hs.id,
          location: r.location || hs.location?.center || { lat: 20.5937, lng: 78.9629, blockOrTown: hs.location?.blockOrTown || 'Verified Locality' },
          latitude: r.latitude || r.location?.lat || hs.location?.center?.lat || 20.5937,
          longitude: r.longitude || r.location?.lng || hs.location?.center?.lng || 78.9629,
        });
        addSafe(norm);
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = getReportTimestampMs(a);
      const timeB = getReportTimestampMs(b);
      if (timeB !== timeA) return timeB - timeA;
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

    // 2. Setup single global Cloud Firestore subscription
    const db = getSafeFirestoreInstance();
    if (db && !this.unsubRealtime) {
      try {
        const q = query(collection(db, 'citizen_reports'), orderBy('createdAt', 'desc'), limit(150));
        this.unsubRealtime = onSnapshot(
          q,
          async (snapshot) => {
            const cloudSubmissionIds = new Set<string>();
            const incomingCloudReports: CitizenReport[] = [];

            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const normalized = this.normalizeReport({ ...data, id: docSnap.id });
              incomingCloudReports.push(normalized);
              if (normalized.clientSubmissionId) {
                cloudSubmissionIds.add(normalized.clientSubmissionId);
              }
            });

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
          },
          (err) => {
            console.error('🔥 Firestore onSnapshot subscription error:', err.message);
          }
        );
      } catch (e) {
        console.error('🔥 Error connecting to Cloud Firestore:', e);
      }
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
          const norm = this.normalizeReport(evt.data.report);
          this.currentReportsMap.set(norm.id, norm);
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
      const norm = this.normalizeReport(item);
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
          const norm = this.normalizeReport(item);
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
