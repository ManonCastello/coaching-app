// src/pages/RegisterPage.js
import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacros, calculateAgeFromDOB, ACTIVITY_LEVELS, GOALS, WEEK_DAYS } from '../utils/calculations';

const CLOUDINARY_CLOUD = 'dduaqnygn';
const CLOUDINARY_PRESET = 'fitlog_photos';

const STEPS = ['Compte', 'Identité', 'Mesures', 'Objectifs', 'Résumé', 'Départ'];

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [startPhotoURLs, setStartPhotoURLs] = useState({ face: null, profile: null, back: null });
  const fileRefs = { face: useRef(), profile: useRef(), back: useRef() };

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', sex: 'F',
    dob: '', profession: '',
    weight: '', height: '',
    activityLevel: 'actif',
    goal: 'seche',
    stepGoal: 10000, sleepGoal: 8, sessionsPerWeek: 3,
    reminderHour: '20', reminderMinute: '00',
    weeklyBilanDay: 1,
    coachingMode: 'tracking', // 'tracking' | 'intuitif'
    // Départ
    startWaist: '', startHips: '', startGlutes: '', startThighs: '', startArms: '',
  });

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })); }
  function nextStep() { setError(''); setStep(s => s + 1); }
  function prevStep() { setStep(s => s - 1); }

  function validateStep() {
    if (step === 0) {
      if (!form.email || !form.password || !form.confirmPassword) return 'Tous les champs sont requis';
      if (form.password.length < 6) return 'Mot de passe trop court (min. 6 caractères)';
      if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas';
    }
    if (step === 1) {
      if (!form.firstName || !form.lastName || !form.dob) return 'Tous les champs sont requis';
    }
    if (step === 2) {
      if (!form.weight || !form.height) return 'Poids et taille sont requis';
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) { setError(err); return; }
    nextStep();
  }

  function getCalcs() {
    const age = calculateAgeFromDOB(form.dob);
    const bmr = calculateBMR({ weight: +form.weight, height: +form.height, age, sex: form.sex });
    const tdee = calculateTDEE({ bmr, activityLevel: form.activityLevel });
    const calorieTarget = calculateCalorieTarget({ tdee, goal: form.goal });
    const macros = calculateMacros({ weight: +form.weight, calorieTarget, goal: form.goal });
    return { bmr, tdee, calorieTarget, macros };
  }

  async function uploadStartPhoto(file, slot, firstName, lastName) {
    const ln = (lastName || 'client').toLowerCase().replace(/\s/g, '_');
    const fn = (firstName || '').toLowerCase().replace(/\s/g, '_');
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

  async function handlePhotoSelect(slot, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setStartPhotoURLs(p => ({ ...p, [slot]: e.target.result }));
    reader.readAsDataURL(file);
    setUploadingSlot(slot);
    try {
      const url = await uploadStartPhoto(file, slot, form.firstName, form.lastName);
      setStartPhotoURLs(p => ({ ...p, [slot]: url }));
    } catch (e) { console.error('Upload error', e); }
    setUploadingSlot(null);
  }

  async function handleSubmit() {
    setError(''); setLoading(true);
    try {
      const { bmr, tdee, calorieTarget, macros } = getCalcs();
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = cred.user.uid;

      const startMeasurements = {
        waist: form.startWaist ? +form.startWaist : null,
        hips: form.startHips ? +form.startHips : null,
        glutes: form.startGlutes ? +form.startGlutes : null,
        thighs: form.startThighs ? +form.startThighs : null,
        arms: form.startArms ? +form.startArms : null,
      };
      const hasAnyMeasure = Object.values(startMeasurements).some(v => v !== null);

      await setDoc(doc(db, 'clients', uid), {
        uid, email: form.email,
        firstName: form.firstName, lastName: form.lastName,
        sex: form.sex, dob: form.dob, profession: form.profession,
        weight: +form.weight, height: +form.height,
        startWeight: +form.weight,
        startMeasurements: hasAnyMeasure ? startMeasurements : null,
        startPhotos: (startPhotoURLs.face || startPhotoURLs.profile || startPhotoURLs.back) ? startPhotoURLs : null,
        activityLevel: form.activityLevel, goal: form.goal,
        bmr, tdee,
        targets: {
          calories: calorieTarget,
          protein: macros.protein, fat: macros.fat, carbs: macros.carbs,
          steps: +form.stepGoal, sleep: +form.sleepGoal,
          sessionsPerWeek: +form.sessionsPerWeek,
          kcalPer1000Steps: 20,
          sessionCalorieDeficit: 300,
        },
        reminderTime: `${form.reminderHour}:${form.reminderMinute}`,
        weeklyBilanDay: +form.weeklyBilanDay,
        coachingMode: form.coachingMode || 'tracking',
        createdAt: serverTimestamp(),
      });
      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Cet email est déjà utilisé');
      else setError('Erreur lors de l\'inscription');
    }
    setLoading(false);
  }

  async function handleSkipAndSubmit() {
    await handleSubmit();
  }

  const calcs = step === 4 ? getCalcs() : null;
  const isLastRealStep = step === 4;
  const isStartStep = step === 5;

  return (
    <div className="app-shell" style={{ minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        {step > 0 && (
          <button onClick={prevStep} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '8px' }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>{STEPS[step]}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>Étape {step + 1} sur {STEPS.length}</p>
        </div>
      </div>

      <div className="progress-bar" style={{ marginBottom: 32 }}>
        <div className="progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ÉTAPE 0 — Compte */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ton@email.com" />
          </div>
          <div className="input-group">
            <label className="input-label">Mot de passe</label>
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 6 caractères" />
          </div>
          <div className="input-group">
            <label className="input-label">Confirmer le mot de passe</label>
            <input className="input" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="••••••••" />
          </div>
        </div>
      )}

      {/* ÉTAPE 1 — Identité */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Prénom</label>
              <input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Prénom" />
            </div>
            <div className="input-group">
              <label className="input-label">Nom</label>
              <input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Nom" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Sexe</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['F', 'H'].map(s => (
                <button key={s} type="button" onClick={() => set('sex', s)} style={{
                  padding: '14px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${form.sex === s ? 'var(--primary)' : 'var(--border)'}`,
                  background: form.sex === s ? 'var(--primary-bg)' : 'white',
                  color: form.sex === s ? 'var(--primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                }}>{s === 'F' ? '👩 Femme' : '👨 Homme'}</button>
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Date de naissance</label>
            <input className="input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Profession</label>
            <input className="input" value={form.profession} onChange={e => set('profession', e.target.value)} placeholder="Ton métier" />
          </div>
        </div>
      )}

      {/* ÉTAPE 2 — Mesures */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Poids (kg)</label>
              <input className="input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="ex: 65" step="0.1" />
            </div>
            <div className="input-group">
              <label className="input-label">Taille (cm)</label>
              <input className="input" type="number" value={form.height} onChange={e => set('height', e.target.value)} placeholder="ex: 165" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Niveau d'activité</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ACTIVITY_LEVELS.map(l => (
                <button key={l.value} type="button" onClick={() => set('activityLevel', l.value)} style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${form.activityLevel === l.value ? 'var(--primary)' : 'var(--border)'}`,
                  background: form.activityLevel === l.value ? 'var(--primary-bg)' : 'white',
                  color: 'var(--text)', fontFamily: 'var(--font-body)', cursor: 'pointer',
                  textAlign: 'left', transition: 'all 0.2s'
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: form.activityLevel === l.value ? 'var(--primary)' : 'var(--text)' }}>{l.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{l.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 — Objectifs */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mode de suivi */}
          <div className="input-group">
            <label className="input-label">Comment tu veux suivre ton alimentation ?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { value: 'tracking', label: '📊 Avec comptage', desc: 'Tu notes tes calories et macros dans MyFitnessPal chaque jour.' },
                { value: 'intuitif', label: '🎯 Sans comptage', desc: "Tu suis des objectifs par repas fixés par ta coach — sans compter les calories." },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => set('coachingMode', opt.value)} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-sm)', textAlign: 'left', cursor: 'pointer',
                  border: `2px solid ${form.coachingMode === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                  background: form.coachingMode === opt.value ? 'var(--primary-bg)' : 'white',
                  fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                }}>
                  <div style={{ fontWeight: 700, color: form.coachingMode === opt.value ? 'var(--primary)' : 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Objectif</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOALS.map(g => (
                <button key={g.value} type="button" onClick={() => set('goal', g.value)} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${form.goal === g.value ? 'var(--primary)' : 'var(--border)'}`,
                  background: form.goal === g.value ? 'var(--primary-bg)' : 'white',
                  fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                }}>
                  <div style={{ fontWeight: 700, color: form.goal === g.value ? 'var(--primary)' : 'var(--text)' }}>{g.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{g.description}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Objectif pas/jour</label>
              <input className="input" type="number" value={form.stepGoal} onChange={e => set('stepGoal', e.target.value)} step="1000" />
            </div>
            <div className="input-group">
              <label className="input-label">Séances/semaine</label>
              <input className="input" type="number" value={form.sessionsPerWeek} onChange={e => set('sessionsPerWeek', e.target.value)} min="1" max="7" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Jour du bilan hebdomadaire</label>
            <select className="input" value={form.weeklyBilanDay} onChange={e => set('weeklyBilanDay', +e.target.value)}>
              {WEEK_DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Heure du rappel quotidien</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="input" type="number" value={form.reminderHour} onChange={e => set('reminderHour', e.target.value.padStart(2,'0'))} min="0" max="23" placeholder="Heure (20)" />
              <input className="input" type="number" value={form.reminderMinute} onChange={e => set('reminderMinute', e.target.value.padStart(2,'0'))} min="0" max="59" placeholder="Min (00)" />
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 4 — Résumé */}
      {step === 4 && calcs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="hero-banner">
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Bonjour,</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>{form.firstName} {form.lastName} 👋</h2>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Voici ton programme personnalisé</p>
          </div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-label">BMR</div><div className="stat-value">{calcs.bmr}<span className="stat-unit">kcal</span></div></div>
            <div className="stat-card"><div className="stat-label">TDEE</div><div className="stat-value">{calcs.tdee}<span className="stat-unit">kcal</span></div></div>
            <div className="stat-card"><div className="stat-label">Objectif calorique</div><div className="stat-value" style={{ color: 'var(--primary)' }}>{calcs.calorieTarget}<span className="stat-unit">kcal</span></div></div>
            <div className="stat-card"><div className="stat-label">Pas / jour</div><div className="stat-value">{(+form.stepGoal).toLocaleString()}</div></div>
          </div>
          <div className="card">
            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Macros quotidiennes</div>
            {[
              { label: 'Protéines', value: calcs.macros.protein, color: '#7C3AED' },
              { label: 'Glucides', value: calcs.macros.carbs, color: '#EC4899' },
              { label: 'Lipides', value: calcs.macros.fat, color: '#F59E0B' },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />
                  <span style={{ fontSize: 14 }}>{m.label}</span>
                </div>
                <span style={{ fontWeight: 700, color: m.color }}>{m.value}g</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ÉTAPE 5 — Mesures & photos de départ (optionnelle) */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ background: 'var(--primary-bg)', border: '1.5px solid var(--primary-light)', marginBottom: 4 }}>
            <p style={{ fontSize: 13, color: 'var(--primary)', lineHeight: 1.6 }}>
              📍 Cette étape est <strong>optionnelle</strong>. Tu peux la passer maintenant et remplir ces infos plus tard depuis ton profil. Mais plus tu remplis maintenant, plus on pourra mesurer ta progression dès le début.
            </p>
          </div>

          {/* Poids de départ — pré-rempli */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>⚖️ Poids de départ</div>
            <div className="input-group">
              <label className="input-label">Poids initial (kg)</label>
              <input className="input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} step="0.1" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Pré-rempli depuis l'étape précédente. Tu peux ajuster si besoin.</p>
          </div>

          {/* Mensurations de départ */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📏 Mensurations de départ (cm)</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>À prendre le matin, à jeun, au même endroit.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {MEASURE_FIELDS.map(m => (
                <div key={m.key} className="input-group">
                  <label className="input-label">{m.emoji} {m.label}</label>
                  <input className="input" type="number" value={form[`start${m.key.charAt(0).toUpperCase() + m.key.slice(1)}`]} onChange={e => set(`start${m.key.charAt(0).toUpperCase() + m.key.slice(1)}`, e.target.value)} placeholder="cm" step="0.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Photos de départ */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📸 Photos de départ</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Visibles uniquement par ta coach. Servent de référence de départ pour mesurer ta progression.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {PHOTO_SLOTS.map(slot => (
                <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    onClick={() => !uploadingSlot && fileRefs[slot.key].current.click()}
                    style={{
                      width: '100%', aspectRatio: '3/4', borderRadius: 'var(--radius-sm)',
                      border: `2px dashed ${startPhotoURLs[slot.key] ? 'var(--primary)' : 'var(--border)'}`,
                      background: startPhotoURLs[slot.key] ? 'transparent' : 'var(--bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: uploadingSlot ? 'wait' : 'pointer', overflow: 'hidden',
                    }}>
                    {uploadingSlot === slot.key ? (
                      <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Upload...</div>
                      </div>
                    ) : startPhotoURLs[slot.key] ? (
                      <img src={startPhotoURLs[slot.key]} alt={slot.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, color: 'var(--text-light)' }}>+</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{slot.label}</div>
                      </div>
                    )}
                  </div>
                  <input ref={fileRefs[slot.key]} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoSelect(slot.key, e.target.files[0])} />
                  <span style={{ fontSize: 11, color: startPhotoURLs[slot.key] ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {startPhotoURLs[slot.key] ? '✅ ' : ''}{slot.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Boutons */}
      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {step < 4 && (
          <button className="btn btn-primary" type="button" onClick={handleNext}>Continuer →</button>
        )}
        {step === 4 && (
          <button className="btn btn-primary" type="button" onClick={nextStep}>Continuer → Mesures de départ</button>
        )}
        {step === 5 && (
          <>
            <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={loading || !!uploadingSlot}>
              {loading ? 'Création du compte...' : uploadingSlot ? 'Upload en cours...' : '🚀 Commencer mon programme'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={handleSkipAndSubmit} disabled={loading}>
              Passer cette étape →
            </button>
          </>
        )}
        {step === 0 && (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            Déjà un compte ? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Se connecter</Link>
          </p>
        )}
      </div>
    </div>
  );
}
