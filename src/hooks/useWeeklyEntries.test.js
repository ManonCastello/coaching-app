import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { collection, getDocsFromServer, onSnapshot } from 'firebase/firestore';
import useWeeklyEntries from './useWeeklyEntries';

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...path) => path.join('/')),
  getDocsFromServer: jest.fn(), onSnapshot: jest.fn(),
}));

const snapshot = (id, fromCache = false) => ({
  docs: id ? [{ id, data: () => ({ avgWeight: 60.7 }) }] : [],
  metadata: { fromCache, hasPendingWrites: false },
});
let root, container, result;
const act = React.act || legacyAct;
function View({ id }) { result = useWeeklyEntries(id); return <div>{result.entries.map(entry => entry.id).join(',')}</div>; }

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  collection.mockImplementation((db, ...path) => path.join('/'));
  onSnapshot.mockReturnValue(jest.fn());
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); jest.useRealTimers(); });

test('replaces a cached old bilan with the server bilan and keeps the latest one without weekStart', async () => {
  getDocsFromServer.mockResolvedValue(snapshot('2026-10-11'));
  onSnapshot.mockImplementation((collection, options, next) => { next(snapshot('2026-10-04', true)); return jest.fn(); });
  await act(async () => root.render(<View id="alexandra" />));
  expect(container.textContent).toBe('2026-10-11');
  expect(result.source).toBe('server');
  expect(result.refreshing).toBe(false);
  expect(getDocsFromServer).toHaveBeenCalledWith('clients/alexandra/weeklyEntries');
  expect(onSnapshot.mock.calls[0][1]).toEqual({ includeMetadataChanges: true });
});

test('manual refresh replaces the history with fresh server results', async () => {
  getDocsFromServer.mockResolvedValueOnce(snapshot('2026-10-04')).mockResolvedValueOnce(snapshot('2026-10-11'));
  await act(async () => root.render(<View id="laura" />));
  expect(container.textContent).toBe('2026-10-04');
  await act(async () => result.refresh());
  expect(container.textContent).toBe('2026-10-11');
});

test('permission failure is visible instead of pretending there are no bilans', async () => {
  getDocsFromServer.mockRejectedValue({ code: 'permission-denied' });
  await act(async () => root.render(<View id="thomas" />));
  expect(result.error).toMatch(/droits d’accès/);
  expect(result.source).not.toBe('server');
  expect(result.loading).toBe(false);
});

test('a delayed response from a different client cannot overwrite the current client', async () => {
  let resolveOld;
  getDocsFromServer.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(snapshot('2026-10-11'));
  await act(async () => root.render(<View id="laura" />));
  await act(async () => root.render(<View id="thomas" />));
  await act(async () => resolveOld(snapshot('2026-09-01')));
  expect(container.textContent).toBe('2026-10-11');
});

test('a late cached snapshot cannot undo a successful server refresh', async () => {
  let next;
  onSnapshot.mockImplementation((collection, options, callback) => { next = callback; return jest.fn(); });
  getDocsFromServer.mockResolvedValue(snapshot('2026-10-11'));
  await act(async () => root.render(<View id="laura" />));
  act(() => next(snapshot('2026-10-04', true)));
  expect(container.textContent).toBe('2026-10-11');
});

test('a stalled server request ends with an actionable error', async () => {
  jest.useFakeTimers('modern');
  getDocsFromServer.mockImplementation(() => new Promise(() => {}));
  await act(async () => root.render(<View id="laura" />));
  await act(async () => jest.advanceTimersByTime(15000));
  expect(result.refreshing).toBe(false);
  expect(result.loading).toBe(false);
  expect(result.error).toMatch(/connexion/);
});

test('a live update received during refresh is not replaced by an older server response', async () => {
  let next, resolveServer;
  onSnapshot.mockImplementation((collection, options, callback) => { next = callback; return jest.fn(); });
  getDocsFromServer.mockImplementation(() => new Promise(resolve => { resolveServer = resolve; }));
  await act(async () => root.render(<View id="laura" />));
  act(() => next(snapshot('2026-10-11')));
  await act(async () => resolveServer(snapshot('2026-10-04')));
  expect(container.textContent).toBe('2026-10-11');
});
