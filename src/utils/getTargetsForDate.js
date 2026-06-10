// src/utils/getTargetsForDate.js
// Returns the targets that were active on a given date
// by looking at the targetsHistory collection

import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

// Cache to avoid re-fetching for same client
const cache = {};

export async function getTargetsForDate(clientId, date, currentTargets) {
  // Load history if not cached
  if (!cache[clientId]) {
    try {
      const q = query(
        collection(db, 'clients', clientId, 'targetsHistory'),
        orderBy('validFrom', 'asc')
      );
      const snap = await getDocs(q);
      cache[clientId] = snap.docs.map(d => d.data());
    } catch {
      cache[clientId] = [];
    }
  }

  const history = cache[clientId];

  // No history = use current targets
  if (!history || history.length === 0) return currentTargets;

  // Find the most recent targets that were valid on or before the given date
  let applicable = null;
  for (const entry of history) {
    if (entry.validFrom <= date) {
      applicable = entry;
    } else {
      break;
    }
  }

  return applicable || currentTargets;
}

export function clearTargetsCache(clientId) {
  delete cache[clientId];
}
