// src/firebase.js
// ⚠️ Remplace ces valeurs par celles de TON projet Firebase
// (Firebase Console > Project Settings > Your apps > Config)

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAzLaxxHfm9QFF57lOPjbAejrScrOo9yH4",
  authDomain: "manon-castello-coaching-68195.firebaseapp.com",
  projectId: "manon-castello-coaching-68195",
  storageBucket: "manon-castello-coaching-68195.firebasestorage.app",
  messagingSenderId: "515195558083",
  appId: "1:515195558083:web:d21fbf7cc79650a9ebea76"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;