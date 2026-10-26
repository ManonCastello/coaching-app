import React, {useRef, useState} from 'react';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {db} from '../firebase';

export const auditedMutationsEnabled = process.env.REACT_APP_AUDITED_MUTATIONS === 'true';
export default function AuditedCoachAction({command, onClose, onSaved}) {
  const operationId = useRef(crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sentReason = useRef(null);
  async function save(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    // Keep the same payload and operation ID on retry after an uncertain response.
    if (sentReason.current === null) sentReason.current = reason.trim();
    try {
      const call = httpsCallable(getFunctions(db.app, 'europe-west1'), 'coachMutation');
      await call({...command, operationId: operationId.current, reason: sentReason.current});
      onSaved();
    } catch (err) {
      if (['functions/invalid-argument','functions/aborted','functions/permission-denied','functions/failed-precondition'].includes(err.code)) sentReason.current = null;
      setError(err.code === 'functions/aborted' ? 'La fiche a changé. Ferme cette fenêtre et actualise avant de réessayer.' : err.message || 'Enregistrement non confirmé. Réessaie pour vérifier cette opération.');
    } finally { setPending(false); }
  }
  return <div style={{position: 'fixed', inset: 0, background: '#0007', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20}}>
    <form onSubmit={save} className="card" role="dialog" aria-modal="true" aria-labelledby="audit-title" style={{width: '100%', maxWidth: 480}}>
      <h2 id="audit-title">{command.action === 'setTargets' ? 'Modifier les objectifs' : command.action === 'resetBalance' ? 'Remettre le solde à zéro' : command.action === 'setBalance' ? 'Corriger le solde' : 'Rouvrir cette journée'}</h2>
      <p>La modification et son motif seront conservés dans l’historique sécurisé.</p>
      {command.day && <p>Journée : {command.day}</p>}
      <label htmlFor="audit-reason">Motif de la modification</label>
      <textarea id="audit-reason" className="input" value={reason} minLength={3} maxLength={500} required disabled={pending || sentReason.current !== null} onChange={event => setReason(event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <div style={{display: 'flex', gap: 12, marginTop: 16}}>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={onClose}>Fermer</button>
        <button className="btn btn-primary" disabled={pending || reason.trim().length < 3}>{pending ? 'Enregistrement…' : 'Confirmer'}</button>
      </div>
    </form>
  </div>;
}
