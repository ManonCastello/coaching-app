// src/pages/DailyCheckIn.js
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DailyCheckIn() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(null);
  const [existing, setExisting] = useState(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), "EEEE d MMMM", { locale: fr });

  const [form, setForm] = useState({
    weight: '', steps: '', calories: '',
    protein: '', sleep: '', sleepQuality: '',
    notes: '',
  });

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) setProfile(profileDoc.data());

      const entryDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', today));
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
          notes: data.notes || '',
        });
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid, today]);

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', today), {
        date: today,
        weight: form.weight ? +form.weight : null,
        steps: form.steps ? +form.steps : 0,
        calories: form.calories ? +form.calories : 0,
        protein: form.protein ? +form.protein : 0,
        sleep: form.sleep ? +form.sleep : null,
        sleepQuality: form.sleepQuality ? +form.sleepQuality : null,
        notes: form.notes,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch { }
    setSaving(false);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  const targets = profile?.targets || {};

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Suivi quotidien</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, textTransform: 'capitalize' }}>
          📅 {todayLabel}
        </p>

        {saved && <div className="alert alert-success">✅ Suivi enregistré !</div>}
        {existing && !saved && (
          <div style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--primary)' }}>
            ✏️ Tu as déjà rempli aujourd'hui — tu peux modifier tes données.
          </div>
        )}

        {/* Weight */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>⚖️ Poids</div>
          </div>
          <div className="input-group">
            <label className="input-label">Poids ce matin (kg) — à jeun de préférence</label>
            <input className="input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="ex: 64.2" step="0.1" />
          </div>
        </div>

        {/* Steps */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>👟 Pas</div>
          <div className="input-group">
            <label className="input-label">Pas réalisés aujourd'hui</label>
            <input className="input" type="number" value={form.steps} onChange={e => set('steps', e.target.value)} placeholder={`Objectif : ${(targets.steps || 10000).toLocaleString()}`} />
          </div>
          {form.steps && (
            <div style={{ marginTop: 10 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (+form.steps / (targets.steps || 10000)) * 100)}%` }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {+form.steps >= (targets.steps || 10000)
                  ? `✅ Objectif atteint ! Bonus : +${Math.round(((+form.steps - targets.steps) / 1000) * (targets.kcalPer1000Steps || 80))} kcal`
                  : `${((targets.steps || 10000) - +form.steps).toLocaleString()} pas restants · Impact : ${Math.round(((+form.steps - (targets.steps||10000)) / 1000) * (targets.kcalPer1000Steps || 80))} kcal`
                }
              </p>
            </div>
          )}
        </div>

        {/* Calories & protein */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🍽️ Alimentation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Calories consommées (kcal)</label>
              <input className="input" type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder={`Objectif : ${targets.calories || '—'} kcal`} />
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
                <span>/ {targets.calories} kcal</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${Math.min(100, (+form.calories / (targets.calories || 2000)) * 100)}%`,
                  background: +form.calories > (targets.calories * 1.1) ? 'var(--warning)' : undefined
                }} />
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
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                    fontFamily: 'var(--font-body)'
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📝 Notes du jour</div>
          <textarea
            className="input"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Comment tu te sens ? Quelque chose à noter..."
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : '✅ Enregistrer le suivi'}
        </button>
      </div>

      <nav className="tab-bar">
        <Link to="/dashboard" className="tab-item"><span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span></Link>
        <Link to="/checkin/daily" className="tab-item active"><span style={{ fontSize: 20 }}>📋</span><span>Suivi</span></Link>
        <Link to="/checkin/weekly" className="tab-item"><span style={{ fontSize: 20 }}>📊</span><span>Bilan</span></Link>
        <Link to="/profile" className="tab-item"><span style={{ fontSize: 20 }}>👤</span><span>Profil</span></Link>
      </nav>
    </div>
  );
}
