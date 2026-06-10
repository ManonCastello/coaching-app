// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [coachMode, setCoachMode] = useState('coach'); // 'coach' | 'athlete'
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }
  function logout() { return signOut(auth); }

  function switchMode() {
    setCoachMode(m => m === 'coach' ? 'athlete' : 'coach');
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const coachDoc = await getDoc(doc(db, 'coaches', user.uid));
        setUserRole(coachDoc.exists() ? 'coach' : 'client');
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setCoachMode('coach');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = { currentUser, userRole, coachMode, switchMode, login, logout, loading };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
