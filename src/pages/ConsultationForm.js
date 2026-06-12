// src/pages/ConsultationForm.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SECTIONS = [
  { id: 1, title: 'Informations générales', emoji: '👤' },
  { id: 2, title: 'Santé & vigilance', emoji: '🏥' },
  { id: 3, title: 'Objectif profond', emoji: '🎯' },
  { id: 4, title: 'Sport & activité', emoji: '🏋️' },
  { id: 5, title: 'Comptage ou intuition', emoji: '📊' },
  { id: 6, title: 'Journée alimentaire', emoji: '🍽️' },
  { id: 7, title: 'Week-end & vie sociale', emoji: '🥂' },
  { id: 8, title: 'Organisation concrète', emoji: '🗂️' },
  { id: 9, title: 'Rapport à la nourriture', emoji: '💭' },
  { id: 10, title: 'Synthèse coach', emoji: '📋' },
  { id: 11, title: 'Décision & offre', emoji: '✅' },
];

const EMPTY_FORM = {
  // Section 1
  date: format(new Date(), 'yyyy-MM-dd'),
  firstName: '', lastName: '', dob: '', age: '',
  weightCurrent: '', height: '',
  weightMax: '', weightComfort: '',
  job: '', workRhythm: '',
  schedule: '', familyConstraints: '',
  // Section 2
  pathologies: { thyroide: false, sopk: false, diabete: false, insuline: false, digestion: false, autre: false },
  pathologiesNote: '',
  medicalFollow: false, medicalNote: '',
  sleepStress: false, sleepNote: '',
  eatingDisorder: false, eatingNote: '',
  healthNotes: '',
  previousDiets: '',
  // Section 3
  whyNow: '',
  goalMeasurable: '',
  in6months: '',
  readyToChange: '',
  // Section 4
  sportYes: false, sportType: '',
  sportFreq: '', sportDuration: '',
  steps: '', stepDevice: '',
  injuries: '', sportPrefs: '',
  sportPlan: '',
  // Section 5
  wantsCount: false, doesntWantCount: false,
  countedBefore: false, countedHelp: false, countedStress: false, countedObsess: false,
  okWeigh: false, prefVisual: false, prefPhoto: false,
  modeDecision: '',
  // Section 6
  mealMorning: '', mealMorningHunger: '',
  mealSnackAm: '', mealSnackAmHunger: '',
  mealLunch: '', mealLunchHunger: '',
  mealSnackPm: '', mealSnackPmHunger: '',
  mealDinner: '', mealDinnerHunger: '',
  mealAfterDinner: '', mealAfterDinnerHunger: '',
  drinks: '', drinksHunger: '',
  // Section 7
  weekend: '',
  socialLife: '',
  derailSituations: '',
  // Section 8
  doGroceries: false, cookOften: false, mealPrep: false,
  freezer: false, needVariety: false, budgetConstraint: false,
  cookTime: '',
  foodsLikedRefused: '',
  // Section 9
  eatByHunger: false, eatByEmotion: false,
  emotionTypes: { stress: false, boredom: false, tired: false, reward: false },
  appetite: '',
  eatingNotes: '',
  // Section 10
  mainGoal: '',
  mainBrake: '',
  strengths: '',
  lifestyle: '',
  strategy: '',
  // Section 11
  offerChosen: '', // 'platinum' | 'gold' | 'thinking' | 'no'
  nextAction: '',
  startDate: '',
  attachedClientId: '',
};

