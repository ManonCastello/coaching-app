import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as legacyAct} from 'react-dom/test-utils';
import {httpsCallable} from 'firebase/functions';
import AuditedCoachAction from './AuditedCoachAction';
jest.mock('../firebase', () => ({db:{app:{}}}));
jest.mock('firebase/functions', () => ({getFunctions:jest.fn(() => ({})), httpsCallable:jest.fn()}));
const act = React.act || legacyAct;
let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(global, 'crypto', {configurable:true, value:{randomUUID:() => 'operation-test-0001'}});
  container = document.createElement('div'); root = createRoot(container);
  jest.clearAllMocks();
});
afterEach(() => act(() => root.unmount()));
test('uncertain response retries with same operation ID and frozen reason, without false success', async () => {
  const call = jest.fn().mockRejectedValueOnce({code:'functions/unavailable', message:'Connexion interrompue'}).mockResolvedValueOnce({data:{revision:1}});
  httpsCallable.mockReturnValue(call);
  const saved = jest.fn();
  const command = {action:'unlockDaily',clientId:'student',day:'2026-10-26',expectedRevision:0};
  await act(async () => root.render(<AuditedCoachAction command={command} onClose={() => {}} onSaved={saved} />));
  const input = container.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input,'Erreur de saisie');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(saved).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Connexion interrompue');
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(call).toHaveBeenCalledTimes(2);
  expect(call.mock.calls[0][0]).toEqual(call.mock.calls[1][0]);
  expect(call.mock.calls[0][0].reason).toBe('Erreur de saisie');
  expect(saved).toHaveBeenCalledTimes(1);
});
