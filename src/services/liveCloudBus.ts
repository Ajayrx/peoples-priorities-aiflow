// Real-time Cloud Synchronization Bus (Dual Mode: Firebase Firestore + BroadcastChannel fallback)
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { getCloudConfig, hasValidFirebaseConfig } from './cloudConfig';
import type { CategoryType, PriorityLevel } from '../types';

export interface LiveCitizenReport {
  id: string;
  name: string;
  category: CategoryType;
  priorityLevel: PriorityLevel;
  priorityScore: number;
  detectedIssue: string;
  urgencyReasoning: string;
  photoBase64?: string;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
    blockOrTown: string;
  };
  isRealCloudItem: boolean;
}

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

// Helper: initialize or get Firestore instance safely
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

// Publish a new real-time report from locality photo capture
export async function publishLocalityReport(report: Omit<LiveCitizenReport, 'id' | 'timestamp' | 'isRealCloudItem'>): Promise<LiveCitizenReport> {
  const newReport: LiveCitizenReport = {
    ...report,
    id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: 'Just now',
    isRealCloudItem: hasValidFirebaseConfig(),
  };

  const db = getSafeFirestoreInstance();
  if (db) {
    try {
      const reportsRef = collection(db, 'citizen_reports');
      await addDoc(reportsRef, {
        ...newReport,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to write report to Firebase Firestore:', err);
    }
  }

  // Always sync locally across active browser viewports & persist to session storage
  try {
    const existing = getLocalLiveReports();
    const updated = [newReport, ...existing].slice(0, 50); // Keep latest 50
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'NEW_REPORT', report: newReport });
    }
    window.dispatchEvent(new CustomEvent('liveReportPublished', { detail: newReport }));
  } catch (e) {
    console.warn('Failed to publish report locally:', e);
  }

  return newReport;
}

// Get all real-time locality reports stored in session/cloud
export function getLocalLiveReports(): LiveCitizenReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// Subscribe to real-time reports stream (Firestore + BroadcastChannel + window events)
export function subscribeToLiveReports(onUpdate: (reports: LiveCitizenReport[]) => void): () => void {
  let unsubFirestore: (() => void) | null = null;
  const db = getSafeFirestoreInstance();

  if (db) {
    try {
      const q = query(collection(db, 'citizen_reports'), orderBy('createdAt', 'desc'), limit(50));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const cloudReports: LiveCitizenReport[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          cloudReports.push({
            id: doc.id,
            name: data.name || 'Verified Locality Demand',
            category: data.category || 'Road',
            priorityLevel: data.priorityLevel || 'HIGH',
            priorityScore: data.priorityScore || 94,
            detectedIssue: data.detectedIssue || 'Verified Infrastructure Defect',
            urgencyReasoning: data.urgencyReasoning || 'Immediate resolution required.',
            photoBase64: data.photoBase64,
            timestamp: data.timestamp || 'Just now',
            location: data.location || { lat: 18.7083, lng: 82.8465, blockOrTown: 'Semiliguda' },
            isRealCloudItem: true,
          });
        });
        // Merge cloud with local
        const local = getLocalLiveReports();
        const combined = [...cloudReports, ...local.filter(l => !cloudReports.some(c => c.id === l.id))];
        onUpdate(combined);
      }, (err) => {
        console.warn('Firestore snapshot error:', err);
      });
    } catch (e) {
      console.warn('Error setting up Firestore subscription:', e);
    }
  }

  // Local event listeners
  const handleLocalEvent = () => {
    onUpdate(getLocalLiveReports());
  };

  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'NEW_REPORT') {
      onUpdate(getLocalLiveReports());
    }
  };

  window.addEventListener('liveReportPublished', handleLocalEvent);
  window.addEventListener('storage', handleLocalEvent);
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  // Initial trigger
  onUpdate(getLocalLiveReports());

  return () => {
    if (unsubFirestore) unsubFirestore();
    window.removeEventListener('liveReportPublished', handleLocalEvent);
    window.removeEventListener('storage', handleLocalEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
}
