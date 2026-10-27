import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as legacyAct} from 'react-dom/test-utils';
import {getDocsFromServer, collection} from 'firebase/firestore';
import CoachAuditHistory from './CoachAuditHistory';

jest.mock('../firebase', () => ({db:{}}));
jest.mock('firebase/firestore', () => ({
  collection:jest.fn((...path) => path.slice(1).join('/')),
  query:jest.fn(path => path), orderBy:jest.fn(), limit:jest.fn(), getDocsFromServer:jest.fn(),
}));
const act = React.act || legacyAct;
const event = {action:'setBalance', reason:'Correction à -250 kcal', actorId:'private-coach-id',
  createdAt:{toDate:() => new Date('2026-10-26T12:00:00Z')}, before:{dailyBalance:100}, after:{dailyBalance:-250}};
const snapshot = data => ({empty:!data.length, docs:data.map((item, index) => ({id:String(index), data:() => item}))});
let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  container = document.createElement('div'); root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

test('student reads only their history, sees before/after, and has no mutation control', async () => {
  getDocsFromServer.mockResolvedValue(snapshot([event]));
  await act(async () => root.render(<CoachAuditHistory clientId="student" audience="student" />));
  expect(collection).toHaveBeenCalledWith({}, 'clients', 'student', 'auditEvents');
  expect(container.textContent).toContain('Solde corrigé');
  expect(container.textContent).toContain('Correction à -250 kcal');
  expect(container.textContent).toContain('Avant'); expect(container.textContent).toContain('Après');
  expect(container.textContent).not.toContain('private-coach-id');
  expect(container.querySelectorAll('input,textarea,button')).toHaveLength(0);
});

test('intuitive student history does not reveal numerical values or a numerical reason', async () => {
  getDocsFromServer.mockResolvedValue(snapshot([event]));
  await act(async () => root.render(<CoachAuditHistory clientId="student" audience="student" hideValues />));
  expect(container.textContent).toContain('Solde corrigé');
  expect(container.textContent).not.toContain('-250');
  expect(container.textContent).not.toContain('100');
  expect(container.querySelector('dl')).toBeNull();
});

test('late response from previous profile cannot replace current pupil history', async () => {
  let resolveOld;
  getDocsFromServer.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(snapshot([]));
  await act(async () => root.render(<CoachAuditHistory clientId="old-pupil" />));
  await act(async () => root.render(<CoachAuditHistory clientId="new-pupil" />));
  await act(async () => resolveOld(snapshot([event])));
  expect(container.textContent).toContain('Aucune correction tracée');
  expect(container.textContent).not.toContain('Correction à -250');
});

test('a failed read is shown as an error and can be retried without claiming empty history', async () => {
  getDocsFromServer.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(snapshot([]));
  await act(async () => root.render(<CoachAuditHistory clientId="student" />));
  expect(container.textContent).toContain('Impossible de charger');
  expect(container.textContent).not.toContain('Aucune correction');
  await act(async () => container.querySelector('button').click());
  expect(getDocsFromServer).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Aucune correction tracée');
});
