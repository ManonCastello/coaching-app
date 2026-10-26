import { initializeApp } from 'firebase/app';
import { getFirestore,connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth,connectAuthEmulator } from 'firebase/auth';
import {getFunctions,connectFunctionsEmulator} from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Explicit local development only. A production build cannot select emulators,
// and local tests use a demo project rather than any production credentials.
const local=process.env.NODE_ENV==='development'&&process.env.REACT_APP_FIREBASE_EMULATORS==='true';
const app = initializeApp(local?{apiKey:'demo-fitlog-key',projectId:'demo-fitlog-security',authDomain:'localhost',appId:'demo-fitlog-app'}:firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
if(local){
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  connectFirestoreEmulator(db,'127.0.0.1',8188);
  connectFunctionsEmulator(getFunctions(app,'europe-west1'),'127.0.0.1',5001);
}
export default app;
