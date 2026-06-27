// src/pages/DailyCheckIn.js - v2
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { format, subDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import TabBar from '../components/TabBar';
import { getTargetsForDate } from '../utils/getTargetsForDate';
import CoachToggle from '../components/CoachToggle';

const MEALS = [
  { key: 'morning', label: 'Matin', emoji: '🌅' },
  { key: 'lunch', label: 'Midi', emoji: '☀️' },
  { key: 'dinner', label: 'Soir', emoji: '🌙' },
];

const GOAL_TYPES = [
  { key: 'protein', label: 'Protéines ≥ 30g', desc: 'Au moins 30g de protéines', emoji: '🥩', snackLabel: 'Collation ≥ 15g' },
  { key: 'vegetables', label: 'Légumes ≥ 250g', desc: '250 à 300g de légumes', emoji: '🥦', mealsOnly: ['lunch', 'dinner'] },
  { key: 'fruits', label: '2 fruits min.', desc: '2 fruits dans la journée', emoji: '🍎', dayOnly: true },
  { key: 'junkfood', label: 'Malbouffe', desc: 'Calories malbouffe du jour', emoji: '🍕', caloriesOnly: true },
];

export default function DailyCheckIn({ coachMode }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(null);
  const [existing, setExisting] = useState(null);
  const [weekGoals, setWeekGoals] = useState(null); // objectifs coach actifs
  const [dayOffset, setDayOffset] = useState(0);

  const targetDate = format(subDays(new Date(), dayOffset), 'yyyy-MM-dd');
  const dateLabel = format(subDays(new Date(), dayOffset), "EEEE d MMMM", { locale: fr });
  const isToday = dayOffset === 0;

  // Form tracking mode
  const [form, setForm] = useState({
    weight: '', steps: '', calories: '',
    protein: '', carbs: '', fat: '', sleep: '', sleepQuality: '',
    didProgramSession: null,
    extraActivity: '', extraActivityCal: '',
    notes: '', menstruation: false,
  });

  // Form intuitif mode — coches par repas
  const [goalChecks, setGoalChecks] = useState({
    // protein: { morning: false, lunch: false, dinner: false, snack: false }
    // vegetables: { lunch: false, dinner: false }
    // fruits: { done: false }
    // junkfood: { calories: '' }
  });

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }
  function setCheck(goalKey, mealKey, val) {
    setGoalChecks(p => ({ ...p, [goalKey]: { ...(p[goalKey] || {}), [mealKey]: val } }));
  }

  const [weekBalance, setWeekBalance] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      let profileData = null;
      if (profileDoc.exists()) {
        const p = profileDoc.data();
        const historicalTargets = await getTargetsForDate(currentUser.uid, targetDate, p.targets || {});
        profileData = { ...p, targets: historicalTargets };
        setProfile(profileData);
      }

      // Charger les objectifs hebdo actifs
      const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const goalsDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'weekGoals', weekKey));
      if (!goalsDoc.exists()) {
        // Chercher les derniers objectifs actifs
        const goalsQ = query(collection(db, 'clients', currentUser.uid, 'weekGoals'), orderBy('weekStart', 'desc'), limit(1));
        const goalsSnap = await getDocs(goalsQ);
        if (!goalsSnap.empty) setWeekGoals(goalsSnap.docs[0].data());
      } else {
        setWeekGoals(goalsDoc.data());
      }

      const entryDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', targetDate));
      if (entryDoc.exists()) {
        const data = entryDoc.data();
        setExisting(data);
        setForm({
          weight: data.weight || '', steps: data.steps || '',
          calories: data.calories || '', protein: data.protein || '',
          carbs: data.carbs || '', fat: data.fat || '',
          sleep: data.sleep || '', sleepQuality: data.sleepQuality || '',
          didProgramSession: data.didProgramSession ?? null,
          extraActivity: data.extraActivity || '', extraActivityCal: data.extraActivityCal || '',
          notes: data.notes || '', menstruation: data.menstruation || false,
        });
        if (data.goalChecks) setGoalChecks(data.goalChecks);
        setIsLocked(data.locked || false);
      } else {
        setExisting(null);
        setForm({ weight: '', steps: '', calories: '', protein: '', carbs: '', fat: '', sleep: '', sleepQuality: '', didProgramSession: null, extraActivity: '', extraActivityCal: '', notes: '', menstruation: false });
        setGoalChecks({});
      }

      // Balance = dailyBalance du dernier jour verrouillé (contient déjà le cumul)
      if (profileData?.coachingMode !== 'intuitif') {
        const today = format(new Date(), 'yyyy-MM-dd');
        const entriesSnap = await getDocs(query(collection(db, 'clients', currentUser.uid, 'dailyEntries'), orderBy('date', 'desc'), limit(14)));
        const entries = entriesSnap.docs.map(d => d.data()).filter(e => e.date !== today);
        const lastLocked = entries.find(e => e.locked && e.dailyBalance !== null && e.dailyBalance !== undefined);
        setWeekBalance(lastLocked ? Math.round(lastLocked.dailyBalance) : 0);
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid, targetDate]);

  async function handleLock() {
    if (!window.confirm('Valider définitivement cette journée ? Les valeurs seront figées.')) return;
    const t = profile?.targets || {};
    const calories = form.calories ? +form.calories : 0;
    const steps = form.steps ? +form.steps : 0;
    const extraActivityCal = form.extraActivityCal ? +form.extraActivityCal : 0;
    const stepBonus = Math.round(((steps - (t.steps || 10000)) / 1000) * (t.kcalPer1000Steps || 20));
    const sessionDef = form.didProgramSession === false ? -(t.sessionCalorieDeficit || 300) : 0;
    const dailyTarget = (t.calories || 2000) + stepBonus + extraActivityCal + sessionDef;
    const carryOver = weekBalance || 0;
    const dailyBalance = calories > 0 ? (calories - dailyTarget) + carryOver : null;
    await setDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', targetDate), {
      locked: true,
      dailyTarget,
      dailyBalance,
      lockedAt: serverTimestamp(),
    }, { merge: true });
    setIsLocked(true);
  }

  async function handleSave() {
    if (isLocked) {
      alert('Cette journée est validée. Contacte ta coach pour la déverrouiller.');
      return;
    }
    setSaving(true);
    try {
      const t = profile?.targets || {};
      const calories = form.calories ? +form.calories : 0;
      const steps = form.steps ? +form.steps : 0;
      const extraActivityCal = form.extraActivityCal ? +form.extraActivityCal : 0;
      const stepBonus = Math.round(((steps - (t.steps || 10000)) / 1000) * (t.kcalPer1000Steps || 20));
      const sessionDef = form.didProgramSession === false ? -(t.sessionCalorieDeficit || 300) : 0;
      const dailyTarget = (t.calories || 2000) + stepBonus + extraActivityCal + sessionDef;
      const carryOver = weekBalance || 0;
      const dailyBalance = calories > 0 ? (calories - dailyTarget) + carryOver : null;

      await setDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', targetDate), {
        date: targetDate,
        weight: form.weight ? +form.weight : null,
        steps,
        calories,
        protein: form.protein ? +form.protein : 0,
        carbs: form.carbs ? +form.carbs : 0,
        fat: form.fat ? +form.fat : 0,
        sleep: form.sleep ? +form.sleep : null,
        sleepQuality: form.sleepQuality ? +form.sleepQuality : null,
        didProgramSession: form.didProgramSession,
        extraActivity: form.extraActivity,
        extraActivityCal,
        notes: form.notes,
        menstruation: form.menstruation || false,
        goalChecks,
        dailyTarget,
        dailyBalance,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => {
        if (coachMode) navigate('/coach');
        else navigate('/dashboard');
      }, 1200);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  const targets = profile?.targets || {};
  const isIntuitif = profile?.coachingMode === 'intuitif';
  const stepBonus = form.steps ? Math.round(((+form.steps - (targets.steps || 10000)) / 1000) * (targets.kcalPer1000Steps || 20)) : 0;
  const sessionAdj = form.didProgramSession === false ? -(targets.sessionCalorieDeficit || 300) : 0;
  const extraCal = form.extraActivityCal ? +form.extraActivityCal : 0;
  const adjustedTarget = (targets.calories || 2000) + stepBonus + sessionAdj + extraCal;
  const backUrl = coachMode ? '/coach' : '/dashboard';

  // Compter les coches du jour (mode intuitif)
  function countChecks() {
    if (!weekGoals?.goals) return { done: 0, total: 0 };
    let done = 0, total = 0;
    weekGoals.goals.forEach(g => {
      if (!g.active) return;
      if (g.key === 'fruits') { total++; if (goalChecks?.fruits?.done) done++; }
      else if (g.key === 'junkfood') { /* pas une coche */ }
      else if (g.key === 'protein') {
        MEALS.forEach(m => { total++; if (goalChecks?.protein?.[m.key]) done++; });
        if (g.includeSnack) { total++; if (goalChecks?.protein?.snack) done++; }
      }
      else if (g.key === 'vegetables') {
        ['lunch', 'dinner'].forEach(m => { total++; if (goalChecks?.vegetables?.[m]) done++; });
      }
    });
    return { done, total };
  }
  const checks = countChecks();

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to={backUrl} style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setDayOffset(d => d + 1)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>←</button>
          <div style={{ textAlign: 'center' }}>
            <div className="top-nav-title" style={{ fontSize: 14 }}>{isToday ? "Aujourd'hui" : dateLabel}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{format(subDays(new Date(), dayOffset), 'dd/MM/yyyy')}</div>
          </div>
          <button onClick={() => setDayOffset(d => Math.max(0, d - 1))} disabled={isToday} style={{ background: 'none', border: 'none', fontSize: 18, cursor: isToday ? 'default' : 'pointer', color: isToday ? 'var(--border)' : 'var(--text-muted)', padding: '0 4px' }}>→</button>
        </div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">

        {/* Balance calorique — mode tracking uniquement */}
        {!isIntuitif && weekBalance !== null && (
          <div style={{
            background: weekBalance > 0 ? 'var(--warning-light)' : weekBalance < -200 ? 'var(--success-light)' : 'var(--primary-bg)',
            border: `1px solid ${weekBalance > 0 ? 'var(--warning)' : weekBalance < -200 ? 'var(--success)' : 'var(--primary-light)'}`,
            borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Balance calorique semaine</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: weekBalance > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {weekBalance > 0 ? '+' : ''}{weekBalance} kcal
            </span>
          </div>
        )}

        {/* Résumé objectifs du jour — tous modes */}
        {weekGoals?.goals?.some(g => g.active) && (
          <div style={{
            background: checks.total > 0 && checks.done === checks.total ? 'var(--success-light)' : 'var(--primary-bg)',
            border: `1px solid ${checks.total > 0 && checks.done === checks.total ? 'var(--success)' : 'var(--primary-light)'}`,
            borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Objectifs du jour</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: checks.done === checks.total && checks.total > 0 ? 'var(--success)' : 'var(--primary)' }}>
              {checks.done}/{checks.total} ✓
            </span>
          </div>
        )}

        {/* Bandeau journée validée */}
        {isLocked && (
          <div style={{ background: '#F0FDF4', border: '1.5px solid #22C55E', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#16A34A' }}>🔒 Journée validée</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Les valeurs sont figées. Contacte ta coach pour modifier.</div>
            </div>
          </div>
        )}

        {saved && <div className="alert alert-success">✅ Suivi enregistré !</div>}
        {existing && !saved && !isLocked && (
          <div style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--primary)' }}>
            ✏️ Données existantes — tu peux les modifier.
          </div>
        )}

        {/* Poids */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>⚖️ Poids</div>
          <div className="input-group">
            <label className="input-label">Poids ce matin (kg) — à jeun</label>
            <input className="input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="ex: 64.2" step="0.1" />
          </div>
        </div>

        {/* Pas */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>👟 Pas</div>
          <div className="input-group">
            <label className="input-label">Pas réalisés</label>
            <input className="input" type="number" value={form.steps} onChange={e => set('steps', e.target.value)} placeholder={`Objectif : ${(targets.steps || 10000).toLocaleString()}`} />
          </div>
          {form.steps && (
            <div style={{ marginTop: 10 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (+form.steps / (targets.steps || 10000)) * 100)}%` }} />
              </div>
              <p style={{ fontSize: 12, color: stepBonus >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 6, fontWeight: 600 }}>
                {stepBonus >= 0 ? `✅ +${stepBonus} kcal bonus` : `⚠️ ${stepBonus} kcal`}
              </p>
            </div>
          )}
        </div>

        {/* Séance */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🏋️ Séance programme</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { val: true, label: '✅ Faite', color: 'var(--success)' },
              { val: false, label: '❌ Non faite', color: 'var(--danger)' },
              { val: null, label: '— Pas prévue', color: 'var(--text-muted)' },
            ].map(opt => (
              <button key={String(opt.val)} type="button" onClick={() => set('didProgramSession', opt.val)} style={{
                padding: '12px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                border: `2px solid ${form.didProgramSession === opt.val ? opt.color : 'var(--border)'}`,
                background: form.didProgramSession === opt.val ? opt.val === true ? 'var(--success-light)' : opt.val === false ? 'var(--danger-light)' : 'var(--border-light)' : 'white',
                color: form.didProgramSession === opt.val ? opt.color : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s'
              }}>{opt.label}</button>
            ))}
          </div>
          {!isIntuitif && form.didProgramSession === false && (
            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8, fontWeight: 600 }}>
              ⚠️ -{targets.sessionCalorieDeficit || 300} kcal sur la semaine
            </p>
          )}
        </div>

        {/* Activité bonus */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🏃 Activité bonus</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Activité (optionnel)</label>
              <input className="input" value={form.extraActivity} onChange={e => set('extraActivity', e.target.value)} placeholder="Ex: 45 min de vélo, natation..." />
            </div>
            {!isIntuitif && (
              <div className="input-group">
                <label className="input-label">Calories brûlées estimées par ta coach (kcal)</label>
                <input className="input" type="number" value={form.extraActivityCal} onChange={e => set('extraActivityCal', e.target.value)} placeholder="Ex: 250" />
              </div>
            )}
          </div>
          {!isIntuitif && form.extraActivityCal && (
            <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 8, fontWeight: 600 }}>
              ✅ +{form.extraActivityCal} kcal à manger en plus
            </p>
          )}
        </div>

        {/* ───── MODE TRACKING ───── */}
        {!isIntuitif && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🍽️ Alimentation</div>
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">Calories consommées (kcal)</label>
              <input className="input" type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder={`Objectif ajusté : ${adjustedTarget} kcal`} />
            </div>
            {form.calories && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{form.calories} kcal</span><span>/ {adjustedTarget} kcal</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (+form.calories / adjustedTarget) * 100)}%` }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Base: {targets.calories}</span>
                  {stepBonus !== 0 && <span style={{ color: stepBonus > 0 ? 'var(--success)' : 'var(--danger)' }}>Pas: {stepBonus > 0 ? '+' : ''}{stepBonus}</span>}
                  {extraCal > 0 && <span style={{ color: 'var(--success)' }}>Activité: +{extraCal}</span>}
                  {sessionAdj !== 0 && <span style={{ color: 'var(--danger)' }}>Séance: {sessionAdj}</span>}
                </div>
                {(() => {
                  if (!form.calories) return null;
                  const todayDiff = +form.calories - adjustedTarget; // écart du jour
                  const carryOver = weekBalance || 0; // report des jours précédents verrouillés
                  const totalBalance = todayDiff + carryOver; // balance totale avec report

                  const color = totalBalance > 100 ? 'var(--warning)' : totalBalance < -100 ? 'var(--success)' : 'var(--primary)';
                  const sign = totalBalance > 0 ? '+' : '';

                  return (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {carryOver !== 0 && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                          Report veille : {carryOver > 0 ? '+' : ''}{carryOver} kcal
                        </p>
                      )}
                      <p style={{ fontSize: 13, color, fontWeight: 700 }}>
                        Balance du jour : {sign}{totalBalance} kcal
                        {totalBalance > 100 ? ' — à réguler' : totalBalance < -100 ? ' — crédit 🎯' : ' — dans la cible ✅'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Macros</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'protein', label: 'Protéines', color: '#F59E0B', target: targets.protein },
                  { key: 'carbs', label: 'Glucides', color: '#EC4899', target: targets.carbs },
                  { key: 'fat', label: 'Lipides', color: '#7C3AED', target: targets.fat },
                ].map(m => (
                  <div key={m.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.label}</label>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Obj: {m.target || '—'} g</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="input" type="number" value={form[m.key]} onChange={e => set(m.key, e.target.value)} placeholder="g" style={{ flex: 1 }} />
                      {form[m.key] && m.target && (
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36, textAlign: 'right', color: +form[m.key] >= m.target * 0.9 ? 'var(--success)' : +form[m.key] >= m.target * 0.7 ? 'var(--warning)' : 'var(--danger)' }}>
                          {Math.round((+form[m.key] / m.target) * 100)}%
                        </span>
                      )}
                    </div>
                    {form[m.key] && m.target && (
                      <div className="progress-bar" style={{ marginTop: 6, height: 5 }}>
                        <div style={{ height: '100%', borderRadius: 100, background: m.color, width: `${Math.min(100, (+form[m.key] / m.target) * 100)}%`, transition: 'width 0.4s' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ───── REPÈRE ASSIETTE ───── */}
        {!isIntuitif && (targets.calories || targets.protein) && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🍽️ Repère de l'assiette</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Répartition idéale conseillée par ta coach sur la journée.
            </p>
            {/* Barres de répartition visuelle */}
            {(() => {
              const totalCal = targets.calories || 0;
              const protCal = (targets.protein || 0) * 4;
              const carbsCal = (targets.carbs || 0) * 4;
              const fatCal = (targets.fat || 0) * 9;
              const protPct = totalCal ? Math.round((protCal / totalCal) * 100) : 0;
              const carbsPct = totalCal ? Math.round((carbsCal / totalCal) * 100) : 0;
              const fatPct = totalCal ? Math.round((fatCal / totalCal) * 100) : 0;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Barre visuelle */}
                  <div style={{ display: 'flex', height: 14, borderRadius: 100, overflow: 'hidden', gap: 2 }}>
                    <div style={{ width: `${protPct}%`, background: '#F59E0B', borderRadius: '100px 0 0 100px' }} title={`Protéines ${protPct}%`} />
                    <div style={{ width: `${carbsPct}%`, background: '#EC4899' }} title={`Glucides ${carbsPct}%`} />
                    <div style={{ width: `${fatPct}%`, background: '#7C3AED', borderRadius: '0 100px 100px 0' }} title={`Lipides ${fatPct}%`} />
                  </div>
                  {/* Légende */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Protéines', g: targets.protein, kcal: protCal, pct: protPct, color: '#F59E0B' },
                      { label: 'Glucides', g: targets.carbs, kcal: carbsCal, pct: carbsPct, color: '#EC4899' },
                      { label: 'Lipides', g: targets.fat, kcal: fatCal, pct: fatPct, color: '#7C3AED' },
                    ].map(m => (
                      <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          <strong style={{ color: m.color }}>{m.g}g</strong> {m.label} · {m.kcal} kcal · {m.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Repères par repas */}
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10, marginTop: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Par repas</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { label: '🌅 Matin', ratio: 0.25 },
                        { label: '☀️ Midi', ratio: 0.35 },
                        { label: '🌙 Soir', ratio: 0.30 },
                        { label: '🍎 Collation', ratio: 0.10 },
                      ].map(meal => (
                        <div key={meal.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{meal.label}</span>
                          <span style={{ fontWeight: 600 }}>
                            ~{Math.round(totalCal * meal.ratio)} kcal
                            {targets.protein ? ` · ${Math.round(targets.protein * meal.ratio)}g prot` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ───── OBJECTIFS HEBDO (tous modes) ───── */}
        {weekGoals?.goals?.some(g => g.active) && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🎯 Objectifs du jour</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Coche ce que tu as respecté à chaque repas.</p>

            {weekGoals.goals.filter(g => g.active).map(goal => {
              if (goal.key === 'protein') return (
                <div key="protein" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>🥩</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Protéines ≥ 30g à chaque repas</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ex : 300g de skyr, 3 œufs + 150g poulet, 200g thon...</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {MEALS.map(m => (
                      <button key={m.key} type="button" onClick={() => setCheck('protein', m.key, !goalChecks?.protein?.[m.key])} style={{
                        padding: '12px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `2px solid ${goalChecks?.protein?.[m.key] ? 'var(--success)' : 'var(--border)'}`,
                        background: goalChecks?.protein?.[m.key] ? 'var(--success-light)' : 'white',
                        color: goalChecks?.protein?.[m.key] ? 'var(--success)' : 'var(--text-muted)',
                        fontFamily: 'var(--font-body)', transition: 'all 0.2s', textAlign: 'center',
                      }}>
                        {goalChecks?.protein?.[m.key] ? '✅' : '○'}<br />{m.emoji} {m.label}
                      </button>
                    ))}
                  </div>
                  {goal.includeSnack && (
                    <button type="button" onClick={() => setCheck('protein', 'snack', !goalChecks?.protein?.snack)} style={{
                      marginTop: 8, width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `2px solid ${goalChecks?.protein?.snack ? 'var(--success)' : 'var(--border)'}`,
                      background: goalChecks?.protein?.snack ? 'var(--success-light)' : 'white',
                      color: goalChecks?.protein?.snack ? 'var(--success)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                    }}>
                      {goalChecks?.protein?.snack ? '✅' : '○'} 🍱 Collation ≥ 15g
                    </button>
                  )}
                </div>
              );

              if (goal.key === 'vegetables') return (
                <div key="vegetables" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>🥦</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Légumes ≥ 250g par repas</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Midi et soir — crus ou cuits</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[{key:'lunch',label:'Midi',emoji:'☀️'},{key:'dinner',label:'Soir',emoji:'🌙'}].map(m => (
                      <button key={m.key} type="button" onClick={() => setCheck('vegetables', m.key, !goalChecks?.vegetables?.[m.key])} style={{
                        padding: '12px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `2px solid ${goalChecks?.vegetables?.[m.key] ? 'var(--success)' : 'var(--border)'}`,
                        background: goalChecks?.vegetables?.[m.key] ? 'var(--success-light)' : 'white',
                        color: goalChecks?.vegetables?.[m.key] ? 'var(--success)' : 'var(--text-muted)',
                        fontFamily: 'var(--font-body)', transition: 'all 0.2s', textAlign: 'center',
                      }}>
                        {goalChecks?.vegetables?.[m.key] ? '✅' : '○'}<br />{m.emoji} {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              );

              if (goal.key === 'fruits') return (
                <div key="fruits" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>🍎</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>2 fruits minimum dans la journée</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setCheck('fruits', 'done', !goalChecks?.fruits?.done)} style={{
                    width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `2px solid ${goalChecks?.fruits?.done ? 'var(--success)' : 'var(--border)'}`,
                    background: goalChecks?.fruits?.done ? 'var(--success-light)' : 'white',
                    color: goalChecks?.fruits?.done ? 'var(--success)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                  }}>
                    {goalChecks?.fruits?.done ? '✅ Objectif atteint !' : '○ Pas encore atteint'}
                  </button>
                </div>
              );

              if (goal.key === 'junkfood') return (
                <div key="junkfood" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>🍕</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Malbouffe du jour</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ta coach estimera d'après tes photos. Entre le nombre de calories ici si tu le sais.</div>
                    </div>
                  </div>
                  <input className="input" type="number" value={goalChecks?.junkfood?.calories || ''} onChange={e => setCheck('junkfood', 'calories', e.target.value)} placeholder="Ex: 350 kcal (optionnel)" />
                  {goal.maxCalories && goalChecks?.junkfood?.calories && (
                    <p style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: +goalChecks.junkfood.calories <= goal.maxCalories ? 'var(--success)' : 'var(--danger)' }}>
                      {+goalChecks.junkfood.calories <= goal.maxCalories ? `✅ Dans la limite (max ${goal.maxCalories} kcal)` : `⚠️ Au-dessus de la limite (max ${goal.maxCalories} kcal)`}
                    </p>
                  )}
                </div>
              );
              return null;
            })}
          </div>
        )}

        {isIntuitif && (!weekGoals || !weekGoals.goals?.some(g => g.active)) && (
          <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Ta coach n'a pas encore défini d'objectifs pour cette semaine.</p>
          </div>
        )}

        {/* Sommeil */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>😴 Sommeil</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Durée (h)</label>
              <input className="input" type="number" value={form.sleep} onChange={e => set('sleep', e.target.value)} placeholder={`Obj: ${targets.sleep || 8}h`} step="0.5" />
            </div>
            <div className="input-group">
              <label className="input-label">Qualité (1-5)</label>
              <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => set('sleepQuality', n)} style={{
                    width: 40, height: 40, borderRadius: '50%',
                    border: `2px solid ${+form.sleepQuality === n ? 'var(--primary)' : 'var(--border)'}`,
                    background: +form.sleepQuality === n ? 'var(--primary)' : 'white',
                    color: +form.sleepQuality === n ? 'white' : 'var(--text)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-body)'
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📝 Notes du jour</div>
          <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Comment tu te sens ?" rows={3} style={{ resize: 'none' }} />
        </div>

        {/* Règles — femmes uniquement */}
        {profile?.sex === 'F' && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🩸 Cycle menstruel</div>
            <button
              type="button"
              onClick={() => set('menstruation', !form.menstruation)}
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)',
                border: `2px solid ${form.menstruation ? '#EC4899' : 'var(--border)'}`,
                background: form.menstruation ? '#FDF2F8' : 'white',
                color: form.menstruation ? '#EC4899' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
              {form.menstruation ? '🩸 Règles aujourd\'hui ✅' : '○ Pas de règles aujourd\'hui'}
            </button>
            {form.menstruation && (
              <p style={{ fontSize: 12, color: '#EC4899', marginTop: 8, textAlign: 'center' }}>
                Noté — les fluctuations de poids sont normales ces jours-ci 💙
              </p>
            )}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving || isLocked}>
          {saving ? 'Enregistrement...' : isLocked ? '🔒 Journée validée' : '✅ Enregistrer le suivi'}
        </button>

        {!isLocked && existing && (
          <button
            onClick={handleLock}
            style={{ width: '100%', padding: '12px', marginTop: 10, background: 'none', border: '1.5px solid #22C55E', color: '#16A34A', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            🔒 Valider définitivement la journée
          </button>
        )}
      </div>

      {!coachMode && <TabBar />}
    </div>
  );
}
