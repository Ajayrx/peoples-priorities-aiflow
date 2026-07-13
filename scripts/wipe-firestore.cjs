const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'mock',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'mock',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'mock',
};

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

async function wipe() {
  const snapshot = await getDocs(collection(db, 'citizen_reports'));
  console.log(`Deleting ${snapshot.docs.length} documents from citizen_reports...`);
  
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, 'citizen_reports', document.id));
    console.log(`Deleted ${document.id}`);
  }
  console.log('Database wiped completely.');
  process.exit(0);
}

wipe().catch(console.error);
