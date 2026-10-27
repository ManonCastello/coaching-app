import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { doc as firestoreDoc, collection, query, where, serverTimestamp, getDoc, getDocsFromServer, setDoc } from 'firebase/firestore';
import WeeklyCheckIn from './WeeklyCheckIn';

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'client-test' } }) }));
jest.mock('../components/TabBar', () => () => null);
jest.mock('../components/PhotoViewer', () => () => null);
jest.mock('firebase/storage',()=>({getStorage:jest.fn(),ref:jest.fn(),uploadBytes:jest.fn(),getBlob:jest.fn(),connectStorageEmulator:jest.fn()}));
jest.mock('recharts', () => ({
  BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null,
  ResponsiveContainer: () => null, Tooltip: () => null, ReferenceLine: () => null, Cell: () => null,
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => path.join('/')),
  collection: jest.fn((db, ...path) => path.join('/')),
  query: jest.fn((collection, ...constraints) => ({ collection, constraints })),
  where: jest.fn((field, operation, value) => ({ field, operation, value })),
  getDoc: jest.fn(), getDocsFromServer: jest.fn(), setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
}));

let root, container;
const act = React.act || legacyAct;
const doc = (id, data) => ({ id, data: () => data });
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date('2026-10-11T12:00:00Z'));
  jest.clearAllMocks();
  firestoreDoc.mockImplementation((db, ...path) => path.join('/'));
  collection.mockImplementation((db, ...path) => path.join('/'));
  query.mockImplementation((collection, ...constraints) => ({ collection, constraints }));
  where.mockImplementation((field, operation, value) => ({ field, operation, value }));
  serverTimestamp.mockReturnValue('server-time');
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ firstName: 'Client', targets: { calories: 1500, protein: 120 } }) });
  setDoc.mockResolvedValue();
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); jest.useRealTimers(); });
async function render() {
  await act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WeeklyCheckIn /></MemoryRouter>));
}

test('sending an edited bilan preserves coach feedback and saves the actual submission ID', async () => {
  const bilans = { docs: [doc('2026-10-11', { bilanDate: '2026-10-11', coachStatus: 'done', coachComment: 'Retour précédent', measurements: { waist: 80 } })] };
  getDocsFromServer.mockImplementation(reference => Promise.resolve(typeof reference === 'string' ? bilans : {
    docs: [doc('2026-10-10', { date: '2026-10-10', calories: 1500, protein: 120 }), doc('2026-10-09', { date: '2026-10-09', calories: 0 })],
  }));
  await render();
  expect(container.textContent).toContain('4 oct');
  expect(container.textContent).toMatch(/10 oct\.? 2026/);
  const button = [...container.querySelectorAll('button')].find(element => element.textContent.includes('Envoyer le bilan'));
  expect(button).toBeDefined();
  await act(async () => button.click());
  const [path, payload, options] = setDoc.mock.calls[0];
  expect(path).toBe('clients/client-test/weeklyEntries/2026-10-11');
  expect(payload).toMatchObject({ bilanDate: '2026-10-11', weekStart: '2026-10-04', weekEnd: '2026-10-10' });
  expect(payload).not.toHaveProperty('coachStatus');
  expect(payload.weekStats.avgCalories).toBe(1500);
  expect(payload.weekStats.count).toBe(1);
  expect(payload.weekStats.incompleteCount).toBe(1);
  expect(payload).not.toHaveProperty('coachComment');
  expect(options).toEqual({ merge: true });
  expect(container.textContent).toContain('Bilan enregistré');
});

test('opening a historical bilan queries its actual date range rather than the last ten entries', async () => {
  const bilans = { docs: [doc('2026-09-06', { bilanDate: '2026-09-06', weekStart: '2026-08-30', weekEnd: '2026-09-05', avgWeight: 61 })] };
  getDocsFromServer.mockImplementation(reference => Promise.resolve(typeof reference === 'string' ? bilans : { docs: [] }));
  await render();
  const previous = [...container.querySelectorAll('button')].find(element => element.textContent === '←');
  await act(async () => previous.click());
  const queries = getDocsFromServer.mock.calls.map(([reference]) => reference).filter(reference => typeof reference !== 'string');
  expect(queries.at(-1).constraints).toEqual([
    { field: 'date', operation: '>=', value: '2026-08-30' },
    { field: 'date', operation: '<=', value: '2026-09-05' },
  ]);
  expect(container.textContent).toMatch(/6 sept\.? 2026/);
});
