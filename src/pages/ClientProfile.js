// src/pages/ClientProfile.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateBMR, calculateTDEE, calculateBMI, getBMICategory } from '../utils/calculations';

export default function ClientProfile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editReminder, setEditReminder] = useState(false);
  const [reminderHour, setReminderHour] = useState('20');
  const [reminderMin, setReminderMin] = useState('00');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const d = await getDoc(doc(db, 'clients', currentUser.uid));
      if (d.exists()) {
        const data = d.data();
        setProfile(data);
        const [h, m] = (data.reminderTime || '20:00').split(':');
        setReminderHour(h); setReminderMin(m);
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid]);

  async function saveReminder() {
    await updateDoc(doc(db, 'clients', currentUser.uid), {
      reminderTime: `${reminderHour}:${reminderMin}`
    });
    setProfile(p => ({ ...p, reminderTime: `${reminderHour}:${reminderMin}` }));
    setEditReminder(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;
  if (!profile) return null;

  const bmr = calculateBMR({ weight: profile.weight, height: profile.height, age: profile.age, sex: profile.sex });
  const tdee = calculateTDEE({ bmr, activityLevel: profile.activityLevel });
  const bmi = calculateBMI({ weight: profile.weight, height: profile.height });
  const bmiCat = getBMICategory(bmi);

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Mon profil</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">
        {saved && <div className="alert alert-success">✅ Rappel mis à jour !</div>}

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 12,
            boxShadow: '0 8px 24px rgba(124,58,237,0.25)'
          }}>
            {profile.firstName?.[0]}{profile.lastName?.[0]}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
            {profile.firstName} {profile.lastName}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{profile.profession}</p>
        </div>

        {/* Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>👤 Informations</div>
          {[
            { label: 'Sexe', value: profile.sex === 'F' ? 'Femme' : 'Homme' },
            { label: 'Âge', value: `${profile.age} ans` },
            { label: 'Taille', value: `${profile.height} cm` },
            { label: 'Poids initial', value: `${profile.weight} kg` },
            { label: 'Activité', value: profile.activityLevel },
            { label: 'Objectif', value: profile.goal },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">BMR</div>
            <div className="stat-value">{bmr}<span className="stat-unit">kcal</span></div>
            <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>Au repos</p>
          </div>
          <div className="stat-card">
            <div className="stat-label">TDEE</div>
            <div className="stat-value">{tdee}<span className="stat-unit">kcal</span></div>
            <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>Dépense réelle</p>
          </div>
          <div className="stat-card">
            <div className="stat-label">IMC</div>
            <div className="stat-value" style={{ color: bmiCat.color }}>{bmi}</div>
            <p style={{ fontSize: 11, color: bmiCat.color, marginTop: 4 }}>{bmiCat.label}</p>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cible</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{profile.targets?.calories}<span className="stat-unit">kcal</span></div>
            <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>Défini par coach</p>
          </div>
        </div>

        {/* Reminder */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editReminder ? 16 : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🔔 Rappel quotidien</div>
              {!editReminder && (
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
                  Chaque jour à {profile.reminderTime || '20:00'}
                </p>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditReminder(!editReminder)}>
              {editReminder ? 'Annuler' : 'Modifier'}
            </button>
          </div>
          {editReminder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Heure</label>
                  <input className="input" type="number" value={reminderHour} onChange={e => setReminderHour(e.target.value.padStart(2,'0'))} min="0" max="23" />
                </div>
                <div className="input-group">
                  <label className="input-label">Minutes</label>
                  <input className="input" type="number" value={reminderMin} onChange={e => setReminderMin(e.target.value.padStart(2,'0'))} min="0" max="59" />
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveReminder}>Enregistrer</button>
            </div>
          )}
        </div>
      </div>

      <nav className="tab-bar">
        <Link to="/dashboard" className="tab-item"><span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span></Link>
        <Link to="/checkin/daily" className="tab-item"><span style={{ fontSize: 20 }}>📋</span><span>Suivi</span></Link>
        <Link to="/checkin/weekly" className="tab-item"><span style={{ fontSize: 20 }}>📊</span><span>Bilan</span></Link>
        <Link to="/profile" className="tab-item active"><span style={{ fontSize: 20 }}>👤</span><span>Profil</span></Link>
      </nav>
    </div>
  );
}
