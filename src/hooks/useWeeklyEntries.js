import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocsFromServer, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { readWeeklyEntries } from '../utils/weeklyEntries';

const initialState = { entries: [], loading: true, refreshing: false, error: '', source: 'loading', syncedAt: null };

function errorMessage(error) {
  if (error?.code === 'permission-denied') return 'Les bilans ne peuvent pas être lus avec ce compte. Vérifie les droits d’accès.';
  return 'La synchronisation des bilans a échoué. Vérifie ta connexion puis réessaie.';
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Synchronisation trop longue')), 15000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// A server read complements the live listener and gives the refresh button an
// explicit acknowledgement. No weekStart query, no server limit, no date as ID.
export default function useWeeklyEntries(clientId) {
  const [state, setState] = useState({ ...initialState, clientId });
  const sessionRef = useRef(null);

  const refresh = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.active || session.clientId !== clientId) return;
    const request = ++session.request;
    const revision = session.revision;
    setState(previous => ({ ...previous, refreshing: true, error: '' }));
    try {
      const snapshot = await withTimeout(getDocsFromServer(session.collection));
      if (!session.active || request !== session.request) return;
      const entries = readWeeklyEntries(snapshot);
      session.serverSeen = true;
      setState(previous => ({
        ...previous,
        entries: session.revision === revision ? entries : previous.entries,
        loading: false, refreshing: false, error: '', source: 'server', syncedAt: new Date(),
      }));
    } catch (error) {
      if (!session.active || request !== session.request) return;
      setState(previous => ({ ...previous, loading: false, refreshing: false,
        error: session.revision > revision ? '' : errorMessage(error) }));
    }
  }, [clientId]);

  useEffect(() => {
    const session = {
      clientId, collection: collection(db, 'clients', clientId, 'weeklyEntries'),
      active: true, request: 0, revision: 0, serverSeen: false,
    };
    sessionRef.current = session;
    setState({ ...initialState, clientId });
    const unsubscribe = onSnapshot(session.collection, { includeMetadataChanges: true }, snapshot => {
      if (!session.active) return;
      const fromCache = snapshot.metadata?.fromCache;
      // A stale cached response must not replace an acknowledged server result.
      if (fromCache && session.serverSeen && !snapshot.metadata?.hasPendingWrites) return;
      if (!fromCache) { session.serverSeen = true; session.revision += 1; }
      setState(previous => ({
        ...previous, entries: readWeeklyEntries(snapshot), loading: false,
        source: fromCache ? 'cache' : 'server',
        error: fromCache ? previous.error : '',
        syncedAt: fromCache ? previous.syncedAt : new Date(),
      }));
    }, error => {
      if (session.active) setState(previous => ({ ...previous, loading: false, error: errorMessage(error) }));
    });
    refresh();
    return () => { session.active = false; unsubscribe(); };
  }, [clientId, refresh]);

  const setEntries = useCallback(update => {
    setState(previous => ({ ...previous, entries: typeof update === 'function' ? update(previous.entries) : update }));
  }, []);

  return { ...(state.clientId === clientId ? state : initialState), refresh, setEntries };
}
