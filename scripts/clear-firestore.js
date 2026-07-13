import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC2Qufkje5ySeQut5ht7RKBDZTbfZvNrw0",
  authDomain: "peoples-priorities-cloud.firebaseapp.com",
  projectId: "peoples-priorities-cloud",
  storageBucket: "peoples-priorities-cloud.firebasestorage.app",
  messagingSenderId: "470632059939",
  appId: "1:470632059939:web:8a5490234d70e072bc0d96",
  measurementId: "G-17612VHQS4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearReports() {
  console.log('Fetching citizen_reports...');
  const snapshot = await getDocs(collection(db, 'citizen_reports'));
  console.log(`Found ${snapshot.docs.length} documents. Deleting...`);
  
  let deletedCount = 0;
  for (const doc of snapshot.docs) {
    await deleteDoc(doc.ref);
    deletedCount++;
  }
  console.log(`Successfully deleted ${deletedCount} documents.`);
  process.exit(0);
}

clearReports().catch(console.error);
