// src/pages/CoachClientDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { calculateBMR, calculateTDEE } from '../utils/calculations';

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

  function setT(key, val) { setTargets(p => ({ ...p, [key]: val })); }

  const thisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (clientDoc.exists()) {
        const data = clientDoc.data();
        setClient(data);
        setTargets(data.targets || {});
      }

      const dailyQ = query(
        collection(db, 'clients', clientId, 'dailyEntries'),
        orderBy('date', 'desc'), limit(14)
      );
      const dailySnap = await getDocs(dailyQ);
      setEntries(dailySnap.docs.map(d => d.data()).reverse());

      const weeklyQ = query(
        collection(db, 'clients', clientId, 'weeklyEntries'),
        orderBy('weekStart', 'desc'), limit(8)
      );
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
          kcalPer1000Steps: +targets.kcalPer1000Steps || 80,
        }
      });
      setClient(p => ({ ...p, targets }));
      setEditTargets(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;
  if (!client) return null;

  const bmr = calculateBMR({ weight: client.weight, height: client.height, age: client.age, sex: client.sex });
  const tdee = calculateTDEE({ bmr, activityLevel: client.activityLevel });

  const latestWeekly = weeklyEntries[weeklyEntries.length - 1];
  const weightsWithDates = entries.filter(e => e.weight).map(e => ({
    date: e.date, weight: e.weight,
    dateLabel: format(new Date(e.date), 'dd/MM', { locale: fr })
  }));

  const avgCalories = entries.length ? Math.round(entries.reduce((s, e) => s + (e.calories || 0), 0) / entries.length) : 0;
  const avgSteps = entries.length ? Math.round(entries.reduce((s, e) => s + (e.steps || 0), 0) / entries.length) : 0;

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/coach" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">{client.firstName} {client.lastName}</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">
        {saved && <div className="alert alert-success">✅ Objectifs mis à jour !</div>}

        {/* Client header */}
        <div className="hero-banner" style={{ marginBottom: 20 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: 'white', flexShrink: 0
              }}>
                {client.firstName?.[0]}{client.lastName?.[0]}
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>
                  {client.firstName} {client.lastName}
                </h2>
                <p style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                  {client.profession} · {client.age} ans · {client.sex === 'F' ? 'Femme' : 'Homme'}
                </p>
                <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                  BMR {bmr} kcal · TDEE {tdee} kcal
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 14-day averages */}
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Moy. calories (14j)</div>
            <div className="stat-value">{avgCalories}<span className="stat-unit">kcal</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Moy. pas (14j)</div>
            <div className="stat-value">{avgSteps.toLocaleString()}</div>
          </div>
          {weightsWithDates.length > 0 && (
            <>
              <div className="stat-card">
                <div className="stat-label">Dernier poids</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>
                  {weightsWithDates[weightsWithDates.length - 1].weight}<span className="stat-unit">kg</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Évolution</div>
                <div className="stat-value" style={{
                  color: weightsWithDates.length > 1
                    ? (weightsWithDates[weightsWithDates.length-1].weight - weightsWithDates[0].weight) < 0
                      ? 'var(--success)' : 'var(--warning)'
                    : 'var(--text)'
                }}>
                  {weightsWithDates.length > 1
                    ? `${weightsWithDates[weightsWithDates.length-1].weight - weightsWithDates[0].weight > 0 ? '+' : ''}${(weightsWithDates[weightsWithDates.length-1].weight - weightsWithDates[0].weight).toFixed(1)}`
                    : '—'
                  }<span className="stat-unit">kg</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Weight chart */}
        {weightsWithDates.length > 1 && (
          <>
            <h2 className="section-title">Évolution poids</h2>
            <div className="card" style={{ marginBottom: 20, padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={weightsWithDates}>
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', r: 3 }} />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                    formatter={(v) => [`${v} kg`, 'Poids']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Latest weekly bilan */}
        {latestWeekly && (
          <>
            <h2 className="section-title">Dernier bilan hebdo</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Semaine du {format(new Date(latestWeekly.weekStart), 'd MMMM', { locale: fr })}
              </p>
              {/* Questionnaire results */}
              {latestWeekly.questionnaire && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {[
                    { key: 'energy', label: '⚡ Énergie' },
                    { key: 'hunger', label: '🍽️ Gestion faim' },
                    { key: 'motivation', label: '💪 Motivation' },
                    { key: 'stress', label: '🧘 Stress' },
                    { key: 'adherence', label: '🎯 Respect prog.' },
                  ].map(q => {
                    const val = latestWeekly.questionnaire[q.key];
                    return val ? (
                      <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', width: 120 }}>{q.label}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[1,2,3,4,5].map(n => (
                            <div key={n} style={{
                              width: 28, height: 28, borderRadius: 6,
                              background: n <= val
                                ? val <= 2 ? 'var(--danger)' : val === 3 ? 'var(--warning)' : 'var(--success)'
                                : 'var(--border-light)',
                            }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{val}/5</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              {/* Mensurations */}
              {latestWeekly.measurements && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(latestWeekly.measurements).filter(([,v]) => v).map(([k, v]) => (
                    <span key={k} className="badge badge-primary">
                      {k === 'waist' ? 'Taille' : k === 'hips' ? 'Hanches' : k === 'thighs' ? 'Cuisses' : k === 'arms' ? 'Bras' : 'Poitrine'} : {v} cm
                    </span>
                  ))}
                </div>
              )}
              {latestWeekly.weekHighlight && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--success-light)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--success)' }}>
                  ✨ {latestWeekly.weekHighlight}
                </div>
              )}
              {latestWeekly.weekDifficulty && (
                <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--warning-light)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--warning)' }}>
                  ⚠️ {latestWeekly.weekDifficulty}
                </div>
              )}
              {latestWeekly.weekNotes && (
                <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--primary-bg)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--primary)' }}>
                  💬 {latestWeekly.weekNotes}
                </div>
              )}
            </div>
          </>
        )}

        {/* Targets editor */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editTargets ? 20 : 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🎯 Objectifs du programme</div>
            <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setEditTargets(!editTargets)}>
              {editTargets ? 'Annuler' : 'Modifier'}
            </button>
          </div>

          {!editTargets ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {[
                { label: '🔥 Calories', value: `${targets.calories || '—'} kcal` },
                { label: '🥩 Protéines', value: `${targets.protein || '—'} g` },
                { label: '🌾 Glucides', value: `${targets.carbs || '—'} g` },
                { label: '🥑 Lipides', value: `${targets.fat || '—'} g` },
                { label: '👟 Pas', value: `${(targets.steps || 10000).toLocaleString()}` },
                { label: '😴 Sommeil', value: `${targets.sleep || 8} h` },
                { label: '⚡ kcal/1000 pas', value: `${targets.kcalPer1000Steps || 80} kcal` },
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
                  { key: 'calories', label: '🔥 Calories (kcal)', placeholder: '1800' },
                  { key: 'protein', label: '🥩 Protéines (g)', placeholder: '130' },
                  { key: 'carbs', label: '🌾 Glucides (g)', placeholder: '150' },
                  { key: 'fat', label: '🥑 Lipides (g)', placeholder: '60' },
                  { key: 'steps', label: '👟 Pas/jour', placeholder: '10000' },
                  { key: 'sleep', label: '😴 Sommeil (h)', placeholder: '8' },
                  { key: 'kcalPer1000Steps', label: '⚡ kcal/1000 pas', placeholder: '80' },
                ].map(f => (
                  <div key={f.key} className="input-group">
                    <label className="input-label" style={{ fontSize: 11 }}>{f.label}</label>
                    <input className="input" type="number" value={targets[f.key] || ''} onChange={e => setT(f.key, e.target.value)} placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={saveTargets} disabled={saving}>
                {saving ? 'Enregistrement...' : '✅ Enregistrer les objectifs'}
              </button>
            </div>
          )}
        </div>

        {/* Daily log */}
        <h2 className="section-title">Journal (14 derniers jours)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {entries.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 14 }}>
              Aucune donnée enregistrée
            </div>
          )}
          {[...entries].reverse().map(e => (
            <div key={e.date} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>
                  {format(new Date(e.date), 'EEEE d MMM', { locale: fr })}
                </span>
                {e.weight && <span className="badge badge-primary">{e.weight} kg</span>}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🔥 {e.calories || 0} kcal</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>👟 {(e.steps || 0).toLocaleString()} pas</span>
                {e.protein ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🥩 {e.protein}g prot.</span> : null}
                {e.sleep ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>😴 {e.sleep}h</span> : null}
              </div>
              {e.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>"{e.notes}"</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
