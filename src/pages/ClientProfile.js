// src/pages/ClientProfile.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateBMR, calculateTDEE, calculateBMI, getBMICategory, calculateAgeFromDOB, WEEK_DAYS } from '../utils/calculations';

const CLOUDINARY_CLOUD = 'dduaqnygn';
const CLOUDINARY_PRESET = 'fitlog_photos';
const MEASURE_FIELDS = [
  { key: 'waist', label: 'Taille', emoji: '👗' },
  { key: 'hips', label: 'Hanches', emoji: '🔵' },
  { key: 'glutes', label: 'Fesses', emoji: '🍑' },
  { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
  { key: 'arms', label: 'Bras', emoji: '💪' },
];
const PHOTO_SLOTS = [
  { key: 'face', label: 'Face' },
  { key: 'profile', label: 'Profil' },
  { key: 'back', label: 'Dos' },
];
import TabBar from '../components/TabBar';
import CoachToggle from '../components/CoachToggle';

export default function ClientProfile() {
  const { currentUser, userRole, coachMode, switchMode } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editReminder, setEditReminder] = useState(false);
  const [editBilanDay, setEditBilanDay] = useState(false);
  const [editStartData, setEditStartData] = useState(false);
  const [reminderHour, setReminderHour] = useState('20');
  const [reminderMin, setReminderMin] = useState('00');
  const [bilanDay, setBilanDay] = useState(1);
  const [saved, setSaved] = useState(false);
  const [startForm, setStartForm] = useState({ weight: '', waist: '', hips: '', glutes: '', thighs: '', arms: '' });
  const [startPhotos, setStartPhotos] = useState({ face: null, profile: null, back: null });
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const fileRefs = { face: React.useRef(), profile: React.useRef(), back: React.useRef() };

  useEffect(() => {
    async function load() {
      const d = await getDoc(doc(db, 'clients', currentUser.uid));
      if (d.exists()) {
        const data = d.data();
        setProfile(data);
        const [h, m] = (data.reminderTime || '20:00').split(':');
        setReminderHour(h); setReminderMin(m);
        setBilanDay(data.weeklyBilanDay ?? 1);
        setStartForm({
          weight: data.startWeight || data.weight || '',
          waist: data.startMeasurements?.waist || '',
          hips: data.startMeasurements?.hips || '',
          glutes: data.startMeasurements?.glutes || '',
          thighs: data.startMeasurements?.thighs || '',
          arms: data.startMeasurements?.arms || '',
        });
        setStartPhotos(data.startPhotos || { face: null, profile: null, back: null });
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

  async function uploadStartPhoto(file, slot) {
    const ln = (profile?.lastName || 'client').toLowerCase().replace(/\s/g, '_');
    const fn = (profile?.firstName || '').toLowerCase().replace(/\s/g, '_');
    const publicId = `fitlog/start/${fn}_${ln}_start_${slot}`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('public_id', publicId);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
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
    try {
      const url = await uploadStartPhoto(file, slot);
      setStartPhotos(p => ({ ...p, [slot]: url }));
    } catch (e) { console.error(e); }
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
    await updateDoc(doc(db, 'clients', currentUser.uid), {
      startWeight: startForm.weight ? +startForm.weight : (profile.startWeight || profile.weight),
      startMeasurements,
      startPhotos,
    });
    setProfile(p => ({ ...p, startWeight: +startForm.weight, startMeasurements, startPhotos }));
    setEditStartData(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
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
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>{profile.firstName} {(profile.lastName || '').toUpperCase()}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{profile.profession}</p>
          {profile.formule && (
            <span className={`badge ${profile.formule === 'platinium' ? 'badge-primary' : 'badge-warning'}`} style={{ marginTop: 8 }}>
              {profile.formule === 'platinium' ? '💎 Platinum' : '🥇 Gold'}
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
        {/* Mesures de départ */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editStartData ? 16 : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📐 Mesures de départ</div>
              {!editStartData && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {profile.startWeight ? `⚖️ ${profile.startWeight} kg` : '⚖️ —'}
                  {profile.startMeasurements?.waist ? ` · Taille ${profile.startMeasurements.waist} cm` : ''}
                </p>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditStartData(!editStartData)}>
              {editStartData ? 'Annuler' : profile.startMeasurements ? 'Modifier' : '+ Ajouter'}
            </button>
          </div>

          {!editStartData && profile.startMeasurements && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {MEASURE_FIELDS.map(m => (
                  <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.emoji} {m.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{profile.startMeasurements[m.key] ? `${profile.startMeasurements[m.key]} cm` : '—'}</span>
                  </div>
                ))}
              </div>
              {profile.startPhotos && (profile.startPhotos.face || profile.startPhotos.profile || profile.startPhotos.back) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {PHOTO_SLOTS.map(slot => profile.startPhotos[slot.key] && (
                    <div key={slot.key}>
                      <img src={profile.startPhotos[slot.key]} alt={slot.label} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8 }} />
                      <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)', marginTop: 4 }}>{slot.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {editStartData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label className="input-label">⚖️ Poids de départ (kg)</label>
                <input className="input" type="number" value={startForm.weight} onChange={e => setStartForm(p => ({ ...p, weight: e.target.value }))} step="0.1" placeholder="ex: 65" />
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>📏 Mensurations de départ (cm)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {MEASURE_FIELDS.map(m => (
                  <div key={m.key} className="input-group">
                    <label className="input-label">{m.emoji} {m.label}</label>
                    <input className="input" type="number" value={startForm[m.key]} onChange={e => setStartForm(p => ({ ...p, [m.key]: e.target.value }))} placeholder="cm" step="0.5" />
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>📸 Photos de départ</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {PHOTO_SLOTS.map(slot => (
                  <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div onClick={() => !uploadingSlot && fileRefs[slot.key].current.click()} style={{
                      width: '100%', aspectRatio: '3/4', borderRadius: 'var(--radius-sm)',
                      border: `2px dashed ${startPhotos[slot.key] ? 'var(--primary)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', background: 'var(--bg)',
                    }}>
                      {uploadingSlot === slot.key ? (
                        <div className="spinner" style={{ width: 24, height: 24 }} />
                      ) : startPhotos[slot.key] ? (
                        <img src={startPhotos[slot.key]} alt={slot.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 24, color: 'var(--text-light)' }}>+</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{slot.label}</div>
                        </div>
                      )}
                    </div>
                    <input ref={fileRefs[slot.key]} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleStartPhotoSelect(slot.key, e.target.files[0])} />
                    <span style={{ fontSize: 11, color: startPhotos[slot.key] ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {startPhotos[slot.key] ? '✅ ' : ''}{slot.label}
                    </span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={saveStartData} disabled={!!uploadingSlot}>
                {uploadingSlot ? 'Upload en cours...' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

      </div>

      <TabBar />
    </div>
  );
}
