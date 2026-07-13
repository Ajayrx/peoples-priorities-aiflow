import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizeReportSubmission, validateCanonicalReportWrite } from '../src/utils/reportNormalizer.js';

// Minimal config for seed
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA...',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '...',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'build-with-ai-hackathon',
};

// Only run if we have a real config via env
import fs from 'fs';
import path from 'path';

// read .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) {
      if (k === 'VITE_FIREBASE_API_KEY') firebaseConfig.apiKey = v.replace(/"/g, '').trim();
      if (k === 'VITE_FIREBASE_AUTH_DOMAIN') firebaseConfig.authDomain = v.replace(/"/g, '').trim();
      if (k === 'VITE_FIREBASE_PROJECT_ID') firebaseConfig.projectId = v.replace(/"/g, '').trim();
    }
  });
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  const reports = [
    {
      inputMethod: 'PHOTO',
      category: 'Road',
      title: 'Pothole on Main St',
      description: 'Massive pothole causing traffic slowdowns',
      photoBase64: 'data:image/jpeg;base64,...',
      priorityLevel: 'HIGH',
      location: { lat: 28.6139, lng: 77.2090, district: 'New Delhi', state: 'Delhi' }
    },
    {
      inputMethod: 'VOICE',
      category: 'Water',
      title: 'No water supply for 2 days',
      transcription: 'We have not received water in block C for two days straight.',
      voiceUrl: 'https://example.com/audio.mp3',
      priorityLevel: 'CRITICAL',
      location: { lat: 28.6150, lng: 77.2100, district: 'New Delhi', state: 'Delhi' }
    },
    {
      inputMethod: 'TEXT',
      category: 'Electricity',
      title: 'Street light broken',
      description: 'Street light pole 42 is completely dark at night.',
      priorityLevel: 'MEDIUM',
      location: { lat: 28.6160, lng: 77.2110, district: 'New Delhi', state: 'Delhi' }
    }
  ];

  console.log("Seeding 3 canonical reports...");
  
  for (const r of reports) {
    const canonicalWrite = validateCanonicalReportWrite(normalizeReportSubmission(r as any));
    const finalPayload = {
      ...canonicalWrite,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docId = `rep-seed-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    await setDoc(doc(db, 'citizen_reports', docId), finalPayload);
    console.log(`Seeded ${r.inputMethod} report: ${docId}`);
  }
  
  console.log("Seed complete. Exiting...");
  process.exit(0);
}

seed().catch(e => {
  console.error("Seed failed:", e);
  process.exit(1);
});
