// src/firebase.js
// ⚠️ Remplace ces valeurs par celles de TON projet Firebase
// (Firebase Console > Project Settings > Your apps > Config)

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "REMPLACE_PAR_TA_CLE",
  authDomain: "TON_PROJET.firebaseapp.com",
  projectId: "TON_PROJET_ID",
  storageBucket: "TON_PROJET.appspot.com",
  messagingSenderId: "TON_SENDER_ID",
  appId: "TON_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
