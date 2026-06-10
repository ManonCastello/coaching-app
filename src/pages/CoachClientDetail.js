// src/pages/CoachClientDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { calculateBMR, calculateTDEE, calculateAgeFromDOB, FORMULES } from '../utils/calculations';

export default function CoachClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [entries, setEntries] = useState([]);
  const [weeklyEntries, setWeeklyEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTargets, setEditTargets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [targets, setTargets] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editInfo, setEditInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({});
  function setI(key, val) { setInfoForm(p => ({ ...p, [key]: val })); }


  function setT(key, val) { setTargets(p => ({ ...p, [key]: val })); }

  useEffect(() => {
    async function load() {
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (clientDoc.exists()) { const data = clientDoc.data(); setClient(data); setTargets(data.targets || {}); setInfoForm({ firstName: data.firstName, lastName: data.lastName, dob: data.dob || '', profession: data.profession || '', weight: data.weight, height: data.height, sex: data.sex, activityLevel: data.activityLevel, goal: data.goal }); }
      const dailyQ = query(collection(db, 'clients', clientId, 'dailyEntries'), orderBy('date', 'desc'), limit(30));
      const dailySnap = await getDocs(dailyQ);
      setEntries(dailySnap.docs.map(d => d.data()).reverse());
      const weeklyQ = query(collection(db, 'clients', clientId, 'weeklyEntries'), orderBy('weekStart', 'desc'), limit(12));
      const weeklySnap = await getDocs(weeklyQ);
      setWeeklyEntries(weeklySnap.docs.map(d => d.data()).reverse());
      setLoading(false);
    }
    load();
  }, [clientId]);

  async function saveTargets() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        targets: {
          calories: +targets.calories || 0,
          protein: +targets.protein || 0,
          fat: +targets.fat || 0,
          carbs: +targets.carbs || 0,
          steps: +targets.steps || 10000,
          sleep: +targets.sleep || 8,
          sessionsPerWeek: +targets.sessionsPerWeek || 3,
          kcalPer1000Steps: +targets.kcalPer1000Steps || 20,
          sessionCalorieDeficit: +targets.sessionCalorieDeficit || 300,
        }
      });
      setClient(p => ({ ...p, targets }));
      setEditTargets(false); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  async function saveFormule(formule) {
    await updateDoc(doc(db, 'clients', clientId), { formule });
    setClient(p => ({ ...p, formule }));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }


  async function resetWeekBalance() {
    const { format, startOfWeek } = await import('date-fns');
    const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    // Load current entries to calculate current balance
    const { collection, query, orderBy, limit, getDocs, setDoc, serverTimestamp } = await import('firebase/firestore');
    const q = query(collection(db, 'clients', clientId, 'dailyEntries'), orderBy('date', 'desc'), limit(7));
    const snap = await getDocs(q);
    const entries = snap.docs.map(d => d.data());
    const t = client.targets || {};
    let totalDiff = 0;
    entries.forEach(e => {
      if (e.date >= weekKey && e.calories) {
        const stepBonus = Math.round(((e.steps || 0) - (t.steps || 10000)) / 1000 * (t.kcalPer1000Steps || 20));
        const sessionDef = e.didProgramSession === false ? -(t.sessionCalorieDeficit || 300) : 0;
        const extraCal = e.extraActivityCal ? +e.extraActivityCal : 0;
        const target = (t.calories || 2000) + stepBonus + extraCal + sessionDef;
        totalDiff += (e.calories - target);
      }
    });
    // Store negative offset to zero it out
    await setDoc(doc(db, 'clients', clientId, 'weekResets', weekKey), {
      offset: -Math.round(totalDiff),
      resetAt: serverTimestamp(),
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }


  async function saveInfo() {
    setSaving(true);
    try {
      const { calculateAgeFromDOB, calculateBMR, calculateTDEE } = await import('../utils/calculations');
      const age = calculateAgeFromDOB(infoForm.dob);
      const bmr = calculateBMR({ weight: +infoForm.weight, height: +infoForm.height, age, sex: infoForm.sex });
      const tdee = calculateTDEE({ bmr, activityLevel: infoForm.activityLevel });
      await updateDoc(doc(db, 'clients', clientId), {
        firstName: infoForm.firstName,
        lastName: infoForm.lastName,
        dob: infoForm.dob,
        profession: infoForm.profession,
        weight: +infoForm.weight,
        height: +infoForm.height,
        sex: infoForm.sex,
        activityLevel: infoForm.activityLevel,
        goal: infoForm.goal,
        bmr, tdee,
      });
      setClient(p => ({ ...p, ...infoForm, bmr, tdee }));
      setEditInfo(false);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function toggleArchive() {
    const newVal = !client.archived;
    await updateDoc(doc(db, 'clients', clientId), { archived: newVal });
    setClient(p => ({ ...p, archived: newVal }));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete() {
    await deleteDoc(doc(db, 'clients', clientId));
    navigate('/coach');
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;
  if (!client) return null;

  const age = calculateAgeFromDOB(client.dob);
  const bmr = calculateBMR({ weight: client.weight, height: client.height, age, sex: client.sex });
  const tdee = calculateTDEE({ bmr, activityLevel: client.activityLevel });
  const latestWeekly = weeklyEntries[weeklyEntries.length - 1];
  const weights = entries.filter(e => e.weight).map(e => ({ date: e.date, weight: e.weight, label: format(new Date(e.date), 'dd/MM', { locale: fr }) }));
  const firstWeight = weights.length > 0 ? weights[0].weight : null;
  const lastWeight = weights.length > 0 ? weights[weights.length - 1].weight : null;
  const weightDelta = firstWeight && lastWeight ? Math.round((lastWeight - firstWeight) * 10) / 10 : null;
  const avgCalories = entries.length ? Math.round(entries.reduce((s, e) => s + (e.calories || 0), 0) / entries.length) : 0;
  const avgSteps = entries.length ? Math.round(entries.reduce((s, e) => s + (e.steps || 0), 0) / entries.length) : 0;
  const sessionsDone = entries.filter(e => e.didProgramSession === true).length;
  const sessionsTracked = entries.filter(e => e.didProgramSession !== null && e.didProgramSession !== undefined).length;

  const tabs = [
    { key: 'overview', label: '📊 Vue' },
    { key: 'journal', label: '📋 Journal' },
    { key: 'bilans', label: '📅 Bilans' },
    { key: 'targets', label: '🎯 Objectifs' },
  ];

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/coach" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title" style={{ fontSize: 15 }}>{client.firstName} {client.lastName}</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="hero-banner" style={{ margin: '0 20px 0', borderRadius: '0 0 var(--radius) var(--radius)' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {client.firstName?.[0]}{client.lastName?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: 0 }}>{client.firstName} {client.lastName}</h2>
            <p style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{client.profession} · {age ? `${age} ans` : ''} · {client.sex === 'F' ? 'Femme' : 'Homme'}</p>
            <p style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>BMR {bmr || '—'} · TDEE {tdee || '—'} kcal</p>
          </div>
          {/* Formule selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {FORMULES.map(f => (
              <button key={f.value} onClick={() => saveFormule(f.value)} style={{
                padding: '4px 10px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: client.formule === f.value ? 'white' : 'rgba(255,255,255,0.2)',
                color: client.formule === f.value ? 'var(--primary)' : 'white',
                fontFamily: 'var(--font-body)'
              }}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', overflowX: 'auto', padding: '0 20px', gap: 4, marginTop: 8 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
            color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: `2px solid ${activeTab === t.key ? 'var(--primary)' : 'transparent'}`,
          }}>{t.label}</button>
        ))}
      </div>

      <div className="page" style={{ paddingTop: 16 }}>
        {saved && <div className="alert alert-success">✅ Mis à jour !</div>}

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-label">Dernier poids</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{lastWeight || '—'}<span className="stat-unit">kg</span></div>
                {weightDelta !== null && <div style={{ fontSize: 12, marginTop: 4, color: weightDelta < 0 ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>{weightDelta > 0 ? '+' : ''}{weightDelta} kg</div>}
              </div>
              <div className="stat-card"><div className="stat-label">Moy. calories</div><div className="stat-value">{avgCalories}<span className="stat-unit">kcal</span></div></div>
              <div className="stat-card"><div className="stat-label">Moy. pas</div><div className="stat-value" style={{ fontSize: 18 }}>{avgSteps.toLocaleString()}</div></div>
              <div className="stat-card"><div className="stat-label">Séances</div><div className="stat-value">{sessionsTracked > 0 ? `${sessionsDone}/${sessionsTracked}` : '—'}</div></div>
            </div>


            {/* Edit client info */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editInfo ? 16 : 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>👤 Informations client</div>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditInfo(!editInfo)}>
                  {editInfo ? 'Annuler' : 'Modifier'}
                </button>
              </div>
              {!editInfo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {[
                    { label: 'Prénom', value: client.firstName },
                    { label: 'Nom', value: client.lastName },
                    { label: 'Date de naissance', value: client.dob ? new Date(client.dob).toLocaleDateString('fr-FR') : '—' },
                    { label: 'Âge', value: age ? `${age} ans` : '—' },
                    { label: 'Profession', value: client.profession || '—' },
                    { label: 'Poids initial', value: `${client.weight} kg` },
                    { label: 'Taille', value: `${client.height} cm` },
                    { label: 'Sexe', value: client.sex === 'F' ? 'Femme' : 'Homme' },
                    { label: 'Activité', value: client.activityLevel },
                    { label: 'Objectif', value: client.goal },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                      <span style={{ fontWeight: 600 }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="input-group"><label className="input-label">Prénom</label><input className="input" value={infoForm.firstName || ''} onChange={e => setI('firstName', e.target.value)} /></div>
                    <div className="input-group"><label className="input-label">Nom</label><input className="input" value={infoForm.lastName || ''} onChange={e => setI('lastName', e.target.value)} /></div>
                  </div>
                  <div className="input-group"><label className="input-label">Date de naissance</label><input className="input" type="date" value={infoForm.dob || ''} onChange={e => setI('dob', e.target.value)} /></div>
                  <div className="input-group"><label className="input-label">Profession</label><input className="input" value={infoForm.profession || ''} onChange={e => setI('profession', e.target.value)} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="input-group"><label className="input-label">Poids (kg)</label><input className="input" type="number" value={infoForm.weight || ''} onChange={e => setI('weight', e.target.value)} step="0.1" /></div>
                    <div className="input-group"><label className="input-label">Taille (cm)</label><input className="input" type="number" value={infoForm.height || ''} onChange={e => setI('height', e.target.value)} /></div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Sexe</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {['F', 'H'].map(s => (
                        <button key={s} type="button" onClick={() => setI('sex', s)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: `2px solid ${infoForm.sex === s ? 'var(--primary)' : 'var(--border)'}`, background: infoForm.sex === s ? 'var(--primary-bg)' : 'white', color: infoForm.sex === s ? 'var(--primary)' : 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{s === 'F' ? 'Femme' : 'Homme'}</button>
                      ))}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Niveau d'activité</label>
                    <select className="input" value={infoForm.activityLevel || ''} onChange={e => setI('activityLevel', e.target.value)}>
                      {[{value:'sedentaire',label:'Sédentaire'},{value:'leger',label:'Légèrement actif'},{value:'actif',label:'Actif'},{value:'tres_actif',label:'Très actif'},{value:'extreme',label:'Extrêmement actif'}].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Objectif</label>
                    <select className="input" value={infoForm.goal || ''} onChange={e => setI('goal', e.target.value)}>
                      {[{value:'seche',label:'Sèche'},{value:'maintien',label:'Maintien'},{value:'prise',label:'Prise de masse'}].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={saveInfo} disabled={saving}>
                    {saving ? 'Enregistrement...' : '✅ Enregistrer les infos'}
                  </button>
                </div>
              )}
            </div>

            {weights.length > 1 && (
              <div className="card" style={{ marginBottom: 20, padding: '16px 8px 8px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, paddingLeft: 8 }}>📉 Évolution du poids</div>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={weights}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={35} />
                    <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v} kg`]} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {latestWeekly?.measurements && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📏 Dernières mensurations</div>
                {[
                  { key: 'waist', label: 'Taille', emoji: '👗' },
                  { key: 'hips', label: 'Hanches', emoji: '🔵' },
                  { key: 'glutes', label: 'Fesses', emoji: '🍑' },
                  { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
                  { key: 'arms', label: 'Bras', emoji: '💪' },
                ].map(m => {
                  const current = latestWeekly.measurements[m.key];
                  const prev = weeklyEntries.length >= 2 ? weeklyEntries[weeklyEntries.length - 2]?.measurements?.[m.key] : null;
                  const delta = current && prev ? Math.round((current - prev) * 10) / 10 : null;
                  return current ? (
                    <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: 13 }}>{m.emoji} {m.label}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{current} cm</span>
                        {delta !== null && <span style={{ fontSize: 11, fontWeight: 700, color: delta < 0 ? 'var(--success)' : delta > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{delta > 0 ? '+' : ''}{delta}</span>}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {latestWeekly?.photoURLs && Object.values(latestWeekly.photoURLs).some(u => u) && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📸 Dernières photos</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[{key:'face',label:'Face'},{key:'profile',label:'Profil'},{key:'back',label:'Dos'}].map(slot =>
                    latestWeekly.photoURLs[slot.key] ? (
                      <div key={slot.key} style={{ textAlign: 'center' }}>
                        <img src={latestWeekly.photoURLs[slot.key]} alt={slot.label} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8 }} />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{slot.label}</div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Archive / Delete */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>⚙️ Gestion du compte</div>
              <button onClick={toggleArchive} className="btn btn-secondary" style={{ marginBottom: 10 }}>
                {client.archived ? '♻️ Désarchiver le client' : '📦 Archiver le client'}
              </button>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="btn btn-danger">🗑️ Supprimer définitivement</button>
              ) : (
                <div style={{ background: 'var(--danger-light)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>⚠️ Cette action est irréversible. Toutes les données seront perdues.</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleDelete} className="btn btn-danger" style={{ flex: 1 }}>Confirmer</button>
                    <button onClick={() => setConfirmDelete(false)} className="btn btn-secondary" style={{ flex: 1 }}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* JOURNAL */}
        {activeTab === 'journal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...entries].reverse().map(e => (
              <div key={e.date} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>{format(new Date(e.date), 'EEEE d MMM', { locale: fr })}</span>
                  {e.weight && <span className="badge badge-primary">{e.weight} kg</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔥 {e.calories || 0} kcal</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👟 {(e.steps || 0).toLocaleString()}</span>
                  {e.didProgramSession !== null && e.didProgramSession !== undefined && (
                    <span style={{ fontSize: 12, color: e.didProgramSession ? 'var(--success)' : 'var(--danger)' }}>
                      {e.didProgramSession ? '✅ Séance' : '❌ Séance'}
                    </span>
                  )}
                  {e.extraActivity && <span style={{ fontSize: 12, color: 'var(--primary)' }}>🏃 +{e.extraActivityCal} kcal</span>}
                </div>
                {e.notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>"{e.notes}"</p>}
              </div>
            ))}
          </div>
        )}

        {/* BILANS */}
        {activeTab === 'bilans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...weeklyEntries].reverse().map(w => (
              <div key={w.weekStart} className="card">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                  Semaine du {format(new Date(w.weekStart), 'd MMM', { locale: fr })}
                  {w.avgWeight && <span className="badge badge-primary" style={{ marginLeft: 8 }}>{w.avgWeight} kg</span>}
                </div>
                {w.questionnaire && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {Object.entries(w.questionnaire).filter(([,v]) => v).map(([k,v]) => (
                      <span key={k} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: v >= 4 ? 'var(--success-light)' : v <= 2 ? 'var(--danger-light)' : 'var(--warning-light)', color: v >= 4 ? 'var(--success)' : v <= 2 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                        {k === 'energy' ? '⚡' : k === 'hunger' ? '🍽️' : k === 'motivation' ? '💪' : k === 'stress' ? '🧘' : '🎯'} {v}/5
                      </span>
                    ))}
                  </div>
                )}
                {w.photoURLs && Object.values(w.photoURLs).some(u => u) && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {[{key:'face'},{key:'profile'},{key:'back'}].map(slot =>
                      w.photoURLs[slot.key] ? <img key={slot.key} src={w.photoURLs[slot.key]} alt={slot.key} style={{ width: '30%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 6 }} /> : null
                    )}
                  </div>
                )}
                {w.weekHighlight && <div style={{ fontSize: 12, color: 'var(--success)', marginBottom: 3 }}>✨ {w.weekHighlight}</div>}
                {w.weekDifficulty && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 3 }}>⚠️ {w.weekDifficulty}</div>}
                {w.weekNotes && <div style={{ fontSize: 12, color: 'var(--primary)' }}>💬 {w.weekNotes}</div>}
              </div>
            ))}
          </div>
        )}

        {/* TARGETS */}
        {activeTab === 'targets' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editTargets ? 20 : 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🎯 Objectifs</div>
              <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditTargets(!editTargets)}>
                {editTargets ? 'Annuler' : 'Modifier'}
              </button>
            </div>
            {!editTargets ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: '🔥 Calories', value: `${targets.calories || '—'} kcal` },
                  { label: '🥩 Protéines', value: `${targets.protein || '—'} g` },
                  { label: '🌾 Glucides', value: `${targets.carbs || '—'} g` },
                  { label: '🥑 Lipides', value: `${targets.fat || '—'} g` },
                  { label: '👟 Pas', value: (targets.steps || 10000).toLocaleString() },
                  { label: '😴 Sommeil', value: `${targets.sleep || 8} h` },
                  { label: '🏋️ Séances/sem', value: targets.sessionsPerWeek || 3 },
                  { label: '⚡ kcal/1000 pas', value: `${targets.kcalPer1000Steps || 20} kcal` },
                  { label: '📉 Déficit séance', value: `${targets.sessionCalorieDeficit || 300} kcal` },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontWeight: 700 }}>{r.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { key: 'calories', label: '🔥 Calories' },
                    { key: 'protein', label: '🥩 Protéines (g)' },
                    { key: 'carbs', label: '🌾 Glucides (g)' },
                    { key: 'fat', label: '🥑 Lipides (g)' },
                    { key: 'steps', label: '👟 Pas/jour' },
                    { key: 'sleep', label: '😴 Sommeil (h)' },
                    { key: 'sessionsPerWeek', label: '🏋️ Séances/sem' },
                    { key: 'kcalPer1000Steps', label: '⚡ kcal/1000 pas' },
                    { key: 'sessionCalorieDeficit', label: '📉 Déficit séance' },
                  ].map(f => (
                    <div key={f.key} className="input-group">
                      <label className="input-label" style={{ fontSize: 11 }}>{f.label}</label>
                      <input className="input" type="number" value={targets[f.key] || ''} onChange={e => setT(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={saveTargets} disabled={saving}>
                  {saving ? 'Enregistrement...' : '✅ Enregistrer'}
                </button>
                <button className="btn btn-secondary" onClick={resetWeekBalance} style={{ marginTop: 4 }}>
                  🔄 Remettre la balance semaine à zéro
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
