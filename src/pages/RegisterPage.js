// src/pages/RegisterPage.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacros, ACTIVITY_LEVELS, GOALS } from '../utils/calculations';

const STEPS = ['Compte', 'Identité', 'Mesures', 'Objectifs', 'Résumé'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', sex: 'F',
    age: '', profession: '',
    weight: '', height: '',
    activityLevel: 'actif',
    goal: 'seche',
    stepGoal: 10000, sleepGoal: 8,
    reminderHour: '20', reminderMinute: '00',
  });

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function nextStep() { setError(''); setStep(s => s + 1); }
  function prevStep() { setStep(s => s - 1); }

  function validateStep() {
    if (step === 0) {
      if (!form.email || !form.password || !form.confirmPassword) return 'Tous les champs sont requis';
      if (form.password.length < 6) return 'Mot de passe trop court (min. 6 caractères)';
      if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas';
    }
    if (step === 1) {
      if (!form.firstName || !form.lastName || !form.age) return 'Tous les champs sont requis';
    }
    if (step === 2) {
      if (!form.weight || !form.height) return 'Poids et taille sont requis';
      if (form.weight < 30 || form.weight > 250) return 'Poids invalide';
      if (form.height < 100 || form.height > 250) return 'Taille invalide';
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) { setError(err); return; }
    nextStep();
  }

  function getCalcs() {
    const bmr = calculateBMR({ weight: +form.weight, height: +form.height, age: +form.age, sex: form.sex });
    const tdee = calculateTDEE({ bmr, activityLevel: form.activityLevel });
    const calorieTarget = calculateCalorieTarget({ tdee, goal: form.goal });
    const macros = calculateMacros({ weight: +form.weight, calorieTarget, goal: form.goal });
    return { bmr, tdee, calorieTarget, macros };
  }

  async function handleSubmit() {
    setError(''); setLoading(true);
    try {
      const { bmr, tdee, calorieTarget, macros } = getCalcs();
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = cred.user.uid;

      await setDoc(doc(db, 'clients', uid), {
        uid,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        sex: form.sex,
        age: +form.age,
        profession: form.profession,
        weight: +form.weight,
        height: +form.height,
        activityLevel: form.activityLevel,
        goal: form.goal,
        bmr, tdee,
        // Coach sets these, but default values to start
        targets: {
          calories: calorieTarget,
          protein: macros.protein,
          fat: macros.fat,
          carbs: macros.carbs,
          steps: +form.stepGoal,
          sleep: +form.sleepGoal,
          kcalPer1000Steps: 80,
        },
        reminderTime: `${form.reminderHour}:${form.reminderMinute}`,
        createdAt: serverTimestamp(),
      });

      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Cet email est déjà utilisé');
      else setError('Erreur lors de l\'inscription');
    }
    setLoading(false);
  }

  const calcs = step === 4 ? getCalcs() : null;

  return (
    <div className="app-shell" style={{ minHeight: '100vh', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        {step > 0 && (
          <button onClick={prevStep} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '8px' }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
            {STEPS[step]}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            Étape {step + 1} sur {STEPS.length}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar" style={{ marginBottom: 32 }}>
        <div className="progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Step 0 — Compte */}
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

      {/* Step 1 — Identité */}
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
                <button key={s} type="button"
                  onClick={() => set('sex', s)}
                  style={{
                    padding: '14px', borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${form.sex === s ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.sex === s ? 'var(--primary-bg)' : 'white',
                    color: form.sex === s ? 'var(--primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                  {s === 'F' ? '👩 Femme' : '👨 Homme'}
                </button>
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Âge</label>
            <input className="input" type="number" value={form.age} onChange={e => set('age', e.target.value)} placeholder="Ton âge" min="15" max="80" />
          </div>
          <div className="input-group">
            <label className="input-label">Profession</label>
            <input className="input" value={form.profession} onChange={e => set('profession', e.target.value)} placeholder="Ton métier" />
          </div>
        </div>
      )}

      {/* Step 2 — Mesures */}
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
                <button key={l.value} type="button"
                  onClick={() => set('activityLevel', l.value)}
                  style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${form.activityLevel === l.value ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.activityLevel === l.value ? 'var(--primary-bg)' : 'white',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.2s'
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: form.activityLevel === l.value ? 'var(--primary)' : 'var(--text)' }}>
                    {l.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{l.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Objectifs */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">Objectif</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOALS.map(g => (
                <button key={g.value} type="button"
                  onClick={() => set('goal', g.value)}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${form.goal === g.value ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.goal === g.value ? 'var(--primary-bg)' : 'white',
                    fontFamily: 'var(--font-body)', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.2s'
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
              <label className="input-label">Objectif sommeil (h)</label>
              <input className="input" type="number" value={form.sleepGoal} onChange={e => set('sleepGoal', e.target.value)} min="5" max="12" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Heure du rappel quotidien</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="input" type="number" value={form.reminderHour} onChange={e => set('reminderHour', e.target.value.padStart(2,'0'))} min="0" max="23" placeholder="Heure (20)" />
              <input className="input" type="number" value={form.reminderMinute} onChange={e => set('reminderMinute', e.target.value.padStart(2,'0'))} min="0" max="59" placeholder="Min (00)" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Tu recevras un rappel à {form.reminderHour}h{form.reminderMinute} pour remplir ton suivi
            </p>
          </div>
        </div>
      )}

      {/* Step 4 — Résumé */}
      {step === 4 && calcs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="hero-banner">
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Bonjour,</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>
              {form.firstName} {form.lastName} 👋
            </h2>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Voici ton programme personnalisé</p>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">BMR</div>
              <div className="stat-value">{calcs.bmr}<span className="stat-unit">kcal</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">TDEE</div>
              <div className="stat-value">{calcs.tdee}<span className="stat-unit">kcal</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Objectif calorique</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{calcs.calorieTarget}<span className="stat-unit">kcal</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pas / jour</div>
              <div className="stat-value">{(+form.stepGoal).toLocaleString()}</div>
            </div>
          </div>

          <div className="card">
            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Macros quotidiennes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Protéines', value: calcs.macros.protein, unit: 'g', color: '#7C3AED' },
                { label: 'Glucides', value: calcs.macros.carbs, unit: 'g', color: '#EC4899' },
                { label: 'Lipides', value: calcs.macros.fat, unit: 'g', color: '#F59E0B' },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />
                    <span style={{ fontSize: 14 }}>{m.label}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: m.color }}>{m.value}g</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            ⚡ Ton coach pourra ajuster ces valeurs selon ta progression
          </p>
        </div>
      )}

      {/* Navigation */}
      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {step < 4 ? (
          <button className="btn btn-primary" type="button" onClick={handleNext}>
            Continuer →
          </button>
        ) : (
          <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Création du compte...' : '🚀 Commencer mon programme'}
          </button>
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
