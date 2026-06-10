// src/pages/WeeklyCheckIn.js
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

const CLOUDINARY_CLOUD = 'dduaqnygn';
const CLOUDINARY_PRESET = 'fitlog_photos';

const QUESTIONNAIRE = [
  { key: 'energy', label: '⚡ Niveau d\'énergie cette semaine', min: '😴 Épuisé(e)', max: '🚀 Plein(e) d\'énergie' },
  { key: 'hunger', label: '🍽️ Gestion de la faim', min: '😫 Difficile', max: '😊 Facile' },
  { key: 'motivation', label: '💪 Motivation sportive', min: '😔 Aucune', max: '🔥 Maximale' },
  { key: 'stress', label: '🧘 Niveau de stress', min: '😰 Très stressé(e)', max: '😌 Serein(e)' },
  { key: 'adherence', label: '🎯 Respect du programme', min: '❌ Peu suivi', max: '✅ Parfaitement' },
];

const PHOTO_SLOTS = [
  { key: 'face', label: 'Face' },
  { key: 'profile', label: 'Profil' },
  { key: 'back', label: 'Dos' },
];

export default function WeeklyCheckIn({ coachMode }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [photoURLs, setPhotoURLs] = useState({ face: null, profile: null, back: null });
  const fileRefs = { face: useRef(), profile: useRef(), back: useRef() };

  const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekLabel = format(new Date(), "'Semaine du' d MMMM yyyy", { locale: fr });

  const [form, setForm] = useState({
    waist: '', hips: '', glutes: '', thighs: '', arms: '',
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
          glutes: d.measurements?.glutes || '',
          thighs: d.measurements?.thighs || '',
          arms: d.measurements?.arms || '',
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
        if (d.photoURLs) setPhotoURLs(d.photoURLs);
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid, weekKey]);

  async function uploadToCloudinary(file, slot, clientProfile) {
    const lastName = (clientProfile?.lastName || 'client').toLowerCase().replace(/\s/g, '_');
    const firstName = (clientProfile?.firstName || '').toLowerCase().replace(/\s/g, '_');
    const publicId = `fitlog/${currentUser.uid}/${weekKey}_${lastName}_${firstName}_${slot}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('public_id', publicId);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.secure_url) return data.secure_url;
    throw new Error('Upload failed');
  }

  async function handlePhotoSelect(slot, file) {
    if (!file) return;
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = e => setPhotoURLs(p => ({ ...p, [slot]: e.target.result }));
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploadingSlot(slot);
    try {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      const profile = profileDoc.exists() ? profileDoc.data() : {};
      const url = await uploadToCloudinary(file, slot, profile);
      setPhotoURLs(p => ({ ...p, [slot]: url }));
    } catch (e) {
      console.error('Upload error', e);
    }
    setUploadingSlot(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'clients', currentUser.uid, 'weeklyEntries', weekKey), {
        weekStart: weekKey,
        avgWeight: form.avgWeight ? +form.avgWeight : null,
        measurements: {
          waist: form.waist ? +form.waist : null,
          hips: form.hips ? +form.hips : null,
          glutes: form.glutes ? +form.glutes : null,
          thighs: form.thighs ? +form.thighs : null,
          arms: form.arms ? +form.arms : null,
        },
        questionnaire: {
          energy: form.energy ? +form.energy : null,
          hunger: form.hunger ? +form.hunger : null,
          motivation: form.motivation ? +form.motivation : null,
          stress: form.stress ? +form.stress : null,
          adherence: form.adherence ? +form.adherence : null,
        },
        photoURLs,
        weekNotes: form.weekNotes,
        weekHighlight: form.weekHighlight,
        weekDifficulty: form.weekDifficulty,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => {
        if (coachMode) navigate('/coach');
        else navigate('/dashboard');
      }, 1400);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  const backUrl = coachMode ? '/coach' : '/dashboard';

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to={backUrl} style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Bilan hebdomadaire</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>📅 {weekLabel}</p>
        {saved && <div className="alert alert-success">✅ Bilan enregistré !</div>}

        {/* Weight */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>⚖️ Poids moyen de la semaine</div>
          <input className="input" type="number" value={form.avgWeight} onChange={e => set('avgWeight', e.target.value)} placeholder="ex: 63.8" step="0.1" />
        </div>

        {/* Measurements */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📏 Mensurations (cm)</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Le matin, à jeun, toujours au même endroit.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'waist', label: 'Taille', emoji: '👗' },
              { key: 'hips', label: 'Hanches', emoji: '🔵' },
              { key: 'glutes', label: 'Fesses', emoji: '🍑' },
              { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
              { key: 'arms', label: 'Bras', emoji: '💪' },
            ].map(m => (
              <div key={m.key} className="input-group">
                <label className="input-label">{m.emoji} {m.label}</label>
                <input className="input" type="number" value={form[m.key]} onChange={e => set(m.key, e.target.value)} placeholder="cm" step="0.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📸 Photos de progression</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Visibles uniquement par ta coach. Upload automatique.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {PHOTO_SLOTS.map(slot => (
              <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div
                  onClick={() => !uploadingSlot && fileRefs[slot.key].current.click()}
                  style={{
                    width: '100%', aspectRatio: '3/4', borderRadius: 'var(--radius-sm)',
                    border: `2px dashed ${photoURLs[slot.key] ? 'var(--primary)' : 'var(--border)'}`,
                    background: photoURLs[slot.key] ? 'transparent' : 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: uploadingSlot ? 'wait' : 'pointer', overflow: 'hidden',
                  }}>
                  {uploadingSlot === slot.key ? (
                    <div style={{ textAlign: 'center' }}>
                      <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Upload...</div>
                    </div>
                  ) : photoURLs[slot.key] ? (
                    <img src={photoURLs[slot.key]} alt={slot.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, color: 'var(--text-light)' }}>+</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{slot.label}</div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRefs[slot.key]}
                  type="file" accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handlePhotoSelect(slot.key, e.target.files[0])}
                />
                <span style={{ fontSize: 11, color: photoURLs[slot.key] ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {photoURLs[slot.key] ? '✅ ' : ''}{slot.label}
                </span>
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
                      background: +form[q.key] === n ? n <= 2 ? 'var(--danger-light)' : n === 3 ? 'var(--warning-light)' : 'var(--success-light)' : 'white',
                      color: +form[q.key] === n ? n <= 2 ? 'var(--danger)' : n === 3 ? 'var(--warning)' : 'var(--success)' : 'var(--text-muted)',
                      fontWeight: 700, fontSize: 16, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-body)'
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

        {/* Free text */}
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
              <label className="input-label">📝 Notes pour ta coach</label>
              <textarea className="input" value={form.weekNotes} onChange={e => set('weekNotes', e.target.value)} placeholder="Tout ce que tu veux partager..." rows={3} style={{ resize: 'none' }} />
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !!uploadingSlot} style={{ marginBottom: 16 }}>
          {saving ? 'Enregistrement...' : uploadingSlot ? 'Upload en cours...' : '✅ Envoyer le bilan'}
        </button>
      </div>

      {!coachMode && (
        <nav className="tab-bar">
          <Link to="/dashboard" className="tab-item"><span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span></Link>
          <Link to="/checkin/daily" className="tab-item"><span style={{ fontSize: 20 }}>📋</span><span>Suivi</span></Link>
          <Link to="/progress" className="tab-item"><span style={{ fontSize: 20 }}>📈</span><span>Progrès</span></Link>
          <Link to="/profile" className="tab-item active"><span style={{ fontSize: 20 }}>👤</span><span>Profil</span></Link>
        </nav>
      )}
    </div>
  );
}
