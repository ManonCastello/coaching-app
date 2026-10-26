import {latestValidatedEntry} from './validatedBalance';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({collection:jest.fn(),getDocsFromServer:jest.fn(),query:jest.fn(),where:jest.fn()}));
test('recent drafts do not hide a validated carry from years earlier',()=>{
 const old={date:'2020-01-01',locked:true,dailyBalance:-250};
 const drafts=Array.from({length:120},(_,i)=>({date:`2026-${i}`,locked:false,dailyBalance:null}));
 expect(latestValidatedEntry([...drafts,old],{throughDay:'2026-10-26'})).toBe(old);
});
test('today is included in the displayed balance but excluded from the carry into today',()=>{
 const yesterday={date:'2026-10-25',locked:true,dailyBalance:100};
 const today={date:'2026-10-26',locked:true,dailyBalance:250};
 expect(latestValidatedEntry([yesterday,today],{throughDay:today.date})).toBe(today);
 expect(latestValidatedEntry([yesterday,today],{beforeDay:today.date})).toBe(yesterday);
});
test('a pending server total must never silently fall back to an older balance',()=>{
 const pending={date:'2026-10-26',locked:true,dailyBalance:null,balanceCalculation:{state:'pending'}};
 expect(latestValidatedEntry([{date:'2026-10-25',locked:true,dailyBalance:100},pending])).toBe(pending);
});
