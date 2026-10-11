import { normalizeWeeklyEntry, readWeeklyEntries, summarizeWeeklyDays, wasSubmittedToday } from './weeklyEntries';

const document = (id, data) => ({ id, data: () => data });

test('keeps a submitted bilan visible without a period start', () => {
  const entry = normalizeWeeklyEntry(document('2026-10-11', { avgWeight: 77.6 }));
  expect(entry.id).toBe('2026-10-11');
  expect(entry.bilanDate).toBe('2026-10-11');
  expect(entry.weekStart).toBeNull();
  expect(entry.avgWeight).toBe(77.6);
});

test('retains the actual document ID even when weekKey points elsewhere', () => {
  const entry = normalizeWeeklyEntry(document('2026-10-11', {
    weekKey: '2026-10-04', weekStart: '2026-10-05', weekEnd: '2026-10-11',
    coachComment: 'Commentaire existant', coachStatus: 'done',
  }));
  expect(entry.id).toBe('2026-10-11');
  expect(entry.weekKey).toBe('2026-10-04');
  expect(entry.coachComment).toBe('Commentaire existant');
  expect(entry.coachStatus).toBe('done');
});

test('shows two bilans covering the same period as separate documents', () => {
  const entries = readWeeklyEntries({ docs: [
    document('2026-10-11', { weekStart: '2026-10-04' }),
    document('2026-10-10', { weekStart: '2026-10-04' }),
    document('2026-10-05', { weekStart: '2026-09-29' }),
  ] }, 2);
  expect(entries.map(entry => entry.id)).toEqual(['2026-10-10', '2026-10-11']);
});

test('rejects impossible dates and safely supports legacy documents', () => {
  const legacy = normalizeWeeklyEntry(document('2026-06-22', { weekStart: '2026-06-22' }));
  expect(legacy.weekEnd).toBe('2026-06-28');
  const invalid = normalizeWeeklyEntry(document('unknown', { weekStart: '2026-02-30', bilanDate: 'bad' }));
  expect(invalid.weekStart).toBeNull();
  expect(invalid.bilanDate).toBeNull();
  expect(invalid.weekEnd).toBeNull();
});

test('does not discard a recent document from a full history with missing weekStart', () => {
  const docs = Array.from({ length: 24 }, (_, index) => document(`2026-09-${String(index + 1).padStart(2, '0')}`, { weekStart: '2026-09-01' }));
  docs.push(document('2026-10-11', { bilanDate: '2026-10-11' }));
  expect(readWeeklyEntries({ docs })).toHaveLength(25);
  expect(readWeeklyEntries({ docs }).at(-1).id).toBe('2026-10-11');
});

test('Thomas food averages exclude the empty Saturday instead of reporting 1554 kcal', () => {
  const stats = summarizeWeeklyDays([
    { calories: 2144, protein: 161 }, { calories: 1438, protein: 121 },
    { calories: 1425, protein: 165 }, { calories: 2761, protein: 111 },
    { calories: 0, protein: 0 },
  ]);
  expect(stats.avgCalories).toBe(1942);
  expect(stats.avgProtein).toBe(140);
  expect(stats.count).toBe(4);
  expect(stats.incompleteCount).toBe(1);
  expect(stats.days.at(-1).calories).toBeNull();
});

test('an empty food log has unknown averages, not zero intake', () => {
  const stats = summarizeWeeklyDays([{ calories: 0, protein: 120 }]);
  expect(stats.avgCalories).toBeNull();
  expect(stats.avgProtein).toBeNull();
  expect(stats.count).toBe(0);
});

test('submission is identified by its date, independently of the Monday ID convention', () => {
  const entries = readWeeklyEntries({ docs: [document('2026-10-11', { weekStart: '2026-10-05' })] });
  expect(wasSubmittedToday(entries, '2026-10-11')).toBe(true);
  expect(wasSubmittedToday(entries, '2026-10-12')).toBe(false);
});
