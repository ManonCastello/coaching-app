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
  const entries = snapshot.docs.map(normalizeWeeklyEntry)
    .sort((a, b) => (a.bilanDate || '').localeCompare(b.bilanDate || '') || a.id.localeCompare(b.id));
  return Number.isInteger(count) && count > 0 ? entries.slice(-count) : entries;
}

// Zero calories mean an incomplete food log, not a day without food.
export function summarizeWeeklyDays(days) {
  if (!Array.isArray(days) || !days.length) return null;
  const completeDays = days.filter(day => Number(day.calories) > 0);
  const avg = key => completeDays.length
    ? Math.round(completeDays.reduce((sum, day) => sum + (Number(day[key]) || 0), 0) / completeDays.length)
    : null;
  return {
    days: days.map(day => ({ ...day, calories: Number(day.calories) > 0 ? Number(day.calories) : null })),
    count: completeDays.length,
    incompleteCount: days.length - completeDays.length,
    avgCalories: avg('calories'), avgProtein: avg('protein'), avgCarbs: avg('carbs'), avgFat: avg('fat'),
  };
}

export function wasSubmittedToday(entries, today) {
  return entries.some(entry => entry.bilanDate === today);
}
