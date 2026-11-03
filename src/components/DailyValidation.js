import React, {useEffect,useRef,useState} from 'react';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {db} from '../firebase';
const labels={carry:'Report précédent',base:'Objectif de base',stepsAdjustment:'Ajustement des pas',sessionAdjustment:'Ajustement de séance',extraActivity:'Activité supplémentaire',target:'Objectif du jour',intake:'Apports',delta:'Écart du jour',total:'Solde cumulé'};
export default function DailyValidation({clientId,day,onClose,onSaved,coachMode=false}) {
  const [response,setPreview]=useState(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
  const [reason,setReason]=useState('');
  const [refresh,setRefresh]=useState(0);
  const sentReason=useRef(null);
  const scope=`${coachMode?'coach':'student'}/${clientId}/${day}`;
  const preview=response?.scope===scope?response.data:null;
  const operation=useRef(crypto.randomUUID());
  useEffect(()=>{
    let active=true;
    httpsCallable(getFunctions(db.app,'europe-west1'),'coachMutation')({action:coachMode?'previewCoachDaily':'previewDaily',clientId,day})
      .then(result=>{if(active)setPreview({scope,data:result.data});}).catch(err=>{if(active)setError(err.message||'Le calcul serveur est indisponible.');});
    return()=>{active=false;};
  },[clientId,day,coachMode,scope,refresh]);
  function refreshPreview(){
    setError('');setPreview(null);sentReason.current=null;operation.current=crypto.randomUUID();setRefresh(value=>value+1);
  }
  async function confirm() {
    if(pending||!preview)return;
    setPending(true);setError('');
    try {
      if(coachMode&&sentReason.current===null)sentReason.current=reason.trim();
      const result=await httpsCallable(getFunctions(db.app,'europe-west1'),'coachMutation')({action:coachMode?'validateCoachDaily':'validateDaily',clientId,day,operationId:operation.current,confirmationToken:preview.confirmationToken,...(coachMode?{reason:sentReason.current}:{})});
      onSaved(result.data);
    } catch(err) {
      setError(err.message||'Validation non confirmée. Réessaie pour vérifier cette opération.');
      if(['functions/aborted','functions/failed-precondition','functions/permission-denied','functions/invalid-argument','functions/resource-exhausted'].includes(err.code))setPreview(null);
    } finally {setPending(false);}
  }
  return <div style={{position:'fixed',inset:0,background:'#0007',zIndex:10000,display:'grid',placeItems:'center',padding:20}}>
    <section className="card" role="dialog" aria-modal="true" aria-labelledby="daily-validation-title" style={{maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
      <h2 id="daily-validation-title">{coachMode?'Vérifier et valider cette journée':'Vérifier et valider ma journée'}</h2><p>{day}</p>
      {!preview&&!error&&<p role="status">Calcul du solde par le serveur…</p>}
      {preview?.breakdown.tracking ? <dl>{Object.entries(labels).map(([key,label])=><div key={key} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'6px 0'}}><dt>{label}</dt><dd>{preview.breakdown[key]==null?'En attente':`${preview.breakdown[key].toLocaleString('fr-FR')} kcal`}</dd></div>)}</dl>
        :preview&&<p>Ton journal sera validé sans affichage de calories.</p>}
      {preview?.breakdown.excluded&&<p>Journée exclue du comptage à ton choix.</p>}
      {coachMode&&<><p>La validation sera enregistrée à ton nom dans l’historique de l’élève.</p><label htmlFor="validation-coach-reason">Commentaire (facultatif)</label><textarea id="validation-coach-reason" className="input" value={reason} maxLength={500} disabled={pending||sentReason.current!==null} onChange={event=>setReason(event.target.value)}/></>}
      {error&&<p role="alert">{error}</p>}
      {!preview&&error&&<button className="btn btn-secondary" onClick={refreshPreview} disabled={pending}>Recalculer l’aperçu</button>}
      <div style={{display:'flex',gap:12,marginTop:16}}>
        <button className="btn btn-secondary" onClick={onClose} disabled={pending}>Fermer</button>
        <button className="btn btn-primary" onClick={confirm} disabled={pending||!preview}>{pending?'Validation…':'Confirmer la validation'}</button>
      </div>
    </section>
  </div>;
}
