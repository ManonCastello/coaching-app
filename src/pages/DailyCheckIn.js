// src/pages/DailyCheckIn.js
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { format, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DailyCheckIn({ coachMode }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(null);
  const [existing, setExisting] = useState(null);
  // Allow navigating to past days
  const [dayOffset, setDayOffset] = useState(0);

  const targetDate = format(subDays(new Date(), dayOffset), 'yyyy-MM-dd');
  const dateLabel = format(subDays(new Date(), dayOffset), "EEEE d MMMM", { locale: fr });
  const isToday = dayOffset === 0;

  const [form, setForm] = useState({
    weight: '', steps: '', calories: '',
    protein: '', sleep: '', sleepQuality: '',
    didProgramSession: null,
    extraActivity: '', extraActivityCal: '',
    notes: '',
  });

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }

  // Weekly calorie balance
  const [weekBalance, setWeekBalance] = useState(null);

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) setProfile(profileDoc.data());

      const entryDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', targetDate));
      if (entryDoc.exists()) {
        const data = entryDoc.data();
        setExisting(data);
        setForm({
          weight: data.weight || '',
          steps: data.steps || '',
          calories: data.calories || '',
          protein: data.protein || '',
          sleep: data.sleep || '',
          sleepQuality: data.sleepQuality || '',
          didProgramSession: data.didProgramSession ?? null,
          extraActivity: data.extraActivity || '',
          extraActivityCal: data.extraActivityCal || '',
          notes: data.notes || '',
        });
      } else {
        setExisting(null);
        setForm({ weight: '', steps: '', calories: '', protein: '', sleep: '', sleepQuality: '', didProgramSession: null, extraActivity: '', extraActivityCal: '', notes: '' });
      }

      // Load week balance (last 7 days)
      const q = query(collection(db, 'clients', currentUser.uid, 'dailyEntries'), orderBy('date', 'desc'), limit(7));
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => d.data());
      setLoading(false);

      if (profileDoc.exists()) {
        const t = profileDoc.data().targets || {};
        let totalDiff = 0;
        entries.forEach(e => {
          if (e.calories) {
            const stepBonus = Math.round(((e.steps || 0) - (t.steps || 10000)) / 1000 * (t.kcalPer1000Steps || 20));
            const sessionDef = e.didProgramSession === false ? -(t.sessionCalorieDeficit || 300) : 0;
            const extraCal = e.extraActivityCal ? +e.extraActivityCal : 0;
            const target = (t.calories || 2000) + stepBonus + extraCal + sessionDef;
            totalDiff += (e.calories - target);
          }
        });
        setWeekBalance(Math.round(totalDiff));
      }
    }
    load();
  }, [currentUser.uid, targetDate]);

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', targetDate), {
        date: targetDate,
        weight: form.weight ? +form.weight : null,
        steps: form.steps ? +form.steps : 0,
        calories: form.calories ? +form.calories : 0,
        protein: form.protein ? +form.protein : 0,
        sleep: form.sleep ? +form.sleep : null,
        sleepQuality: form.sleepQuality ? +form.sleepQuality : null,
        didProgramSession: form.didProgramSession,
        extraActivity: form.extraActivity,
        extraActivityCal: form.extraActivityCal ? +form.extraActivityCal : 0,
        notes: form.notes,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => {
        if (coachMode) navigate('/coach');
        else navigate('/dashboard');
      }, 1200);
    } catch {}
    setSaving(false);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  const targets = profile?.targets || {};
  const stepBonus = form.steps ? Math.round(((+form.steps - (targets.steps || 10000)) / 1000) * (targets.kcalPer1000Steps || 20)) : 0;
  const sessionAdj = form.didProgramSession === false ? -(targets.sessionCalorieDeficit || 300) : 0;
  const extraCal = form.extraActivityCal ? +form.extraActivityCal : 0;
  const adjustedTarget = (targets.calories || 2000) + stepBonus + sessionAdj + extraCal;

  const backUrl = coachMode ? '/coach' : '/dashboard';

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to={backUrl} style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Suivi quotidien</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">
        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button onClick={() => setDayOffset(d => d + 1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>←</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>{isToday ? "Aujourd'hui" : dateLabel}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(subDays(new Date(), dayOffset), 'dd/MM/yyyy')}</div>
          </div>
          <button onClick={() => setDayOffset(d => Math.max(0, d - 1))} disabled={isToday} style={{ background: 'none', border: 'none', fontSize: 20, cursor: isToday ? 'default' : 'pointer', color: isToday ? 'var(--border)' : 'var(--text-muted)' }}>→</button>
        </div>

        {/* Week balance */}
        {weekBalance !== null && (
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

        {saved && <div className="alert alert-success">✅ Suivi enregistré !</div>}
        {existing && !saved && (
          <div style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--primary)' }}>
            ✏️ Données existantes — tu peux les modifier.
          </div>
        )}

        {/* Weight */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>⚖️ Poids</div>
          <div className="input-group">
            <label className="input-label">Poids ce matin (kg) — à jeun</label>
            <input className="input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="ex: 64.2" step="0.1" />
          </div>
        </div>

        {/* Steps */}
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

        {/* Session programme */}
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
          {form.didProgramSession === false && (
            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8, fontWeight: 600 }}>
              ⚠️ -{targets.sessionCalorieDeficit || 300} kcal sur la semaine
            </p>
          )}
        </div>

        {/* Extra activity */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🏃 Activité bonus</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Activité (optionnel)</label>
              <input className="input" value={form.extraActivity} onChange={e => set('extraActivity', e.target.value)} placeholder="Ex: 45 min de vélo, natation..." />
            </div>
            <div className="input-group">
              <label className="input-label">Calories brûlées estimées par ta coach (kcal)</label>
              <input className="input" type="number" value={form.extraActivityCal} onChange={e => set('extraActivityCal', e.target.value)} placeholder="Ex: 250" />
            </div>
          </div>
          {form.extraActivityCal && (
            <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 8, fontWeight: 600 }}>
              ✅ +{form.extraActivityCal} kcal à manger en plus
            </p>
          )}
        </div>

        {/* Calories */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🍽️ Alimentation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Calories consommées (kcal)</label>
              <input className="input" type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder={`Objectif ajusté : ${adjustedTarget} kcal`} />
            </div>
            <div className="input-group">
              <label className="input-label">Protéines (g) — optionnel</label>
              <input className="input" type="number" value={form.protein} onChange={e => set('protein', e.target.value)} placeholder={`Objectif : ${targets.protein || '—'} g`} />
            </div>
          </div>
          {form.calories && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{form.calories} kcal</span>
                <span>/ {adjustedTarget} kcal (objectif ajusté)</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (+form.calories / adjustedTarget) * 100)}%` }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Base: {targets.calories}</span>
                {stepBonus !== 0 && <span style={{ color: stepBonus > 0 ? 'var(--success)' : 'var(--danger)' }}>Pas: {stepBonus > 0 ? '+' : ''}{stepBonus}</span>}
                {extraCal > 0 && <span style={{ color: 'var(--success)' }}>Activité: +{extraCal}</span>}
                {sessionAdj !== 0 && <span style={{ color: 'var(--danger)' }}>Séance: {sessionAdj}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Sleep */}
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

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : '✅ Enregistrer le suivi'}
        </button>
      </div>

      {!coachMode && (
        <nav className="tab-bar">
          <Link to="/dashboard" className="tab-item"><span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span></Link>
          <Link to="/checkin/daily" className="tab-item active"><span style={{ fontSize: 20 }}>📋</span><span>Suivi</span></Link>
          <Link to="/progress" className="tab-item"><span style={{ fontSize: 20 }}>📈</span><span>Progrès</span></Link>
          <Link to="/profile" className="tab-item"><span style={{ fontSize: 20 }}>👤</span><span>Profil</span></Link>
        </nav>
      )}
    </div>
  );
}
