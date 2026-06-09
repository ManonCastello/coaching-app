// src/pages/WeeklyCheckIn.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

const QUESTIONNAIRE = [
  { key: 'energy', label: '⚡ Niveau d\'énergie cette semaine', min: '😴 Épuisé(e)', max: '🚀 Plein(e) d\'énergie' },
  { key: 'hunger', label: '🍽️ Gestion de la faim', min: '😫 Difficile', max: '😊 Facile' },
  { key: 'motivation', label: '💪 Motivation sportive', min: '😔 Aucune', max: '🔥 Maximale' },
  { key: 'stress', label: '🧘 Niveau de stress', min: '😰 Très stressé(e)', max: '😌 Serein(e)' },
  { key: 'adherence', label: '🎯 Respect du programme', min: '❌ Peu suivi', max: '✅ Parfaitement' },
];

export default function WeeklyCheckIn() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekLabel = format(new Date(), "'Semaine du' d MMMM yyyy", { locale: fr });

  const [form, setForm] = useState({
    waist: '', hips: '', thighs: '', arms: '', chest: '',
    energy: '', hunger: '', motivation: '', stress: '', adherence: '',
    weekNotes: '', weekHighlight: '', weekDifficulty: '',
    avgWeight: '',
  });

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }

  useEffect(() => {
    async function load() {
      const weekDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'weeklyEntries', weekKey));
      if (weekDoc.exists()) {
        const d = weekDoc.data();
        setForm({
          waist: d.measurements?.waist || '',
          hips: d.measurements?.hips || '',
          thighs: d.measurements?.thighs || '',
          arms: d.measurements?.arms || '',
          chest: d.measurements?.chest || '',
          energy: d.questionnaire?.energy || '',
          hunger: d.questionnaire?.hunger || '',
          motivation: d.questionnaire?.motivation || '',
          stress: d.questionnaire?.stress || '',
          adherence: d.questionnaire?.adherence || '',
          weekNotes: d.weekNotes || '',
          weekHighlight: d.weekHighlight || '',
          weekDifficulty: d.weekDifficulty || '',
          avgWeight: d.avgWeight || '',
        });
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid, weekKey]);

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'clients', currentUser.uid, 'weeklyEntries', weekKey), {
        weekStart: weekKey,
        avgWeight: form.avgWeight ? +form.avgWeight : null,
        measurements: {
          waist: form.waist ? +form.waist : null,
          hips: form.hips ? +form.hips : null,
          thighs: form.thighs ? +form.thighs : null,
          arms: form.arms ? +form.arms : null,
          chest: form.chest ? +form.chest : null,
        },
        questionnaire: {
          energy: form.energy ? +form.energy : null,
          hunger: form.hunger ? +form.hunger : null,
          motivation: form.motivation ? +form.motivation : null,
          stress: form.stress ? +form.stress : null,
          adherence: form.adherence ? +form.adherence : null,
        },
        weekNotes: form.weekNotes,
        weekHighlight: form.weekHighlight,
        weekDifficulty: form.weekDifficulty,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => navigate('/dashboard'), 1400);
    } catch {}
    setSaving(false);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Bilan hebdomadaire</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>📅 {weekLabel}</p>

        {saved && <div className="alert alert-success">✅ Bilan enregistré !</div>}

        {/* Weight */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>⚖️ Poids moyen de la semaine</div>
          <div className="input-group">
            <label className="input-label">Poids moyen (kg)</label>
            <input className="input" type="number" value={form.avgWeight} onChange={e => set('avgWeight', e.target.value)} placeholder="ex: 63.8" step="0.1" />
          </div>
        </div>

        {/* Measurements */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📏 Mensurations (cm)</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Mesure toujours au même endroit, le matin, sans forcer.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'waist', label: 'Taille', emoji: '👗' },
              { key: 'hips', label: 'Hanches', emoji: '🔵' },
              { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
              { key: 'arms', label: 'Bras', emoji: '💪' },
              { key: 'chest', label: 'Poitrine', emoji: '👕' },
            ].map(m => (
              <div key={m.key} className="input-group">
                <label className="input-label">{m.emoji} {m.label}</label>
                <input className="input" type="number" value={form[m.key]} onChange={e => set(m.key, e.target.value)} placeholder="cm" step="0.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Questionnaire */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🎯 Ressenti de la semaine</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Note de 1 à 5 pour chaque critère.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {QUESTIONNAIRE.map(q => (
              <div key={q.key}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{q.label}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 6 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => set(q.key, n)} style={{
                      flex: 1, height: 44, borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${+form[q.key] === n ? 'var(--primary)' : 'var(--border)'}`,
                      background: +form[q.key] === n
                        ? n <= 2 ? 'var(--danger-light)' : n === 3 ? 'var(--warning-light)' : 'var(--success-light)'
                        : 'white',
                      color: +form[q.key] === n
                        ? n <= 2 ? 'var(--danger)' : n === 3 ? 'var(--warning)' : 'var(--success)'
                        : 'var(--text-muted)',
                      fontWeight: 700, fontSize: 16, cursor: 'pointer',
                      transition: 'all 0.2s', fontFamily: 'var(--font-body)'
                    }}>{n}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-light)' }}>
                  <span>{q.min}</span><span>{q.max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Free text questions */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>💬 Questions ouvertes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">🌟 Point positif de la semaine</label>
              <textarea className="input" value={form.weekHighlight} onChange={e => set('weekHighlight', e.target.value)} placeholder="Ce qui s'est bien passé..." rows={2} style={{ resize: 'none' }} />
            </div>
            <div className="input-group">
              <label className="input-label">⚠️ Difficulté rencontrée</label>
              <textarea className="input" value={form.weekDifficulty} onChange={e => set('weekDifficulty', e.target.value)} placeholder="Ce qui a été difficile..." rows={2} style={{ resize: 'none' }} />
            </div>
            <div className="input-group">
              <label className="input-label">📝 Notes libres pour ton coach</label>
              <textarea className="input" value={form.weekNotes} onChange={e => set('weekNotes', e.target.value)} placeholder="Tout ce que tu veux partager..." rows={3} style={{ resize: 'none' }} />
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginBottom: 16 }}>
          {saving ? 'Enregistrement...' : '✅ Envoyer le bilan'}
        </button>
      </div>

      <nav className="tab-bar">
        <Link to="/dashboard" className="tab-item"><span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span></Link>
        <Link to="/checkin/daily" className="tab-item"><span style={{ fontSize: 20 }}>📋</span><span>Suivi</span></Link>
        <Link to="/checkin/weekly" className="tab-item active"><span style={{ fontSize: 20 }}>📊</span><span>Bilan</span></Link>
        <Link to="/profile" className="tab-item"><span style={{ fontSize: 20 }}>👤</span><span>Profil</span></Link>
      </nav>
    </div>
  );
}
