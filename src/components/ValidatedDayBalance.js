import React from 'react';

const signed=value=>`${value>0?'+':''}${value.toLocaleString('fr-FR')} kcal`;

export default function ValidatedDayBalance({entry}) {
  if(!entry?.locked)return <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>Le solde sera calculé par le serveur avant la validation de ta journée.</p>;
  const calculation=entry.balanceCalculation;
  const pending=calculation?.state==='pending';
  const total=calculation ? calculation.total : entry.dailyBalance;
  const rows=[['Report précédent',calculation?.carry],['Objectif de base',calculation?.base],['Ajustement des pas',calculation?.stepsAdjustment],['Ajustement de séance',calculation?.sessionAdjustment],['Activité supplémentaire',calculation?.extraActivity],['Objectif du jour',calculation?.target],['Apports',calculation?.intake],['Écart du jour',calculation?.delta]];
  return <section aria-label="Solde validé" style={{padding:14,borderRadius:14,background:'#f3edff',border:'1px solid #b49ae2',color:'#271440',marginBottom:14}}>
    <p style={{fontWeight:700,color:'#512586'}}>🔒 Solde validé : {pending||!Number.isFinite(total)?'En attente de calcul':signed(total)}</p>
    {pending&&<p>Une journée précédente doit être régularisée par ta coach avant de confirmer le report.</p>}
    {calculation?.excluded&&<p>Journée exclue du comptage à ton choix.</p>}
    {calculation&&<details style={{marginTop:8}}><summary>Détail du calcul</summary><dl>{rows.map(([label,value])=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:6,fontSize:12}}><dt>{label}</dt><dd>{Number.isFinite(value)?(['Objectif de base','Objectif du jour','Apports'].includes(label)?`${value.toLocaleString('fr-FR')} kcal`:signed(value)):'En attente'}</dd></div>)}</dl></details>}
  </section>;
}
