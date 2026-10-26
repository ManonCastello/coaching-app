import React,{useState} from 'react';
import {Link,useParams,useNavigate} from 'react-router-dom';
import {sendEmailVerification} from 'firebase/auth';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {auth,db} from '../firebase';
import {useAuth} from '../contexts/AuthContext';
const policyVersion='coach-sharing-2026-10-26-v1';
export default function InvitationPage(){
 const {token}=useParams(),{currentUser,logout}=useAuth(),navigate=useNavigate();
 const [info,setInfo]=useState(null),[agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const next=`/invitation/${token}`;
 const valid=/^[a-f0-9]{64}$/.test(token??'');
 async function call(request){return httpsCallable(getFunctions(db.app,'europe-west1'),'coachMutation')(request);}
 async function inspect(){
  setBusy(true);setInfo(null);setAgreed(false);setMessage('');
  try{
   const user=auth.currentUser;
   if(!user)throw new Error('Reconnecte-toi pour vérifier cette invitation.');
   await user.reload();await user.getIdToken(true);
   if(auth.currentUser?.uid!==user.uid)return;
   const result=await call({action:'inspectInvitation',token});
   if(auth.currentUser?.uid===user.uid)setInfo({...result.data,uid:user.uid});
  }catch(error){setMessage(error.message||'Impossible de vérifier ce lien.');}finally{setBusy(false);}
 }
 async function verifyEmail(){
  setBusy(true);setMessage('');
  try{await sendEmailVerification(auth.currentUser);setMessage('Un e-mail de vérification t’a été envoyé. Ouvre le lien reçu, puis reviens vérifier l’invitation.');}
  catch{setMessage('L’envoi n’a pas abouti. Vérifie ta connexion ou attends un moment avant de réessayer.');}finally{setBusy(false);}
 }
 async function accept(){
  if(!agreed||busy||info?.uid!==currentUser.uid)return;
  setBusy(true);setMessage('');
  try{await call({action:'claimInvitation',token,sharingAccepted:true,policyVersion});setMessage('Invitation acceptée. Ton suivi est maintenant partagé avec cette coach.');navigate('/dashboard');}
  catch(error){setMessage(error.message||'Acceptation non confirmée. Réessaie avec ce lien.');}finally{setBusy(false);}
 }
 const currentInfo=info?.uid===currentUser?.uid?info:null;
 return <main className="app-shell"><div className="page"><section className="card">
  <h1>⚜️ Invitation Fitlog</h1>
  {!valid?<p role="alert">Ce lien est invalide. Demande un nouveau lien à ta coach.</p>:!currentUser?<>
   <p>Connecte-toi ou crée ton compte avec l’adresse e-mail communiquée à ta coach. Aucun suivi n’est partagé tant que tu n’as pas accepté.</p>
   <Link className="btn btn-primary" to="/login" state={{next}}>J’ai déjà un compte</Link>
   <Link className="btn btn-secondary" to="/register" state={{next}} style={{marginTop:12}}>Créer mon compte</Link>
  </>:<>
   <p>Compte connecté : {currentUser.email}</p>
   <button className="btn btn-secondary" disabled={busy} onClick={verifyEmail}>Recevoir un e-mail pour vérifier mon adresse</button>
   <button className="btn btn-primary" disabled={busy} onClick={inspect} style={{marginTop:12}}>J’ai vérifié mon adresse · vérifier l’invitation</button>
   {currentInfo&&<div style={{marginTop:20}}>
    <h2>{currentInfo.coachName}</h2><p>{currentInfo.coachEmail}</p>
    {currentInfo.used?<p>Ce lien a déjà été accepté. <Link to="/dashboard">Ouvrir mon suivi</Link></p>:<>
     <p>Cette coach pourra consulter ton journal nutrition et activité, tes bilans, tes mesures et les photos que tu as partagées. Elle pourra gérer tes objectifs et ton accompagnement.</p>
     <p>Les informations déjà enregistrées seront également accessibles. Accepter une nouvelle coach ne retire pas automatiquement les accès de ta coach actuelle. Pour retirer un accès, contacte ta coach.</p>
     <label style={{display:'flex',gap:12,alignItems:'flex-start'}}><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)} disabled={busy}/>J’accepte de partager mon suivi avec {currentInfo.coachName} ({currentInfo.coachEmail}).</label>
     <button className="btn btn-primary" disabled={!agreed||busy} onClick={accept} style={{marginTop:12}}>Accepter le partage de mon suivi</button>
    </>}
   </div>}
   <p><Link to="/register" state={{next}}>Compléter ou créer ma fiche élève</Link></p>
   <button className="btn btn-ghost" disabled={busy} onClick={()=>{setInfo(null);setAgreed(false);logout();}}>Changer de compte</button>
  </>}
  {busy&&<p role="status">Vérification en cours…</p>}{message&&<p role="status">{message}</p>}
 </section></div></main>;
}