export default function ConsultationForm() {
  const navigate = useNavigate();
  const { consultId } = useParams();
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeSection, setActiveSection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  // ID stable pour toute la session - évite les doublons
  const [stableId] = useState(() =>
    consultId && consultId !== 'new' ? consultId : `consult_${Date.now()}`
  );

  useEffect(() => {
    async function load() {
      // Charger les clients pour l'attachement
      const snap = await getDocs(query(collection(db, 'clients'), orderBy('lastName')));
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.archived));

      // Si édition d'une consultation existante
      if (consultId && consultId !== 'new') {
        const doc_ = await getDoc(doc(db, 'consultations', consultId));
        if (doc_.exists()) setForm(doc_.data());
      }
      setLoading(false);
    }
    load();
  }, [consultId]);

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }
  function setNested(key, subKey, val) { setForm(p => ({ ...p, [key]: { ...p[key], [subKey]: val } })); }

  async function handleSave(finalize = false) {
    setSaving(true);
    try {
      await setDoc(doc(db, 'consultations', stableId), {
        ...form,
        id: stableId,
        finalized: finalize,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (finalize) {
        navigate('/coach');
        return;
      }
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
      alert('Erreur lors de la sauvegarde. Vérifie ta connexion.');
    }
    setSaving(false);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  const progress = Math.round((activeSection / SECTIONS.length) * 100);

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/coach" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title" style={{ fontSize: 14 }}>Consultation nutrition</div>
        <button onClick={() => handleSave(false)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          {saving ? '...' : saved ? '✅' : 'Sauv.'}
        </button>
      </div>

      <div className="page">
        {/* Progress */}
        <div className="progress-bar" style={{ marginBottom: 8 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, textAlign: 'center' }}>
          Section {activeSection} / {SECTIONS.length}
        </p>

        {/* Navigation sections */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              flexShrink: 0, padding: '6px 10px', borderRadius: 20, cursor: 'pointer',
              border: `2px solid ${activeSection === s.id ? 'var(--primary)' : 'var(--border)'}`,
              background: activeSection === s.id ? 'var(--primary)' : 'white',
              color: activeSection === s.id ? 'white' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)',
            }}>{s.emoji} {s.id}</button>
          ))}
        </div>

        {/* Phrase d'accueil */}
        {activeSection === 1 && (
          <div className="card" style={{ background: 'var(--primary-bg)', border: '1.5px solid var(--primary-light)', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--primary)', lineHeight: 1.6 }}>
              💬 <strong>Phrase d'accueil :</strong> "Cette première consultation est gratuite et sans engagement. L'objectif est de comprendre ta situation, ton rythme de vie, tes habitudes et tes freins. Ensuite seulement, je te dirai ce qui me semble le plus adapté pour toi, sans pression."
            </div>
          </div>
        )}

        {/* SECTION 1 — Infos générales */}
        {activeSection === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>👤 Informations générales</h2>
            <div className="input-group">
              <label className="input-label">Date de consultation</label>
              <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group"><label className="input-label">Prénom</label><input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Nom</label><input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Date de naissance</label><input className="input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Âge</label><input className="input" type="number" value={form.age} onChange={e => set('age', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Poids actuel (kg)</label><input className="input" type="number" value={form.weightCurrent} onChange={e => set('weightCurrent', e.target.value)} step="0.1" /></div>
              <div className="input-group"><label className="input-label">Taille (cm)</label><input className="input" type="number" value={form.height} onChange={e => set('height', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Poids le plus haut</label><input className="input" type="number" value={form.weightMax} onChange={e => set('weightMax', e.target.value)} step="0.1" /></div>
              <div className="input-group"><label className="input-label">Poids où tu te sentais bien</label><input className="input" type="number" value={form.weightComfort} onChange={e => set('weightComfort', e.target.value)} step="0.1" /></div>
            </div>
            <div className="input-group"><label className="input-label">Métier</label><input className="input" value={form.job} onChange={e => set('job', e.target.value)} /></div>
            <div className="input-group"><label className="input-label">Rythme de travail / horaires / télétravail</label><textarea className="input" rows={2} value={form.workRhythm} onChange={e => set('workRhythm', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Contraintes familiales</label><textarea className="input" rows={2} value={form.familyConstraints} onChange={e => set('familyConstraints', e.target.value)} style={{ resize: 'none' }} /></div>
          </div>
        )}

        {/* SECTION 2 — Santé */}
        {activeSection === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>🏥 Santé & vigilance</h2>
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Pathologies connues</div>
              {[['thyroide','Thyroïde'],['sopk','SOPK'],['diabete','Diabète'],['insuline','Résistance insuline'],['digestion','Digestion'],['autre','Autre']].map(([k,l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.pathologies[k]} onChange={e => setNested('pathologies', k, e.target.checked)} />
                  {l}
                </label>
              ))}
              <textarea className="input" rows={2} value={form.pathologiesNote} onChange={e => set('pathologiesNote', e.target.value)} placeholder="Notes pathologies..." style={{ resize: 'none', marginTop: 8 }} />
            </div>
            {[
              { key: 'medicalFollow', label: 'Traitement médical / suivi médecin / endocrino / diétet.', noteKey: 'medicalNote' },
              { key: 'sleepStress', label: 'Sommeil compliqué / fatigue / stress élevé', noteKey: 'sleepNote' },
              { key: 'eatingDisorder', label: 'Troubles alimentaires passés ou actuels / hyperphagie / compulsions', noteKey: 'eatingNote' },
            ].map(item => (
              <div key={item.key} className="card">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  <input type="checkbox" checked={form[item.key]} onChange={e => set(item.key, e.target.checked)} />
                  {item.label}
                </label>
                {form[item.key] && <textarea className="input" rows={2} value={form[item.noteKey]} onChange={e => set(item.noteKey, e.target.value)} placeholder="Préciser..." style={{ resize: 'none', marginTop: 8 }} />}
              </div>
            ))}
            <div className="input-group"><label className="input-label">Notes santé importantes</label><textarea className="input" rows={3} value={form.healthNotes} onChange={e => set('healthNotes', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Régimes déjà essayés — ce qui a marché / fait lâcher</label><textarea className="input" rows={4} value={form.previousDiets} onChange={e => set('previousDiets', e.target.value)} style={{ resize: 'none' }} /></div>
          </div>
        )}

        {/* SECTION 3 — Objectif */}
        {activeSection === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>🎯 Objectif profond</h2>
            <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: 12, color: '#92400E' }}>💡 <strong>Relance :</strong> Si elle répond seulement "je veux perdre X kilos" → "On garde l'objectif chiffré, mais je veux comprendre ce que ça va changer pour toi. C'est ça qui va t'aider à tenir."</div>
            </div>
            <div className="input-group"><label className="input-label">Pourquoi tu veux changer aujourd'hui ?</label><textarea className="input" rows={4} value={form.whyNow} onChange={e => set('whyNow', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Objectif chiffré : poids / mensurations / vêtements / énergie</label><textarea className="input" rows={3} value={form.goalMeasurable} onChange={e => set('goalMeasurable', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Dans 6 mois, qu'est-ce qui te ferait dire "ça valait le coup" ?</label><textarea className="input" rows={3} value={form.in6months} onChange={e => set('in6months', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Ce que tu es prête(e) à changer / ce que tu ne veux pas sacrifier</label><textarea className="input" rows={4} value={form.readyToChange} onChange={e => set('readyToChange', e.target.value)} style={{ resize: 'none' }} /></div>
          </div>
        )}

        {/* SECTION 4 — Sport */}
        {activeSection === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>🏋️ Sport & activité</h2>
            <div className="card">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                <input type="checkbox" checked={form.sportYes} onChange={e => set('sportYes', e.target.checked)} />
                Fait du sport actuellement
              </label>
              {form.sportYes && <input className="input" value={form.sportType} onChange={e => set('sportType', e.target.value)} placeholder="Type de sport..." />}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group"><label className="input-label">Fréquence</label><input className="input" value={form.sportFreq} onChange={e => set('sportFreq', e.target.value)} placeholder="ex: 3x/semaine" /></div>
              <div className="input-group"><label className="input-label">Durée / intensité</label><input className="input" value={form.sportDuration} onChange={e => set('sportDuration', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Pas / marche quotidienne</label><input className="input" value={form.steps} onChange={e => set('steps', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Montre / appli ?</label><input className="input" value={form.stepDevice} onChange={e => set('stepDevice', e.target.value)} /></div>
            </div>
            <div className="input-group"><label className="input-label">Douleurs / mouvements à éviter</label><input className="input" value={form.injuries} onChange={e => set('injuries', e.target.value)} /></div>
            <div className="input-group"><label className="input-label">Ce que tu aimes / détestes</label><textarea className="input" rows={2} value={form.sportPrefs} onChange={e => set('sportPrefs', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Routine sportive réaliste à court terme</label><textarea className="input" rows={3} value={form.sportPlan} onChange={e => set('sportPlan', e.target.value)} style={{ resize: 'none' }} /></div>
            {!form.sportYes && (
              <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: 12, color: '#92400E' }}>💡 "Ce n'est pas grave. On ne va pas te transformer en athlète olympique lundi matin. On va d'abord augmenter le mouvement de façon réaliste : marche, pas, routine simple."</div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 5 — Comptage */}
        {activeSection === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>📊 Comptage ou intuition</h2>
            <div className="card">
              {[
                { key: 'wantsCount', label: 'Souhaite compter les calories / macros' },
                { key: 'doesntWantCount', label: 'Préférerait ne pas compter' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, marginBottom: 10 }}>
                  <input type="checkbox" checked={form[item.key]} onChange={e => set(item.key, e.target.checked)} />
                  {item.label}
                </label>
              ))}
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8, marginBottom: 8 }}>A déjà compté :</div>
              {[['countedBefore','A déjà compté'],['countedHelp','Aidant'],['countedStress','Stressant'],['countedObsess','Obsessionnel']].map(([k,l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 6 }}>
                  <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} />
                  {l}
                </label>
              ))}
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Mode de suivi préféré :</div>
              {[['okWeigh','OK pour peser'],['prefVisual','Préfère repères visuels'],['prefPhoto','Photos repas']].map(([k,l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 6 }}>
                  <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} />
                  {l}
                </label>
              ))}
            </div>
            {form.wantsCount && (
              <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: 12, color: '#92400E' }}>💡 "Compter au début, ce n'est pas une prison, c'est un outil d'apprentissage. L'objectif n'est pas de peser toute ta vie, mais de comprendre ton assiette."</div>
              </div>
            )}
            {form.doesntWantCount && (
              <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: 12, color: '#92400E' }}>💡 "On peut travailler sans comptage. Par contre, il faudra être régulière sur les repères visuels, les photos, les bilans et l'honnêteté."</div>
              </div>
            )}
            <div className="input-group"><label className="input-label">Décision et cadre choisi</label><textarea className="input" rows={3} value={form.modeDecision} onChange={e => set('modeDecision', e.target.value)} style={{ resize: 'none' }} /></div>
          </div>
        )}

        {/* SECTION 6 — Journée alimentaire */}
        {activeSection === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>🍽️ Journée alimentaire type</h2>
            {[
              { meal: 'morning', label: '🌅 Matin', key: 'mealMorning', keyH: 'mealMorningHunger' },
              { meal: 'snackam', label: '☕ Collation matin', key: 'mealSnackAm', keyH: 'mealSnackAmHunger' },
              { meal: 'lunch', label: '☀️ Midi', key: 'mealLunch', keyH: 'mealLunchHunger' },
              { meal: 'snackpm', label: '🍎 Après-midi', key: 'mealSnackPm', keyH: 'mealSnackPmHunger' },
              { meal: 'dinner', label: '🌙 Soir', key: 'mealDinner', keyH: 'mealDinnerHunger' },
              { meal: 'after', label: '🌛 Après dîner', key: 'mealAfterDinner', keyH: 'mealAfterDinnerHunger' },
              { meal: 'drinks', label: '🥤 Boissons / alcool', key: 'drinks', keyH: 'drinksHunger' },
            ].map(m => (
              <div key={m.meal} className="card" style={{ padding: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{m.label}</div>
                <textarea className="input" rows={2} value={form[m.key]} onChange={e => set(m.key, e.target.value)} placeholder="Ce que tu manges / bois..." style={{ resize: 'none', marginBottom: 6 }} />
                <input className="input" value={form[m.keyH]} onChange={e => set(m.keyH, e.target.value)} placeholder="Faim / contexte / remarques" />
              </div>
            ))}
          </div>
        )}

        {/* SECTION 7 — Week-end */}
        {activeSection === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>🥂 Week-end & vie sociale</h2>
            <div className="input-group"><label className="input-label">Week-end type : restaurants, famille, alcool, grignotage, livraison...</label><textarea className="input" rows={4} value={form.weekend} onChange={e => set('weekend', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Vie sociale — ce qu'elle veut conserver absolument</label><textarea className="input" rows={3} value={form.socialLife} onChange={e => set('socialLife', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Les situations qui font dérailler</label><textarea className="input" rows={3} value={form.derailSituations} onChange={e => set('derailSituations', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: 12, color: '#92400E' }}>💡 "On ne va pas supprimer ta vie sociale. On va l'organiser : choisir tes priorités, compenser intelligemment autour et éviter que chaque sortie devienne un week-end entier en roue libre."</div>
            </div>
          </div>
        )}

        {/* SECTION 8 — Organisation */}
        {activeSection === 8 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>🗂️ Organisation concrète</h2>
            <div className="card">
              {[
                ['doGroceries','Fait ses courses régulièrement'],
                ['cookOften','Cuisine souvent'],
                ['mealPrep','Meal prep possible'],
                ['freezer','Congélateur / options de secours'],
                ['needVariety','Besoin de variété'],
                ['budgetConstraint','Budget alimentaire à respecter'],
              ].map(([k,l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, marginBottom: 8 }}>
                  <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} />
                  {l}
                </label>
              ))}
            </div>
            <div className="input-group"><label className="input-label">Temps disponible pour cuisiner / organisation réaliste</label><textarea className="input" rows={3} value={form.cookTime} onChange={e => set('cookTime', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Aliments aimés / refusés / déclencheurs</label><textarea className="input" rows={3} value={form.foodsLikedRefused} onChange={e => set('foodsLikedRefused', e.target.value)} style={{ resize: 'none' }} /></div>
          </div>
        )}

        {/* SECTION 9 — Rapport nourriture */}
        {activeSection === 9 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>💭 Rapport à la nourriture</h2>
            <div className="card">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, marginBottom: 10 }}>
                <input type="checkbox" checked={form.eatByHunger} onChange={e => set('eatByHunger', e.target.checked)} />
                Mange plutôt par faim physique
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, marginBottom: 10 }}>
                <input type="checkbox" checked={form.eatByEmotion} onChange={e => set('eatByEmotion', e.target.checked)} />
                Mange plutôt par émotion
              </label>
              {form.eatByEmotion && (
                <div style={{ paddingLeft: 12, marginTop: 4 }}>
                  {[['stress','Stress'],['boredom','Ennui'],['tired','Fatigue'],['reward','Récompense']].map(([k,l]) => (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 6 }}>
                      <input type="checkbox" checked={form.emotionTypes[k]} onChange={e => setNested('emotionTypes', k, e.target.checked)} />
                      {l}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="input-group"><label className="input-label">Appétit / satiété / grignotage</label><textarea className="input" rows={3} value={form.appetite} onChange={e => set('appetite', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Autres notes</label><textarea className="input" rows={3} value={form.eatingNotes} onChange={e => set('eatingNotes', e.target.value)} style={{ resize: 'none' }} /></div>
          </div>
        )}

        {/* SECTION 10 — Synthèse coach */}
        {activeSection === 10 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>📋 Synthèse coach</h2>
            <div className="card" style={{ background: 'var(--primary-bg)', border: '1.5px solid var(--primary-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--primary)', lineHeight: 1.7 }}>
                💬 <strong>Phrase clé :</strong> "Je préfère être claire : un rééquilibrage alimentaire prend du temps. Mais ce temps-là sert à construire quelque chose qui tient, pas à refaire un régime de plus."<br/>
                💬 <strong>Phrase forte :</strong> "On ne va pas faire un régime de plus. On va construire le système alimentaire que tu aurais aimé avoir depuis des années."
              </div>
            </div>
            <div className="input-group"><label className="input-label">Objectif principal</label><textarea className="input" rows={3} value={form.mainGoal} onChange={e => set('mainGoal', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Frein numéro 1</label><textarea className="input" rows={2} value={form.mainBrake} onChange={e => set('mainBrake', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Forces / leviers</label><textarea className="input" rows={2} value={form.strengths} onChange={e => set('strengths', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Rythme de vie à respecter</label><textarea className="input" rows={2} value={form.lifestyle} onChange={e => set('lifestyle', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Stratégie conseillée (comptage / repères / photos / meal prep...)</label><textarea className="input" rows={3} value={form.strategy} onChange={e => set('strategy', e.target.value)} style={{ resize: 'none' }} /></div>
          </div>
        )}

        {/* SECTION 11 — Décision */}
        {activeSection === 11 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>✅ Décision & offre</h2>

            {/* Script tarifs */}
            <div className="card" style={{ background: 'var(--primary-bg)', border: '1.5px solid var(--primary-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--primary)', lineHeight: 1.7 }}>
                💬 "Cette première consultation est gratuite. Elle sert à voir si je peux vraiment t'aider et quel niveau d'accompagnement est le plus pertinent pour toi."
              </div>
            </div>

            {/* Tableau comparatif */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Comparatif offres</div>
              {[
                { offer: 'platinum', label: '💎 Platinum', price: '299 € / mois', desc: 'Suivi quotidien · Pour apprendre vite, être cadrée et corriger les erreurs au jour le jour', script: "Vu ce que tu me décris, l'offre la plus adaptée pour toi, c'est le Platinum à 299 € par mois. C'est le suivi quotidien." },
                { offer: 'gold', label: '🥇 Gold', price: '199 € / mois', desc: 'Suivi hebdomadaire · Pour une personne autonome qui veut un cadre et des ajustements chaque semaine', script: "Si tu préfères un cadre moins rapproché, il y a le Gold à 199 € par mois, avec un suivi hebdomadaire." },
              ].map(o => (
                <div key={o.offer} onClick={() => set('offerChosen', o.offer)} style={{
                  padding: '14px', borderRadius: 10, marginBottom: 10, cursor: 'pointer',
                  border: `2px solid ${form.offerChosen === o.offer ? 'var(--primary)' : 'var(--border)'}`,
                  background: form.offerChosen === o.offer ? 'var(--primary-bg)' : 'white',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: form.offerChosen === o.offer ? 'var(--primary)' : 'var(--text)' }}>{o.label}</div>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>{o.price}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{o.desc}</div>
                  {form.offerChosen === o.offer && (
                    <div style={{ fontSize: 12, color: 'var(--primary)', fontStyle: 'italic', background: 'white', padding: '8px', borderRadius: 8 }}>
                      💬 Script : "{o.script}"
                    </div>
                  )}
                </div>
              ))}
              {[
                { offer: 'thinking', label: '🤔 Veut réfléchir' },
                { offer: 'no', label: '❌ Ne souhaite pas poursuivre' },
              ].map(o => (
                <label key={o.offer} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, marginBottom: 8 }}>
                  <input type="radio" name="offer" checked={form.offerChosen === o.offer} onChange={() => set('offerChosen', o.offer)} />
                  {o.label}
                </label>
              ))}
              {form.offerChosen === 'thinking' && (
                <div style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', padding: 10, borderRadius: 8, marginTop: 4 }}>
                  💬 "Aucun souci. Je préfère que tu sois vraiment engagée plutôt que de dire oui par pression. Réfléchis au niveau de suivi qui te permettra réellement d'appliquer."
                </div>
              )}
            </div>

            {/* Réponses objections */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>💬 Réponses aux objections</div>
              {[
                { obj: '"C\'est un budget."', rep: '"Je comprends. Ce qui coûte cher aussi, c\'est de prendre un accompagnement trop léger, de ne pas s\'y tenir, puis de repartir de zéro dans deux mois."' },
                { obj: "Je peux essayer seul(e).", rep: "Bien sûr. Mais si tu viens me voir aujourd'hui, c'est probablement que seul(e), ce n'est pas si simple." },
                { obj: '"J\'ai peur d\'être trop surveillée."', rep: '"Je ne suis pas là pour te fliquer. Je suis là pour t\'aider à rendre des comptes intelligemment."' },
              ].map((o, i) => (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < 2 ? '1px solid var(--border-light)' : 'none' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>❓ {o.obj}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>✅ {o.rep}</div>
                </div>
              ))}
            </div>

            <div className="input-group"><label className="input-label">Prochaine action décidée</label><textarea className="input" rows={2} value={form.nextAction} onChange={e => set('nextAction', e.target.value)} style={{ resize: 'none' }} /></div>
            <div className="input-group"><label className="input-label">Date de démarrage / prochain point</label><input className="input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>

            {/* Attacher à un client */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🔗 Attacher à un client</div>
              <select className="input" value={form.attachedClientId} onChange={e => set('attachedClientId', e.target.value)}>
                <option value="">— Nouveau prospect (pas encore inscrit) —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {(c.lastName || '').toUpperCase()}</option>
                ))}
              </select>
              {form.attachedClientId && <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 8 }}>✅ Dossier attaché au profil client</p>}
            </div>

            <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving} style={{ marginTop: 8 }}>
              {saving ? '⏳ Sauvegarde en cours...' : '✅ Finaliser et enregistrer'}
            </button>
            <button className="btn btn-ghost" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? '...' : '💾 Sauvegarder sans finaliser'}
            </button>
            <button
              onClick={async () => {
                if (!window.confirm('Supprimer définitivement cette consultation ?')) return;
                const { doc: docRef, deleteDoc: del } = await import('firebase/firestore');
                await del(docRef(db, 'consultations', stableId));
                navigate('/coach');
              }}
              style={{ width: '100%', padding: '12px', background: 'none', border: '1.5px solid var(--danger)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
              🗑️ Supprimer cette consultation
            </button>
          </div>
        )}

        {/* Navigation bas */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, marginBottom: 16 }}>
          {activeSection > 1 && (
            <button className="btn btn-ghost" onClick={() => setActiveSection(s => s - 1)} style={{ flex: 1 }}>← Précédent</button>
          )}
          {activeSection < SECTIONS.length && (
            <button className="btn btn-primary" onClick={() => { handleSave(false); setActiveSection(s => s + 1); }} style={{ flex: 1 }}>
              Suivant →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
