import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as legacyAct} from 'react-dom/test-utils';
import {httpsCallable} from 'firebase/functions';
import DailyValidation from './DailyValidation';
jest.mock('../firebase',()=>({db:{app:{}}}));
jest.mock('firebase/functions',()=>({getFunctions:jest.fn(()=>({})),httpsCallable:jest.fn()}));
const act=React.act||legacyAct;
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');root=createRoot(container);jest.clearAllMocks();Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'validation-operation-00001'}});});
afterEach(()=>act(()=>root.unmount()));
const data={confirmationToken:'f'.repeat(64),breakdown:{tracking:true,carry:350,base:2000,stepsAdjustment:20,sessionAdjustment:0,extraActivity:0,target:2020,intake:2100,delta:80,total:430}};
test('shows server detail and uncertain validation retries exactly the same operation',async()=>{
  const call=jest.fn().mockResolvedValueOnce({data}).mockRejectedValueOnce({code:'functions/unavailable',message:'Réponse interrompue'}).mockResolvedValueOnce({data});
  httpsCallable.mockReturnValue(call);const saved=jest.fn();
  await act(async()=>root.render(<DailyValidation clientId="pupil" day="2026-10-26" onClose={()=>{}} onSaved={saved}/>));
  expect(container.textContent).toContain('Report précédent');expect(container.textContent).toContain('430 kcal');
  await act(async()=>container.querySelector('.btn-primary').click());
  expect(saved).not.toHaveBeenCalled();
  await act(async()=>container.querySelector('.btn-primary').click());
  expect(call.mock.calls[1][0]).toEqual(call.mock.calls[2][0]);expect(saved).toHaveBeenCalledTimes(1);
});
test('a stale confirmation cannot be resubmitted without another preview',async()=>{
  const call=jest.fn().mockResolvedValueOnce({data}).mockRejectedValueOnce({code:'functions/aborted',message:'Le journal a changé'});
  httpsCallable.mockReturnValue(call);
  await act(async()=>root.render(<DailyValidation clientId="pupil" day="2026-10-26" onClose={()=>{}} onSaved={()=>{}}/>));
  await act(async()=>container.querySelector('.btn-primary').click());
  expect(container.querySelector('.btn-primary').disabled).toBe(true);
  expect(container.textContent).toContain('Le journal a changé');
});
test('intuitive mode never renders the numerical breakdown',async()=>{
  httpsCallable.mockReturnValue(jest.fn().mockResolvedValue({data:{...data,breakdown:{...data.breakdown,tracking:false}}}));
  await act(async()=>root.render(<DailyValidation clientId="pupil" day="2026-10-26" onClose={()=>{}} onSaved={()=>{}}/>));
  expect(container.textContent).not.toContain('430');expect(container.textContent).not.toContain('kcal');
});
