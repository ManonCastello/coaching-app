import React,{useRef,useState} from 'react';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {db} from '../firebase';
const call=request=>httpsCallable(getFunctions(db.app,'europe-west1'),'coachMutation')(request);
function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),value=>value.toString(16).padStart(2,'0')).join('');}
export default function CoachInvitations(){
 const [email,setEmail]=useState(''),[link,setLink]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[invitations,setInvitations]=useState(null);
 const attempt=useRef(null);
 async function create(event){
  event.preventDefault();if(pending)return;setPending(true);setMessage('');setLink('');
  const normalized=email.trim().toLowerCase();
  if(attempt.current?.email!==normalized)attempt.current={email:normalized,token:newToken()};
  try{const request=attempt.current;await call({action:'createInvitation',...request});setLink(`${window.location.origin}/invitation/${request.token}`);attempt.current=null;setMessage('Lien créé pour cette adresse, valable 7 jours. Aucun e-mail n’a été envoyé.');}
  catch(error){setMessage(error.message||'Création non confirmée. Réessaie avec la même adresse.');}
  finally{setPending(false);}
 }
 async function list(){setPending(true);setMessage('');try{const result=await call({action:'listInvitations'});setInvitations(result.data.invitations);}catch(error){setMessage(error.message||'Impossible de lire les invitations.');}finally{setPending(false);}}
 async function revoke(id){setPending(true);setMessage('');try{await call({action:'revokeInvitation',invitationId:id});setInvitations(items=>items.map(item=>item.id===id?{...item,revoked:true}:item));setLink('');setMessage('Lien désactivé. Aucun suivi existant n’a été retiré.');}catch(error){setMessage(error.message||'Désactivation non confirmée.');}finally{setPending(false);}}
 return <details className="card" style={{marginBottom:20}}>
  <summary style={{cursor:'pointer',fontWeight:700}}>✉️ Inviter un élève</summary>
  <p>L’élève devra vérifier son adresse e-mail et accepter le partage de son suivi avec toi.</p>
  <form onSubmit={create}>
   <label htmlFor="invitation-email">Adresse e-mail de l’élève</label>
   <input id="invitation-email" className="input" type="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={pending}/>
   <button className="btn btn-primary" disabled={pending} style={{marginTop:12}}>{pending?'En cours…':'Créer un lien d’invitation'}</button>
  </form>
  {link&&<div style={{marginTop:12}}><label htmlFor="invitation-link">Lien à transmettre à l’élève</label><input id="invitation-link" className="input" readOnly value={link}/><p>Copie ce lien et transmets-le à l’élève concerné. Il n’est pas publié ni envoyé automatiquement.</p></div>}
  {message&&<p role="status">{message}</p>}
  <button className="btn btn-secondary" onClick={list} disabled={pending} style={{marginTop:12}}>Afficher les invitations récentes</button>
  {invitations?.length===0&&<p>Aucune invitation pour le moment.</p>}
  {invitations?.map(item=><div key={item.id} style={{padding:'12px 0',borderTop:'1px solid var(--border-light)'}}>
   <strong>{item.email}</strong><p>{item.revoked?'Lien désactivé':item.used?'Invitation acceptée':new Date(item.expiresAt)<=new Date()?'Lien expiré':`Expire le ${new Date(item.expiresAt).toLocaleDateString('fr-FR')}`}</p>
   {!item.used&&!item.revoked&&<button className="btn btn-ghost" disabled={pending} onClick={()=>revoke(item.id)}>Désactiver ce lien</button>}
  </div>)}
 </details>;
}
