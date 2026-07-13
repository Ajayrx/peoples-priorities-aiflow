import type { CitizenReport } from '../types';

const DB_NAME = 'peoples_priorities_gis_ledger_v1';
const DB_VERSION = 1;
const STORE_NAME = 'citizen_intake_reports';

/**
 * Bulletproof IndexedDB Storage Engine for People's Priorities.
 * Unlike localStorage (which has a strict ~5MB limit and crashes when storing high-res photos),
 * IndexedDB provides gigabytes of persistent storage across browser restarts, reloads, and tabs.
 */
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };
  });
}

/**
 * Saves a verified citizen report into persistent IndexedDB ledger.
 */
export async function saveReportToIndexedDB(report: CitizenReport): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(report);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB save fallback warning:', err);
  }
}

/**
 * Retrieves all stored citizen reports from IndexedDB (sorted newest first).
 */
export async function getAllReportsFromIndexedDB(): Promise<CitizenReport[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result || []) as CitizenReport[];
        // Sort reverse chronological
        results.sort((a, b) => {
          const idA = a.id || '';
          const idB = b.id || '';
          return idB.localeCompare(idA);
        });
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB read warning:', err);
    return [];
  }
}

/**
 * Deletes a report or clears the ledger if needed.
 */
export async function deleteReportFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete warning:', err);
  }
}
