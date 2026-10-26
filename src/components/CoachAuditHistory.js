import React, {useEffect, useState} from 'react';
import {collection, getDocsFromServer, query, orderBy, limit} from 'firebase/firestore';
import {db} from '../firebase';
const actions = {setTargets:'Objectifs modifiés', resetBalance:'Solde remis à zéro', setBalance:'Solde corrigé', unlockDaily:'Journée rouverte', correctDaily:'Journée corrigée'};
const fields = {targets:'Objectifs', calories:'Calories', protein:'Protéines', carbs:'Glucides', fat:'Lipides', steps:'Pas', sleep:'Sommeil', weight:'Poids', dailyBalance:'Solde', dailyTarget:'Objectif du jour', locked:'Journée validée', sessionsPerWeek:'Séances par semaine', kcalPer1000Steps:'Ajustement pour 1 000 pas', sessionCalorieDeficit:'Ajustement par séance', extraActivityCal:'Activité supplémentaire'};
function values(value) {
  return <dl>{Object.entries(value || {}).filter(([key]) => key !== 'targetPeriod').map(([key, item]) => <div key={key}>
    <dt>{fields[key] || key}</dt><dd>{item == null ? 'Non renseigné' : typeof item === 'object' ? values(item) : typeof item === 'boolean' ? (item ? 'Oui' : 'Non') : String(item)}</dd>
  </div>)}</dl>;
}
export default function CoachAuditHistory({clientId, audience = 'coach', hideValues = false}) {
  const [result, setResult] = useState({clientId:null, events:[], status:'Chargement…'});
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setResult({clientId, events:[], status:'Chargement…'});
    getDocsFromServer(query(collection(db, 'clients', clientId, 'auditEvents'), orderBy('createdAt', 'desc'), limit(50)))
      .then(snapshot => { if (active) setResult({clientId, events:snapshot.docs.map(item => ({id:item.id, ...item.data()})), status:snapshot.empty ? 'Aucune correction tracée pour le moment.' : 'Les 50 dernières opérations sont affichées au maximum.'}); })
      .catch(() => { if (active) setResult({clientId, events:[], status:'Impossible de charger l’historique. Vérifie ta connexion et tes accès.', error:true}); });
    return () => { active = false; };
  }, [clientId, refresh]);
  // Never display the previous pupil's result while another profile is loading.
  const {events, status, error} = result.clientId === clientId ? result : {events:[], status:'Chargement…'};
  return <section className="card" aria-label="Historique des corrections">
    <h3>Historique des corrections</h3><p role="status">{status}</p>
    {error && <button className="btn btn-secondary" onClick={() => setRefresh(value => value + 1)}>Réessayer</button>}
    {events.map(event => <details key={event.id} style={{padding:'12px 0', borderBottom:'1px solid var(--border-light)'}}>
      <summary>{actions[event.action] || 'Modification'} · {event.createdAt?.toDate?.().toLocaleString('fr-FR') || 'Date indisponible'}</summary>
      <p>{hideValues ? 'Ta coach a mis à jour ton suivi. Les détails chiffrés sont masqués dans ton mode sans comptage.' : event.reason}</p>
      <p>{audience === 'student' ? 'Modification effectuée par ta coach.' : `Auteur : coach · identifiant du compte ${event.actorId}`}</p>
      {!hideValues && <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
        <div><strong>Avant</strong>{values(event.before)}</div>
        <div><strong>Après</strong>{values(event.after)}</div>
      </div>}
    </details>)}
  </section>;
}
