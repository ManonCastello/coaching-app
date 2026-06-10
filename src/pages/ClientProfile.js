// src/pages/ClientProfile.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateBMR, calculateTDEE, calculateBMI, getBMICategory, calculateAgeFromDOB, WEEK_DAYS } from '../utils/calculations';
import TabBar from '../components/TabBar';
import CoachToggle from '../components/CoachToggle';

export default function ClientProfile() {
  const { currentUser, userRole, coachMode, switchMode } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editReminder, setEditReminder] = useState(false);
  const [editBilanDay, setEditBilanDay] = useState(false);
  const [reminderHour, setReminderHour] = useState('20');
  const [reminderMin, setReminderMin] = useState('00');
  const [bilanDay, setBilanDay] = useState(1);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const d = await getDoc(doc(db, 'clients', currentUser.uid));
      if (d.exists()) {
        const data = d.data();
        setProfile(data);
        const [h, m] = (data.reminderTime || '20:00').split(':');
        setReminderHour(h); setReminderMin(m);
        setBilanDay(data.weeklyBilanDay ?? 1);
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid]);

  async function saveReminder() {
    await updateDoc(doc(db, 'clients', currentUser.uid), { reminderTime: `${reminderHour}:${reminderMin}` });
    setProfile(p => ({ ...p, reminderTime: `${reminderHour}:${reminderMin}` }));
    setEditReminder(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveBilanDay() {
    await updateDoc(doc(db, 'clients', currentUser.uid), { weeklyBilanDay: +bilanDay });
    setProfile(p => ({ ...p, weeklyBilanDay: +bilanDay }));
    setEditBilanDay(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function handleToggle() { switchMode(); navigate('/coach'); }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;
  if (!profile) return null;

  const age = calculateAgeFromDOB(profile.dob);
  const bmr = calculateBMR({ weight: profile.weight, height: profile.height, age, sex: profile.sex });
  const tdee = calculateTDEE({ bmr, activityLevel: profile.activityLevel });
  const bmi = calculateBMI({ weight: profile.weight, height: profile.height });
  const bmiCat = getBMICategory(bmi);
  const bilanDayLabel = WEEK_DAYS.find(d => d.value === (profile.weeklyBilanDay ?? 1))?.label || 'Lundi';

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Mon profil</div>
        {userRole === 'coach' && <CoachToggle mode={coachMode} onSwitch={handleToggle} />}
      </div>

      <div className="page">
        {saved && <div className="alert alert-success">✅ Mis à jour !</div>}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 12, boxShadow: '0 8px 24px rgba(124,58,237,0.25)' }}>
            {profile.firstName?.[0]}{profile.lastName?.[0]}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>{profile.firstName} {profile.lastName}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{profile.profession}</p>
          {profile.formule && (
            <span className={`badge ${profile.formule === 'platinium' ? 'badge-primary' : 'badge-warning'}`} style={{ marginTop: 8 }}>
              {profile.formule === 'platinium' ? '💎 Platinium' : '🥇 Gold'}
            </span>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>👤 Informations</div>
          {[
            { label: 'Sexe', value: profile.sex === 'F' ? 'Femme' : 'Homme' },
            { label: 'Âge', value: age ? `${age} ans` : '—' },
            { label: 'Date de naissance', value: profile.dob ? new Date(profile.dob).toLocaleDateString('fr-FR') : '—' },
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

        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">BMR</div>
            <div className="stat-value">{bmr || '—'}<span className="stat-unit">kcal</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">TDEE</div>
            <div className="stat-value">{tdee || '—'}<span className="stat-unit">kcal</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">IMC</div>
            <div className="stat-value" style={{ color: bmiCat.color }}>{bmi || '—'}</div>
            <p style={{ fontSize: 11, color: bmiCat.color, marginTop: 4 }}>{bmiCat.label}</p>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cible</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{profile.targets?.calories || '—'}<span className="stat-unit">kcal</span></div>
          </div>
        </div>

        {/* Reminder */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editReminder ? 16 : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🔔 Rappel quotidien</div>
              {!editReminder && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Chaque jour à {profile.reminderTime || '20:00'}</p>}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditReminder(!editReminder)}>
              {editReminder ? 'Annuler' : 'Modifier'}
            </button>
          </div>
          {editReminder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group"><label className="input-label">Heure</label><input className="input" type="number" value={reminderHour} onChange={e => setReminderHour(e.target.value.padStart(2,'0'))} min="0" max="23" /></div>
                <div className="input-group"><label className="input-label">Minutes</label><input className="input" type="number" value={reminderMin} onChange={e => setReminderMin(e.target.value.padStart(2,'0'))} min="0" max="59" /></div>
              </div>
              <button className="btn btn-primary" onClick={saveReminder}>Enregistrer</button>
            </div>
          )}
        </div>

        {/* Bilan day */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editBilanDay ? 16 : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📅 Jour du bilan hebdo</div>
              {!editBilanDay && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Chaque {bilanDayLabel}</p>}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditBilanDay(!editBilanDay)}>
              {editBilanDay ? 'Annuler' : 'Modifier'}
            </button>
          </div>
          {editBilanDay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="input" value={bilanDay} onChange={e => setBilanDay(+e.target.value)}>
                {WEEK_DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <button className="btn btn-primary" onClick={saveBilanDay}>Enregistrer</button>
            </div>
          )}
        </div>
      </div>

      <TabBar />
    </div>
  );
}
