// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [coachMode, setCoachMode] = useState('coach'); // 'coach' | 'athlete'
  const [loading, setLoading] = useState(true);
  const [accessError,setAccessError]=useState('');
  const [retry,setRetry]=useState(0);

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }
  function logout() { return signOut(auth); }

  function switchMode() {
    setCoachMode(m => m === 'coach' ? 'athlete' : 'coach');
  }

  useEffect(() => {
    let active=true,generation=0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const request=++generation;
      setAccessError('');
      if (user) {
        setCurrentUser(null);setUserRole(null);setCoachMode('coach');
        try{
          const coachDoc = await getDocFromServer(doc(db, 'coaches', user.uid));
          if(!active||generation!==request||auth.currentUser?.uid!==user.uid)return;
          setUserRole(coachDoc.exists() && coachDoc.data().role === 'coach' ? 'coach' : 'client');
          setCurrentUser(user);
        }catch{
          if(!active||generation!==request)return;
          setAccessError('Tes accès n’ont pas pu être vérifiés. Vérifie ta connexion et réessaie.');
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setCoachMode('coach');
      }
      setLoading(false);
    });
    return()=>{active=false;unsubscribe();};
  }, [retry]);

  const value = { currentUser, userRole, coachMode, switchMode, login, logout, loading };
  return <AuthContext.Provider value={value}>{loading?<div className="loading" role="status">Vérification des accès…</div>:accessError?<div className="app-shell"><section className="card"><p role="alert">{accessError}</p><button className="btn btn-primary" onClick={()=>setRetry(value=>value+1)}>Réessayer</button><button className="btn btn-ghost" onClick={logout}>Se déconnecter</button></section></div>:children}</AuthContext.Provider>;
}
