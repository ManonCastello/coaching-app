// Keep the Firestore document identity separate from dates shown to the user.
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function normalizeWeeklyEntry(document) {
  const data = document.data();
  const bilanDate = validDate(data.bilanDate) || validDate(document.id) ||
    validDate(data.weekKey) || validDate(data.weekEnd) || validDate(data.weekStart);
  // Legacy documents use the period start as their ID. Do not invent a period.
  const weekStart = validDate(data.weekStart);
  const weekEnd = validDate(data.weekEnd) || (weekStart &&
    new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 6 * 86400000).toISOString().slice(0, 10));
  return { ...data, id: document.id, bilanDate, weekStart, weekEnd };
}

export function readWeeklyEntries(snapshot, count) {
  return snapshot.docs.map(normalizeWeeklyEntry)
    .sort((a, b) => (a.bilanDate || '').localeCompare(b.bilanDate || '') || a.id.localeCompare(b.id))
    .slice(-count);
}
