// src/pages/CoachClientDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { calculateBMR, calculateTDEE, calculateAgeFromDOB } from '../utils/calculations';

export default function CoachClientDetail() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [entries, setEntries] = useState([]);
  const [weeklyEntries, setWeeklyEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTargets, setEditTargets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [targets, setTargets] = useState({});
  const [activeTab, setActiveTab] = useState('overview');

  function setT(key, val) { setTargets(p => ({ ...p, [key]: val })); }

  useEffect(() => {
    async function load() {
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (clientDoc.exists()) { const data = clientDoc.data(); setClient(data); setTargets(data.targets || {}); }

      const dailyQ = query(collection(db, 'clients', clientId, 'dailyEntries'), orderBy('date', 'desc'), limit(30));
      const dailySnap = await getDocs(dailyQ);
      setEntries(dailySnap.docs.map(d => d.data()).reverse());

      const weeklyQ = query(collection(db, 'clients', clientId, 'weeklyEntries'), orderBy('weekStart', 'desc'), limit(12));
      const weeklySnap = await getDocs(weeklyQ);
      setWeeklyEntries(weeklySnap.docs.map(d => d.data()).reverse());
      setLoading(false);
    }
    load();
  }, [clientId]);

  async function saveTargets() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        targets: {
          calories: +targets.calories || 0,
          protein: +targets.protein || 0,
          fat: +targets.fat || 0,
          carbs: +targets.carbs || 0,
          steps: +targets.steps || 10000,
          sleep: +targets.sleep || 8,
          sessionsPerWeek: +targets.sessionsPerWeek || 3,
          kcalPer1000Steps: +targets.kcalPer1000Steps || 20,
          sessionCalorieDeficit: +targets.sessionCalorieDeficit || 300,
        }
      });
      setClient(p => ({ ...p, targets }));
      setEditTargets(false); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;
  if (!client) return null;

  const age = calculateAgeFromDOB(client.dob);
  const bmr = calculateBMR({ weight: client.weight, height: client.height, age, sex: client.sex });
  const tdee = calculateTDEE({ bmr, activityLevel: client.activityLevel });

  const latestWeekly = weeklyEntries[weeklyEntries.length - 1];
  const weights = entries.filter(e => e.weight).map(e => ({
    date: e.date, weight: e.weight,
    label: format(new Date(e.date), 'dd/MM', { locale: fr })
  }));

  const firstWeight = weights.length > 0 ? weights[0].weight : null;
  const lastWeight = weights.length > 0 ? weights[weights.length - 1].weight : null;
  const weightDelta = firstWeight && lastWeight ? Math.round((lastWeight - firstWeight) * 10) / 10 : null;

  const avgCalories = entries.length ? Math.round(entries.reduce((s, e) => s + (e.calories || 0), 0) / entries.length) : 0;
  const avgSteps = entries.length ? Math.round(entries.reduce((s, e) => s + (e.steps || 0), 0) / entries.length) : 0;
  const sessionsDone = entries.filter(e => e.didProgramSession === true).length;
  const sessionsTracked = entries.filter(e => e.didProgramSession !== null && e.didProgramSession !== undefined).length;

  const tabs = [
    { key: 'overview', label: '📊 Vue générale' },
    { key: 'journal', label: '📋 Journal' },
    { key: 'bilans', label: '📅 Bilans' },
    { key: 'targets', label: '🎯 Objectifs' },
  ];

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/coach" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">{client.firstName} {client.lastName}</div>
        <div style={{ width: 24 }} />
      </div>

      {/* Client banner */}
      <div className="hero-banner" style={{ margin: '0 20px 0', borderRadius: '0 0 var(--radius) var(--radius)' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0
          }}>{client.firstName?.[0]}{client.lastName?.[0]}</div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0 }}>{client.firstName} {client.lastName}</h2>
            <p style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{client.profession} · {age} ans · {client.sex === 'F' ? 'Femme' : 'Homme'}</p>
            <p style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>BMR {bmr} kcal · TDEE {tdee} kcal</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', overflowX: 'auto', padding: '0 20px', gap: 4, marginTop: 8 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
            color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: `2px solid ${activeTab === t.key ? 'var(--primary)' : 'transparent'}`,
            transition: 'all 0.2s'
          }}>{t.label}</button>
        ))}
      </div>

      <div className="page" style={{ paddingTop: 16 }}>
        {saved && <div className="alert alert-success">✅ Objectifs mis à jour !</div>}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-label">Dernier poids</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{lastWeight || '—'}<span className="stat-unit">kg</span></div>
                {weightDelta !== null && <div style={{ fontSize: 12, marginTop: 4, color: weightDelta < 0 ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>{weightDelta > 0 ? '+' : ''}{weightDelta} kg</div>}
              </div>
              <div className="stat-card">
                <div className="stat-label">Moy. calories (30j)</div>
                <div className="stat-value">{avgCalories}<span className="stat-unit">kcal</span></div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Moy. pas (30j)</div>
                <div className="stat-value">{avgSteps.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Séances</div>
                <div className="stat-value">{sessionsTracked > 0 ? `${sessionsDone}/${sessionsTracked}` : '—'}</div>
              </div>
            </div>

            {weights.length > 1 && (
              <div className="card" style={{ marginBottom: 20, padding: '16px 8px 8px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, paddingLeft: 8 }}>📉 Évolution du poids</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={weights}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={35} />
                    <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} formatter={v => [`${v} kg`, 'Poids']} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Measurements delta */}
            {latestWeekly?.measurements && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📏 Dernières mensurations</div>
                {[
                  { key: 'waist', label: 'Taille', emoji: '👗' },
                  { key: 'hips', label: 'Hanches', emoji: '🔵' },
                  { key: 'glutes', label: 'Fesses', emoji: '🍑' },
                  { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
                  { key: 'arms', label: 'Bras', emoji: '💪' },
                ].map(m => {
                  const current = latestWeekly.measurements[m.key];
                  const prev = weeklyEntries.length >= 2 ? weeklyEntries[weeklyEntries.length - 2]?.measurements?.[m.key] : null;
                  const delta = current && prev ? Math.round((current - prev) * 10) / 10 : null;
                  return current ? (
                    <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: 14 }}>{m.emoji} {m.label}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{current} cm</span>
                        {delta !== null && <span style={{ fontSize: 12, fontWeight: 700, color: delta < 0 ? 'var(--success)' : delta > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{delta > 0 ? '+' : ''}{delta} cm</span>}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {/* Latest weekly photos */}
            {latestWeekly?.photoURLs && Object.values(latestWeekly.photoURLs).some(u => u) && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📸 Dernières photos</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[{key:'face',label:'Face'},{key:'profile',label:'Profil'},{key:'back',label:'Dos'}].map(slot => (
                    latestWeekly.photoURLs[slot.key] ? (
                      <div key={slot.key} style={{ textAlign: 'center' }}>
                        <img src={latestWeekly.photoURLs[slot.key]} alt={slot.label} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{slot.label}</div>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* JOURNAL TAB */}
        {activeTab === 'journal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Aucune donnée</div>}
            {[...entries].reverse().map(e => (
              <div key={e.date} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{format(new Date(e.date), 'EEEE d MMM', { locale: fr })}</span>
                  {e.weight && <span className="badge badge-primary">{e.weight} kg</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔥 {e.calories || 0} kcal</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👟 {(e.steps || 0).toLocaleString()}</span>
                  {e.didProgramSession !== null && e.didProgramSession !== undefined && (
                    <span style={{ fontSize: 12, color: e.didProgramSession ? 'var(--success)' : 'var(--danger)' }}>
                      {e.didProgramSession ? '✅ Séance' : '❌ Séance manquée'}
                    </span>
                  )}
                  {e.extraActivity && <span style={{ fontSize: 12, color: 'var(--primary)' }}>🏃 {e.extraActivity} (+{e.extraActivityCal} kcal)</span>}
                  {e.sleep && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>😴 {e.sleep}h</span>}
                </div>
                {e.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>"{e.notes}"</p>}
              </div>
            ))}
          </div>
        )}

        {/* BILANS TAB */}
        {activeTab === 'bilans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {weeklyEntries.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Aucun bilan</div>}
            {[...weeklyEntries].reverse().map(w => (
              <div key={w.weekStart} className="card">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                  Semaine du {format(new Date(w.weekStart), 'd MMMM', { locale: fr })}
                  {w.avgWeight && <span className="badge badge-primary" style={{ marginLeft: 8 }}>{w.avgWeight} kg</span>}
                </div>
                {w.questionnaire && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {Object.entries(w.questionnaire).filter(([,v]) => v).map(([k,v]) => (
                      <span key={k} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: v >= 4 ? 'var(--success-light)' : v <= 2 ? 'var(--danger-light)' : 'var(--warning-light)', color: v >= 4 ? 'var(--success)' : v <= 2 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                        {k === 'energy' ? '⚡' : k === 'hunger' ? '🍽️' : k === 'motivation' ? '💪' : k === 'stress' ? '🧘' : '🎯'} {v}/5
                      </span>
                    ))}
                  </div>
                )}
                {w.photoURLs && Object.values(w.photoURLs).some(u => u) && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[{key:'face',label:'Face'},{key:'profile',label:'Profil'},{key:'back',label:'Dos'}].map(slot =>
                      w.photoURLs[slot.key] ? (
                        <img key={slot.key} src={w.photoURLs[slot.key]} alt={slot.label} style={{ width: '30%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 6 }} />
                      ) : null
                    )}
                  </div>
                )}
                {w.weekHighlight && <div style={{ fontSize: 12, color: 'var(--success)', marginBottom: 4 }}>✨ {w.weekHighlight}</div>}
                {w.weekDifficulty && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 4 }}>⚠️ {w.weekDifficulty}</div>}
                {w.weekNotes && <div style={{ fontSize: 12, color: 'var(--primary)' }}>💬 {w.weekNotes}</div>}
              </div>
            ))}
          </div>
        )}

        {/* TARGETS TAB */}
        {activeTab === 'targets' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editTargets ? 20 : 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🎯 Objectifs du programme</div>
              <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditTargets(!editTargets)}>
                {editTargets ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {!editTargets ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: '🔥 Calories', value: `${targets.calories || '—'} kcal` },
                  { label: '🥩 Protéines', value: `${targets.protein || '—'} g` },
                  { label: '🌾 Glucides', value: `${targets.carbs || '—'} g` },
                  { label: '🥑 Lipides', value: `${targets.fat || '—'} g` },
                  { label: '👟 Pas', value: `${(targets.steps || 10000).toLocaleString()}` },
                  { label: '😴 Sommeil', value: `${targets.sleep || 8} h` },
                  { label: '🏋️ Séances/semaine', value: `${targets.sessionsPerWeek || 3}` },
                  { label: '⚡ kcal/1000 pas', value: `${targets.kcalPer1000Steps || 20} kcal` },
                  { label: '📉 Déficit séance manquée', value: `${targets.sessionCalorieDeficit || 300} kcal` },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontWeight: 700 }}>{r.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { key: 'calories', label: '🔥 Calories (kcal)' },
                    { key: 'protein', label: '🥩 Protéines (g)' },
                    { key: 'carbs', label: '🌾 Glucides (g)' },
                    { key: 'fat', label: '🥑 Lipides (g)' },
                    { key: 'steps', label: '👟 Pas/jour' },
                    { key: 'sleep', label: '😴 Sommeil (h)' },
                    { key: 'sessionsPerWeek', label: '🏋️ Séances/sem' },
                    { key: 'kcalPer1000Steps', label: '⚡ kcal/1000 pas' },
                    { key: 'sessionCalorieDeficit', label: '📉 Déficit séance' },
                  ].map(f => (
                    <div key={f.key} className="input-group">
                      <label className="input-label" style={{ fontSize: 11 }}>{f.label}</label>
                      <input className="input" type="number" value={targets[f.key] || ''} onChange={e => setT(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={saveTargets} disabled={saving}>
                  {saving ? 'Enregistrement...' : '✅ Enregistrer les objectifs'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
