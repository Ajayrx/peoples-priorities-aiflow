const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Minimal config for seed
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'mock',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'mock',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'mock',
};

// read .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [k, ...vArr] = line.split('=');
    const v = vArr.join('=');
    if (k && v) {
      if (k === 'VITE_FIREBASE_API_KEY') firebaseConfig.apiKey = v.replace(/"/g, '').replace(/'/g, '').trim();
      if (k === 'VITE_FIREBASE_AUTH_DOMAIN') firebaseConfig.authDomain = v.replace(/"/g, '').replace(/'/g, '').trim();
      if (k === 'VITE_FIREBASE_PROJECT_ID') firebaseConfig.projectId = v.replace(/"/g, '').replace(/'/g, '').trim();
    }
  });
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  const reports = [
    {
      clientSubmissionId: 'seed-photo-1',
      category: 'Road',
      aiCategory: 'Road',
      title: 'Pothole on Main St',
      description: 'Massive pothole causing traffic slowdowns',
      rawText: 'Massive pothole causing traffic slowdowns',
      transcription: '',
      aiSummary: 'Massive pothole causing traffic slowdowns',
      detectedIssue: 'Pothole on Main St',
      aiConfidence: 98,
      priorityScore: 98,
      priorityLevel: 'HIGH',
      urgencyReasoning: 'Traffic hazard',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      duplicateStatus: 'UNIQUE',
      inputMethod: 'PHOTO',
      location: { lat: 28.6139, lng: 77.2090, district: 'New Delhi', state: 'Delhi', constituency: 'NDMC', blockOrTown: 'Connaught Place' },
      images: [],
      photoBase64: 'data:image/jpeg;base64,mock',
      imageStoragePath: '',
      voiceUrl: '',
      aiProcessing: {}
    },
    {
      clientSubmissionId: 'seed-voice-1',
      category: 'Water',
      aiCategory: 'Water',
      title: 'No water supply for 2 days',
      description: '',
      rawText: 'We have not received water in block C for two days straight.',
      transcription: 'We have not received water in block C for two days straight.',
      aiSummary: 'No water supply for 2 days',
      detectedIssue: 'Water outage',
      aiConfidence: 99,
      priorityScore: 99,
      priorityLevel: 'CRITICAL',
      urgencyReasoning: 'Basic necessity missing',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      duplicateStatus: 'UNIQUE',
      inputMethod: 'VOICE',
      location: { lat: 28.6150, lng: 77.2100, district: 'New Delhi', state: 'Delhi', constituency: 'NDMC', blockOrTown: 'Block C' },
      images: [],
      photoBase64: '',
      imageStoragePath: '',
      voiceUrl: 'mock.mp3',
      aiProcessing: {}
    },
    {
      clientSubmissionId: 'seed-text-1',
      category: 'Electricity',
      aiCategory: 'Electricity',
      title: 'Street light broken',
      description: 'Street light pole 42 is completely dark at night.',
      rawText: 'Street light pole 42 is completely dark at night.',
      transcription: '',
      aiSummary: 'Street light broken',
      detectedIssue: 'Street light broken',
      aiConfidence: 85,
      priorityScore: 85,
      priorityLevel: 'MEDIUM',
      urgencyReasoning: 'Safety hazard',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      duplicateStatus: 'UNIQUE',
      inputMethod: 'TEXT',
      location: { lat: 28.6160, lng: 77.2110, district: 'New Delhi', state: 'Delhi', constituency: 'NDMC', blockOrTown: 'Pole 42 Area' },
      images: [],
      photoBase64: '',
      imageStoragePath: '',
      voiceUrl: '',
      aiProcessing: {}
    }
  ];

  console.log("Seeding 3 canonical reports...");
  
  for (const r of reports) {
    const finalPayload = {
      ...r,
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
