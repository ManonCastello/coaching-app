// src/pages/CoachClientDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { format, startOfWeek, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { calculateBMR, calculateTDEE, calculateAgeFromDOB, FORMULES, WEEK_DAYS } from '../utils/calculations';
import PhotoViewer from '../components/PhotoViewer';

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
  const [photoViewer, setPhotoViewer] = useState(null); // { photoURLs, slot }
  const [editInfo, setEditInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({});
  function setI(key, val) { setInfoForm(p => ({ ...p, [key]: val })); }
  // Données de départ
  const [editStartData, setEditStartData] = useState(false);
  const [startForm, setStartForm] = useState({ weight: '', waist: '', hips: '', glutes: '', thighs: '', arms: '' });
  const [startPhotos, setStartPhotos] = useState({ face: null, profile: null, back: null });
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const fileRefs = { face: React.useRef(), profile: React.useRef(), back: React.useRef() };
  // Rappel + bilan day
  const [editReminder, setEditReminder] = useState(false);
  const [editBilanDay, setEditBilanDay] = useState(false);
  const [reminderHour, setReminderHour] = useState('20');
  const [reminderMin, setReminderMin] = useState('00');
  const [bilanDay, setBilanDay] = useState(1);
  const [weekGoals, setWeekGoals] = useState(null);
  const [clientConsultation, setClientConsultation] = useState(null);
  const [savingGoals, setSavingGoals] = useState(false);
  const [mealSplit, setMealSplit] = useState({ morning: 25, lunch: 35, dinner: 30, snack: 0 });
  const [hasSnack, setHasSnack] = useState(false);
  const [savingMealSplit, setSavingMealSplit] = useState(false);
  const [customFoods, setCustomFoods] = useState({ protein: [], carbs: [], fat: [] });
  const [newFood, setNewFood] = useState({ macro: 'protein', name: '', unit: 'g', gramsPerUnit: 100, protPer100g: '', carbsPer100g: '', fatPer100g: '', visual: '', emoji: '🍽️' });
  const [showAddFood, setShowAddFood] = useState(false);
  const [goalsForm, setGoalsForm] = useState({
    protein: { active: false, includeSnack: false },
    vegetables: { active: false },
    fruits: { active: false },
    junkfood: { active: false, maxCalories: 300 },
  });


  function setT(key, val) { setTargets(p => ({ ...p, [key]: val })); }

  useEffect(() => {
    async function load() {
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (clientDoc.exists()) {
        const data = clientDoc.data();
        setClient(data);
        setTargets(data.targets || {});
        setInfoForm({ firstName: data.firstName, lastName: data.lastName, dob: data.dob || '', profession: data.profession || '', weight: data.weight, height: data.height, sex: data.sex, activityLevel: data.activityLevel, goal: data.goal });
        setMealSplit(data.mealSplit || { morning: 25, lunch: 35, dinner: 30, snack: 0 });
        setHasSnack(!!(data.mealSplit?.snack > 0));
        setCustomFoods(data.customFoods || { protein: [], carbs: [], fat: [] });
        setStartForm({ weight: data.startWeight || data.weight || '', waist: data.startMeasurements?.waist || '', hips: data.startMeasurements?.hips || '', glutes: data.startMeasurements?.glutes || '', thighs: data.startMeasurements?.thighs || '', arms: data.startMeasurements?.arms || '' });
        setStartPhotos(data.startPhotos || { face: null, profile: null, back: null });
        const [h, m] = (data.reminderTime || '20:00').split(':');
        setReminderHour(h); setReminderMin(m);
        setBilanDay(data.weeklyBilanDay ?? 1);
      }
      const dailyQ = query(collection(db, 'clients', clientId, 'dailyEntries'), orderBy('date', 'desc'), limit(30));
      const dailySnap = await getDocs(dailyQ);
      setEntries(dailySnap.docs.map(d => d.data()).reverse());
      const weeklyQ = query(collection(db, 'clients', clientId, 'weeklyEntries'), orderBy('weekStart', 'desc'), limit(12));
      const weeklySnap = await getDocs(weeklyQ);
      setWeeklyEntries(weeklySnap.docs.map(d => d.data()).reverse());
      // Charger objectifs hebdo
      const wgQ = query(collection(db, 'clients', clientId, 'weekGoals'), orderBy('weekStart', 'desc'), limit(1));
      const wgSnap = await getDocs(wgQ);
      if (!wgSnap.empty) {
        const wgData = wgSnap.docs[0].data();
        setWeekGoals(wgData);
        // Pré-remplir le formulaire avec les derniers objectifs
        const gf = {};
        (wgData.goals || []).forEach(g => { gf[g.key] = { ...g }; });
        if (Object.keys(gf).length) setGoalsForm(prev => ({ ...prev, ...gf }));
      }
      // Charger la consultation attachée à ce client
      const { collection: colC, query: qC, where: whereC, getDocs: gdC, limit: limC } = await import('firebase/firestore');
      const consultQ = qC(colC(db, 'consultations'), whereC('attachedClientId', '==', clientId), limC(1));
      const consultSnap = await gdC(consultQ);
      if (!consultSnap.empty) setClientConsultation(consultSnap.docs[0].data());

      setLoading(false);
    }
    load();
  }, [clientId]);

  async function saveTargets() {
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const newTargets = {
        calories: +targets.calories || 0,
        protein: +targets.protein || 0,
        fat: +targets.fat || 0,
        carbs: +targets.carbs || 0,
        steps: +targets.steps || 10000,
        sleep: +targets.sleep || 8,
        sessionsPerWeek: +targets.sessionsPerWeek || 3,
        kcalPer1000Steps: +targets.kcalPer1000Steps || 20,
        sessionCalorieDeficit: +targets.sessionCalorieDeficit || 300,
      };
      // Save current targets
      await updateDoc(doc(db, 'clients', clientId), { targets: newTargets });
      // Save to history with today as validFrom
      const { setDoc, serverTimestamp } = await import('firebase/firestore');
      await setDoc(doc(db, 'clients', clientId, 'targetsHistory', today), {
        ...newTargets,
        validFrom: today,
        updatedAt: serverTimestamp(),
      });
      setClient(p => ({ ...p, targets: newTargets }));
      setEditTargets(false); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) { console.error(e); }
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

  async function uploadStartPhoto(file, slot) {
    const CLOUD = 'dduaqnygn'; const PRESET = 'fitlog_photos';
    const ln = (client?.lastName || 'client').toLowerCase().replace(/\s/g, '_');
    const fn = (client?.firstName || '').toLowerCase().replace(/\s/g, '_');
    const publicId = `fitlog/start/${fn}_${ln}_start_${slot}`;
    const formData = new FormData();
    formData.append('file', file); formData.append('upload_preset', PRESET); formData.append('public_id', publicId);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.secure_url) return data.secure_url;
    throw new Error('Upload failed');
  }

  async function handleStartPhotoSelect(slot, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setStartPhotos(p => ({ ...p, [slot]: e.target.result }));
    reader.readAsDataURL(file);
    setUploadingSlot(slot);
    try { const url = await uploadStartPhoto(file, slot); setStartPhotos(p => ({ ...p, [slot]: url })); }
    catch (e) { console.error(e); }
    setUploadingSlot(null);
  }

  async function saveStartData() {
    const startMeasurements = {
      waist: startForm.waist ? +startForm.waist : null,
      hips: startForm.hips ? +startForm.hips : null,
      glutes: startForm.glutes ? +startForm.glutes : null,
      thighs: startForm.thighs ? +startForm.thighs : null,
      arms: startForm.arms ? +startForm.arms : null,
    };
    await updateDoc(doc(db, 'clients', clientId), { startWeight: startForm.weight ? +startForm.weight : null, startMeasurements, startPhotos });
    setClient(p => ({ ...p, startWeight: +startForm.weight, startMeasurements, startPhotos }));
    setEditStartData(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveMealSplit() {
    setSavingMealSplit(true);
    const split = { ...mealSplit, snack: hasSnack ? (mealSplit.snack || 10) : 0 };
    // Normaliser pour que le total = 100
    const total = Object.values(split).reduce((a, b) => a + b, 0);
    await updateDoc(doc(db, 'clients', clientId), { mealSplit: split, hasSnack });
    setClient(p => ({ ...p, mealSplit: split, hasSnack }));
    setSavingMealSplit(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveCustomFood() {
    const macro = newFood.macro;
    const food = { ...newFood };
    delete food.macro;
    const updated = { ...customFoods, [macro]: [...(customFoods[macro] || []), food] };
    setCustomFoods(updated);
    await updateDoc(doc(db, 'clients', clientId), { customFoods: updated });
    setNewFood({ macro: 'protein', name: '', unit: 'g', gramsPerUnit: 100, protPer100g: '', carbsPer100g: '', fatPer100g: '', visual: '', emoji: '🍽️' });
    setShowAddFood(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveWeekGoals() {
    setSavingGoals(true);
    const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const goals = Object.entries(goalsForm).map(([key, val]) => ({ key, ...val }));
    await setDoc(doc(db, 'clients', clientId, 'weekGoals', weekKey), {
      weekStart: weekKey,
      goals,
      updatedAt: serverTimestamp(),
    });
    setWeekGoals({ weekStart: weekKey, goals });
    setSavingGoals(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveCoachingMode(mode) {
    await updateDoc(doc(db, 'clients', clientId), { coachingMode: mode });
    setClient(p => ({ ...p, coachingMode: mode }));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveReminder() {
    await updateDoc(doc(db, 'clients', clientId), { reminderTime: `${reminderHour}:${reminderMin}` });
    setClient(p => ({ ...p, reminderTime: `${reminderHour}:${reminderMin}` }));
    setEditReminder(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveBilanDay() {
    await updateDoc(doc(db, 'clients', clientId), { weeklyBilanDay: +bilanDay });
    setClient(p => ({ ...p, weeklyBilanDay: +bilanDay }));
    setEditBilanDay(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
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
  // Séances : compter uniquement lundi-dimanche de la semaine en cours
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const currentWeekEnd = format(new Date(), 'yyyy-MM-dd');
  const thisWeekEntries = entries.filter(e => e.date >= currentWeekStart && e.date <= currentWeekEnd);
  const sessionsDone = thisWeekEntries.filter(e => e.didProgramSession === true).length;
  const sessionsTarget = client.targets?.sessionsPerWeek || 3;

  const tabs = [
    { key: 'overview', label: '📊 Vue' },
    { key: 'journal', label: '📋 Journal' },
    { key: 'bilans', label: '📅 Bilans' },
    { key: 'targets', label: '🎯 Objectifs' },
    { key: 'consultation', label: '📋' },
  ];

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/coach" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title" style={{ fontSize: 15 }}>{client.firstName} {(client.lastName || '').toUpperCase()}</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="hero-banner" style={{ margin: '0 20px 0', borderRadius: '0 0 var(--radius) var(--radius)' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {client.firstName?.[0]}{client.lastName?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: 0 }}>{client.firstName} {(client.lastName || '').toUpperCase()}</h2>
            <p style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{client.profession} · {age ? `${age} ans` : ''} · {client.sex === 'F' ? 'Femme' : 'Homme'}</p>
            <p style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>BMR {bmr || '—'} · TDEE {tdee || '—'} kcal</p>
          </div>
          {/* Formule selector + mode badge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {FORMULES.map(f => (
              <button key={f.value} onClick={() => saveFormule(f.value)} style={{
                padding: '4px 10px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: client.formule === f.value ? 'white' : 'rgba(255,255,255,0.2)',
                color: client.formule === f.value ? 'var(--primary)' : 'white',
                fontFamily: 'var(--font-body)'
              }}>{f.label}</button>
            ))}
            <div style={{
              padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, textAlign: 'center',
              background: 'rgba(255,255,255,0.15)', color: 'white',
            }}>
              {(client.coachingMode || 'tracking') === 'intuitif' ? '🎯 Intuitif' : '📊 Tracking'}
            </div>
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
              <div className="stat-card"><div className="stat-label">Séances sem.</div><div className="stat-value">{sessionsDone}<span className="stat-unit">/ {sessionsTarget}</span></div></div>
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


            {/* Week balance reset */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>⚖️ Balance calorique semaine</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Remet la balance de la semaine en cours à zéro pour ce client.
              </p>
              <button onClick={resetWeekBalance} className="btn btn-secondary">
                🔄 Remettre la balance à zéro
              </button>
            </div>


            {/* Données de départ */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editStartData ? 16 : 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📐 Mesures de départ</div>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditStartData(!editStartData)}>
                  {editStartData ? 'Annuler' : client.startMeasurements ? 'Modifier' : '+ Ajouter'}
                </button>
              </div>
              {!editStartData && (
                <>
                  {/* Progression poids */}
                  {client.startWeight && (() => {
                    const currentW = lastWeight || null;
                    const deltaW = currentW ? +(currentW - client.startWeight).toFixed(1) : null;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ fontSize: 13 }}>⚖️ Poids départ</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{client.startWeight} kg</span>
                          {deltaW !== null && <span style={{ fontWeight: 800, fontSize: 13, color: deltaW < 0 ? 'var(--success)' : deltaW > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{deltaW > 0 ? '+' : ''}{deltaW} kg</span>}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Progression mensurations */}
                  {client.startMeasurements && [
                    { key: 'waist', label: 'Taille', emoji: '👗' },
                    { key: 'hips', label: 'Hanches', emoji: '🔵' },
                    { key: 'glutes', label: 'Fesses', emoji: '🍑' },
                    { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
                    { key: 'arms', label: 'Bras', emoji: '💪' },
                  ].map(m => {
                    const startVal = client.startMeasurements[m.key];
                    const currentVal = latestWeekly?.measurements?.[m.key];
                    if (!startVal) return null;
                    const delta = currentVal ? +(currentVal - startVal).toFixed(1) : null;
                    return (
                      <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ fontSize: 13 }}>{m.emoji} {m.label}</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{startVal} cm</span>
                          {delta !== null ? (
                            <span style={{ fontWeight: 800, fontSize: 13, color: delta < 0 ? 'var(--success)' : delta > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{delta > 0 ? '+' : ''}{delta} cm</span>
                          ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>pas encore de bilan</span>}
                        </div>
                      </div>
                    );
                  })}
                  {/* Photos de départ */}
                  {client.startPhotos && (client.startPhotos.face || client.startPhotos.profile || client.startPhotos.back) && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>📸 Photos de départ</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {[{key:'face',label:'Face'},{key:'profile',label:'Profil'},{key:'back',label:'Dos'}].map(slot =>
                          client.startPhotos[slot.key] ? (
                            <div key={slot.key}>
                              <img src={client.startPhotos[slot.key]} alt={slot.label} onClick={() => setPhotoViewer({ photoURLs: client.startPhotos, slot: slot.key })} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} />
                              <p style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-muted)', marginTop: 4 }}>{slot.label}</p>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                  {!client.startMeasurements && !client.startWeight && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>Aucune mesure de départ enregistrée</p>
                  )}
                </>
              )}
              {editStartData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">⚖️ Poids de départ (kg)</label>
                    <input className="input" type="number" value={startForm.weight} onChange={e => setStartForm(p => ({ ...p, weight: e.target.value }))} step="0.1" placeholder="ex: 65" />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>📏 Mensurations de départ (cm)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[{key:'waist',label:'Taille',emoji:'👗'},{key:'hips',label:'Hanches',emoji:'🔵'},{key:'glutes',label:'Fesses',emoji:'🍑'},{key:'thighs',label:'Cuisses',emoji:'🦵'},{key:'arms',label:'Bras',emoji:'💪'}].map(m => (
                      <div key={m.key} className="input-group">
                        <label className="input-label">{m.emoji} {m.label}</label>
                        <input className="input" type="number" value={startForm[m.key]} onChange={e => setStartForm(p => ({ ...p, [m.key]: e.target.value }))} placeholder="cm" step="0.5" />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>📸 Photos de départ</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[{key:'face',label:'Face'},{key:'profile',label:'Profil'},{key:'back',label:'Dos'}].map(slot => (
                      <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div onClick={() => !uploadingSlot && fileRefs[slot.key].current.click()} style={{ width: '100%', aspectRatio: '3/4', borderRadius: 8, border: `2px dashed ${startPhotos[slot.key] ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: 'var(--bg)' }}>
                          {uploadingSlot === slot.key ? <div className="spinner" style={{ width: 24, height: 24 }} />
                           : startPhotos[slot.key] ? <img src={startPhotos[slot.key]} alt={slot.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                           : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, color: 'var(--text-light)' }}>+</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{slot.label}</div></div>}
                        </div>
                        <input ref={fileRefs[slot.key]} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleStartPhotoSelect(slot.key, e.target.files[0])} />
                        <span style={{ fontSize: 11, color: startPhotos[slot.key] ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>{startPhotos[slot.key] ? '✅ ' : ''}{slot.label}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={saveStartData} disabled={!!uploadingSlot}>
                    {uploadingSlot ? 'Upload...' : '✅ Enregistrer les mesures'}
                  </button>
                </div>
              )}
            </div>

            {/* Rappel + Bilan day */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>⚙️ Paramètres client</div>
              {/* Rappel */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editReminder ? 12 : 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>🔔 Rappel quotidien</div>
                  {!editReminder && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{client.reminderTime || '20:00'}</p>}
                </div>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditReminder(!editReminder)}>{editReminder ? 'Annuler' : 'Modifier'}</button>
              </div>
              {editReminder && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                    <div className="input-group"><label className="input-label">Heure</label><input className="input" type="number" value={reminderHour} onChange={e => setReminderHour(e.target.value.padStart(2,'0'))} min="0" max="23" /></div>
                    <div className="input-group"><label className="input-label">Minutes</label><input className="input" type="number" value={reminderMin} onChange={e => setReminderMin(e.target.value.padStart(2,'0'))} min="0" max="59" /></div>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={saveReminder}>Enregistrer</button>
                </div>
              )}
              {/* Bilan day */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 10, marginBottom: editBilanDay ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>📅 Jour du bilan hebdo</div>
                  {!editBilanDay && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{WEEK_DAYS.find(d => d.value === (client.weeklyBilanDay ?? 1))?.label || 'Lundi'}</p>}
                </div>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditBilanDay(!editBilanDay)}>{editBilanDay ? 'Annuler' : 'Modifier'}</button>
              </div>
              {editBilanDay && (
                <div style={{ marginTop: 8 }}>
                  <select className="input" value={bilanDay} onChange={e => setBilanDay(+e.target.value)} style={{ marginBottom: 10 }}>
                    {WEEK_DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={saveBilanDay}>Enregistrer</button>
                </div>
              )}
            </div>

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
              <div key={e.date} className="card" style={{ padding: '12px 14px', border: e.locked ? '1.5px solid #22C55E' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>{format(new Date(e.date), 'EEEE d MMM', { locale: fr })}</span>
                    {e.locked && <span style={{ fontSize: 10, background: '#F0FDF4', color: '#16A34A', padding: '1px 6px', borderRadius: 100, fontWeight: 700 }}>🔒 Validée</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {e.menstruation && <span title="Règles">🩸</span>}
                    {e.weight && <span className="badge badge-primary">{e.weight} kg</span>}
                    {/* Bouton lock/unlock coach */}
                    <button
                      onClick={async () => {
                        const { doc: d, setDoc: sd, serverTimestamp: st } = await import('firebase/firestore');
                        if (e.locked) {
                          await sd(d(db, 'clients', clientId, 'dailyEntries', e.date), { locked: false }, { merge: true });
                        } else {
                          const t = client.targets || {};
                          const stepBonus = Math.round(((e.steps || 0) - (t.steps || 10000)) / 1000 * (t.kcalPer1000Steps || 20));
                          const sessionDef = e.didProgramSession === false ? -(t.sessionCalorieDeficit || 300) : 0;
                          const extraCal = e.extraActivityCal || 0;
                          const dailyTarget = (t.calories || 2000) + stepBonus + extraCal + sessionDef;
                          const dailyBalance = e.calories > 0 ? e.calories - dailyTarget : null;
                          await sd(d(db, 'clients', clientId, 'dailyEntries', e.date), { locked: true, dailyTarget, dailyBalance, lockedAt: st() }, { merge: true });
                        }
                        // Recharger les entrées
                        window.location.reload();
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                      title={e.locked ? 'Déverrouiller' : 'Valider la journée'}
                    >
                      {e.locked ? '🔓' : '🔒'}
                    </button>
                  </div>
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
                  {e.dailyBalance !== null && e.dailyBalance !== undefined && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: e.dailyBalance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      Balance: {e.dailyBalance > 0 ? '+' : ''}{e.dailyBalance} kcal
                    </span>
                  )}
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
                      w.photoURLs[slot.key] ? <img key={slot.key} src={w.photoURLs[slot.key]} alt={slot.key} onClick={() => setPhotoViewer({ photoURLs: w.photoURLs, slot: slot.key })} style={{ width: '30%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }} /> : null
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Mode de coaching */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📱 Mode de suivi</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { value: 'tracking', label: '📊 Avec comptage', desc: 'Calories + macros via MyFitnessPal' },
                  { value: 'intuitif', label: '🎯 Sans comptage', desc: 'Objectifs par repas, sans compter les calories' },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => saveCoachingMode(opt.value)} style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-sm)', textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${client.coachingMode === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                    background: client.coachingMode === opt.value ? 'var(--primary-bg)' : 'white',
                    fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                  }}>
                    <div style={{ fontWeight: 700, color: client.coachingMode === opt.value ? 'var(--primary)' : 'var(--text)', fontSize: 13 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Objectifs calories/macros (mode tracking) */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editTargets ? 20 : 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>🔢 Objectifs calories & macros</div>
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
                  <button className="btn btn-secondary" onClick={resetWeekBalance}>
                    🔄 Remettre la balance semaine à zéro
                  </button>
                </div>
              )}
            </div>

            {/* Objectifs hebdo intuitifs */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🎯 Objectifs hebdo (mode sans comptage)</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Active les objectifs de cette semaine. Ils s'affichent dans le suivi quotidien du client sous forme de cases à cocher par repas.
              </p>

              {/* Protéines */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: goalsForm.protein.active ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🥩</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Protéines ≥ 30g à chaque repas</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Matin, midi, soir</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setGoalsForm(p => ({ ...p, protein: { ...p.protein, active: !p.protein.active } }))} style={{
                    padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: goalsForm.protein.active ? 'var(--primary)' : 'var(--border-light)',
                    color: goalsForm.protein.active ? 'white' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)',
                  }}>{goalsForm.protein.active ? '✅ Actif' : 'Inactif'}</button>
                </div>
                {goalsForm.protein.active && (
                  <button type="button" onClick={() => setGoalsForm(p => ({ ...p, protein: { ...p.protein, includeSnack: !p.protein.includeSnack } }))} style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${goalsForm.protein.includeSnack ? 'var(--primary)' : 'var(--border)'}`,
                    background: goalsForm.protein.includeSnack ? 'var(--primary-bg)' : 'white', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: goalsForm.protein.includeSnack ? 'var(--primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)',
                  }}>
                    {goalsForm.protein.includeSnack ? '✅' : '○'} Inclure collation ≥ 15g
                  </button>
                )}
              </div>

              {/* Légumes */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🥦</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Légumes ≥ 250g par repas</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Midi et soir</div>
                  </div>
                </div>
                <button type="button" onClick={() => setGoalsForm(p => ({ ...p, vegetables: { ...p.vegetables, active: !p.vegetables.active } }))} style={{
                  padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: goalsForm.vegetables.active ? 'var(--primary)' : 'var(--border-light)',
                  color: goalsForm.vegetables.active ? 'white' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}>{goalsForm.vegetables.active ? '✅ Actif' : 'Inactif'}</button>
              </div>

              {/* Fruits */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🍎</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>2 fruits minimum / jour</div>
                  </div>
                </div>
                <button type="button" onClick={() => setGoalsForm(p => ({ ...p, fruits: { ...p.fruits, active: !p.fruits.active } }))} style={{
                  padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: goalsForm.fruits.active ? 'var(--primary)' : 'var(--border-light)',
                  color: goalsForm.fruits.active ? 'white' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}>{goalsForm.fruits.active ? '✅ Actif' : 'Inactif'}</button>
              </div>

              {/* Malbouffe */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: goalsForm.junkfood.active ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🍕</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Limite malbouffe</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Le client entre ses calories malbouffe</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setGoalsForm(p => ({ ...p, junkfood: { ...p.junkfood, active: !p.junkfood.active } }))} style={{
                    padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: goalsForm.junkfood.active ? 'var(--primary)' : 'var(--border-light)',
                    color: goalsForm.junkfood.active ? 'white' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)',
                  }}>{goalsForm.junkfood.active ? '✅ Actif' : 'Inactif'}</button>
                </div>
                {goalsForm.junkfood.active && (
                  <div className="input-group">
                    <label className="input-label">Limite max (kcal/jour)</label>
                    <input className="input" type="number" value={goalsForm.junkfood.maxCalories} onChange={e => setGoalsForm(p => ({ ...p, junkfood: { ...p.junkfood, maxCalories: +e.target.value } }))} placeholder="Ex: 300" />
                  </div>
                )}
              </div>

              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveWeekGoals} disabled={savingGoals}>
                {savingGoals ? 'Enregistrement...' : '✅ Appliquer pour cette semaine'}
              </button>
            </div>

            {/* Découpage repas & aliments personnalisés */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🍽️ Fiches repas — Découpage calorique</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Définis le % de calories par repas. Total actuel : {Object.values(mealSplit).reduce((a,b)=>a+b,0) + (hasSnack ? 0 : 0)}%.
              </p>

              {[
                { key: 'morning', label: 'Petit-déjeuner 🌅' },
                { key: 'lunch', label: 'Déjeuner ☀️' },
                { key: 'dinner', label: 'Dîner 🌙' },
              ].map(m => (
                <div key={m.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{mealSplit[m.key]}%</span>
                  </div>
                  <input type="range" min="0" max="60" value={mealSplit[m.key]}
                    onChange={e => setMealSplit(p => ({ ...p, [m.key]: +e.target.value }))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    ≈ {Math.round((client.targets?.calories || 2000) * mealSplit[m.key] / 100)} kcal · {Math.round((client.targets?.protein || 130) * mealSplit[m.key] / 100)}g prot · {Math.round((client.targets?.carbs || 150) * mealSplit[m.key] / 100)}g gluc · {Math.round((client.targets?.fat || 55) * mealSplit[m.key] / 100)}g lip
                  </div>
                </div>
              ))}

              {/* Collation */}
              <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-light)', marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasSnack ? 10 : 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Collation 🍱</label>
                  <button type="button" onClick={() => setHasSnack(!hasSnack)} style={{
                    padding: '5px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: hasSnack ? 'var(--primary)' : 'var(--border-light)',
                    color: hasSnack ? 'white' : 'var(--text-muted)', fontFamily: 'var(--font-body)',
                  }}>{hasSnack ? '✅ Incluse' : 'Non incluse'}</button>
                </div>
                {hasSnack && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>% calories</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{mealSplit.snack || 10}%</span>
                    </div>
                    <input type="range" min="5" max="25" value={mealSplit.snack || 10}
                      onChange={e => setMealSplit(p => ({ ...p, snack: +e.target.value }))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ≈ {Math.round((client.targets?.calories || 2000) * (mealSplit.snack || 10) / 100)} kcal
                    </div>
                  </div>
                )}
              </div>

              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveMealSplit} disabled={savingMealSplit}>
                {savingMealSplit ? 'Enregistrement...' : '✅ Enregistrer le découpage'}
              </button>
            </div>

            {/* Aliments personnalisés */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>➕ Aliments personnalisés</div>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setShowAddFood(!showAddFood)}>
                  {showAddFood ? 'Annuler' : '+ Ajouter'}
                </button>
              </div>

              {/* Liste des aliments custom */}
              {Object.entries(customFoods).map(([macro, foods]) =>
                foods.length > 0 ? (
                  <div key={macro} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                      {macro === 'protein' ? '🥩 Protéines' : macro === 'carbs' ? '🍚 Glucides' : '🥑 Lipides'}
                    </div>
                    {foods.map((f, i) => (
                      <div key={i} style={{ fontSize: 13, padding: '4px 8px', background: 'var(--bg)', borderRadius: 6, marginBottom: 4 }}>
                        {f.emoji} {f.name} — {f.visual}
                      </div>
                    ))}
                  </div>
                ) : null
              )}
              {Object.values(customFoods).every(arr => arr.length === 0) && !showAddFood && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun aliment personnalisé pour ce client.</p>
              )}

              {showAddFood && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, padding: 14, background: 'var(--bg)', borderRadius: 10 }}>
                  <div className="input-group">
                    <label className="input-label">Macro</label>
                    <select className="input" value={newFood.macro} onChange={e => setNewFood(p => ({ ...p, macro: e.target.value }))}>
                      <option value="protein">🥩 Protéines</option>
                      <option value="carbs">🍚 Glucides</option>
                      <option value="fat">🥑 Lipides</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="input-group">
                      <label className="input-label">Nom</label>
                      <input className="input" value={newFood.name} onChange={e => setNewFood(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Cottage cheese" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Emoji</label>
                      <input className="input" value={newFood.emoji} onChange={e => setNewFood(p => ({ ...p, emoji: e.target.value }))} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Unité</label>
                      <select className="input" value={newFood.unit} onChange={e => setNewFood(p => ({ ...p, unit: e.target.value }))}>
                        <option value="g">g</option>
                        <option value="c.s.">c.s.</option>
                        <option value="c.à.c">c.à.c</option>
                        <option value="unité">unité</option>
                        <option value="tranche">tranche</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">g par unité</label>
                      <input className="input" type="number" value={newFood.gramsPerUnit} onChange={e => setNewFood(p => ({ ...p, gramsPerUnit: +e.target.value }))} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">
                        {newFood.macro === 'protein' ? 'Prot/100g' : newFood.macro === 'carbs' ? 'Gluc/100g' : 'Lip/100g'}
                      </label>
                      <input className="input" type="number" value={newFood.macro === 'protein' ? newFood.protPer100g : newFood.macro === 'carbs' ? newFood.carbsPer100g : newFood.fatPer100g}
                        onChange={e => setNewFood(p => ({ ...p, [`${newFood.macro === 'protein' ? 'prot' : newFood.macro === 'carbs' ? 'carbs' : 'fat'}Per100g`]: +e.target.value }))}
                        placeholder="g" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Repère visuel</label>
                    <input className="input" value={newFood.visual} onChange={e => setNewFood(p => ({ ...p, visual: e.target.value }))} placeholder="Ex: 1 pot = 150g" />
                  </div>
                  <button className="btn btn-primary" onClick={saveCustomFood} disabled={!newFood.name}>
                    ✅ Ajouter cet aliment
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      {/* CONSULTATION */}
        {activeTab === 'consultation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {clientConsultation ? (
              <>
                <div className="card" style={{ background: 'var(--primary-bg)', border: '1.5px solid var(--primary-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>📋 Consultation du {clientConsultation.date}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {clientConsultation.finalized ? '✅ Finalisée' : '⏳ En cours'}
                        {clientConsultation.offerChosen && ` · ${clientConsultation.offerChosen === 'platinum' ? '💎 Platinum' : clientConsultation.offerChosen === 'gold' ? '🥇 Gold' : clientConsultation.offerChosen === 'thinking' ? '🤔 Réflexion' : '❌ Non'}`}
                      </div>
                    </div>
                    <a href={`/coach/consultation/${clientConsultation.id}`} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Modifier →</a>
                  </div>
                </div>

                {[
                  { label: '🎯 Objectif profond', value: clientConsultation.whyNow },
                  { label: '📏 Objectif chiffré', value: clientConsultation.goalMeasurable },
                  { label: '⭐ Dans 6 mois', value: clientConsultation.in6months },
                  { label: '💪 Prête à changer', value: clientConsultation.readyToChange },
                  { label: '🏋️ Sport', value: clientConsultation.sportType ? `${clientConsultation.sportType} · ${clientConsultation.sportFreq}` : null },
                  { label: '📊 Mode suivi', value: clientConsultation.modeDecision },
                  { label: '🥂 Week-end', value: clientConsultation.weekend },
                  { label: '⚠️ Frein n°1', value: clientConsultation.mainBrake },
                  { label: '💡 Forces / leviers', value: clientConsultation.strengths },
                  { label: '📋 Stratégie', value: clientConsultation.strategy },
                  { label: '✅ Prochaine action', value: clientConsultation.nextAction },
                ].filter(item => item.value).map((item, i) => (
                  <div key={i} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6 }}>{item.value}</div>
                  </div>
                ))}

                {/* Journée alimentaire */}
                {(clientConsultation.mealMorning || clientConsultation.mealLunch || clientConsultation.mealDinner) && (
                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🍽️ Journée alimentaire type</div>
                    {[
                      { label: '🌅 Matin', val: clientConsultation.mealMorning, ctx: clientConsultation.mealMorningHunger },
                      { label: '☀️ Midi', val: clientConsultation.mealLunch, ctx: clientConsultation.mealLunchHunger },
                      { label: '🌙 Soir', val: clientConsultation.mealDinner, ctx: clientConsultation.mealDinnerHunger },
                      { label: '🥤 Boissons', val: clientConsultation.drinks, ctx: null },
                    ].filter(m => m.val).map((m, i) => (
                      <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{m.label}</div>
                        <div style={{ fontSize: 13, marginTop: 2 }}>{m.val}</div>
                        {m.ctx && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{m.ctx}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Santé */}
                {clientConsultation.healthNotes && (
                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>🏥 Notes santé</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{clientConsultation.healthNotes}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>Aucune consultation attachée à ce client.</p>
                <a href="/coach/consultation/new" style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--primary)', color: 'white', borderRadius: 100, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                  + Nouvelle consultation
                </a>
              </div>
            )}
          </div>
        )}

      </div>
    {photoViewer && (
      <PhotoViewer
        photoURLs={photoViewer.photoURLs}
        initialSlot={photoViewer.slot}
        onClose={() => setPhotoViewer(null)}
      />
    )}
    </div>
  );
}
