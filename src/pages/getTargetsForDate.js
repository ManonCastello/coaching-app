// src/utils/getTargetsForDate.js
// Returns the targets that were active on a given date
// using validFrom / validTo periods stored in targetsHistory

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

  // Find the period that covers the given date:
  // validFrom <= date AND (validTo == null OR validTo >= date)
  for (const entry of [...history].reverse()) {
    if (entry.validFrom <= date) {
      if (!entry.validTo || entry.validTo >= date) {
        return entry;
      }
    }
  }

  // Fallback: oldest entry
  return history[0] || currentTargets;
}

export function clearTargetsCache(clientId) {
  delete cache[clientId];
}
