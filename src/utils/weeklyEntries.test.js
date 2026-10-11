import { normalizeWeeklyEntry, readWeeklyEntries } from './weeklyEntries';

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
