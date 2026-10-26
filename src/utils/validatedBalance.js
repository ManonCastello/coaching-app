import {collection,getDocsFromServer,query,where} from 'firebase/firestore';
import {db} from '../firebase';

export function latestValidatedEntry(entries,{beforeDay,throughDay}={}){
 return [...entries].filter(entry=>entry.locked===true&&typeof entry.date==='string'
  &&(!beforeDay||entry.date<beforeDay)&&(!throughDay||entry.date<=throughDay)
  &&(entry.balanceCalculation?.state==='pending'||typeof entry.dailyBalance==='number'&&Number.isFinite(entry.dailyBalance)))
  .sort((a,b)=>b.date.localeCompare(a.date))[0]??null;
}
export async function readValidatedEntry(clientId,range){
 // One indexed filter, no date window and no composite index required.
 const snapshot=await getDocsFromServer(query(collection(db,'clients',clientId,'dailyEntries'),where('locked','==',true)));
 return latestValidatedEntry(snapshot.docs.map(doc=>({id:doc.id,...doc.data()})),range);
}
