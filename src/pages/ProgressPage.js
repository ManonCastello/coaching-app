// src/pages/ProgressPage.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

function Delta({ value, unit = '', reverse = false }) {
  if (value === null || value === undefined || isNaN(value)) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const positive = reverse ? value < 0 : value > 0;
  const color = value === 0 ? 'var(--text-muted)' : positive ? 'var(--success)' : 'var(--danger)';
  return <span style={{ color, fontWeight: 700 }}>{value > 0 ? '+' : ''}{value}{unit}</span>;
}

export default function ProgressPage({ coachMode }) {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [dailyEntries, setDailyEntries] = useState([]);
  const [weeklyEntries, setWeeklyEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) setProfile(profileDoc.data());

      const dq = query(collection(db, 'clients', currentUser.uid, 'dailyEntries'), orderBy('date', 'asc'), limit(60));
      const dsnap = await getDocs(dq);
      setDailyEntries(dsnap.docs.map(d => d.data()));

      const wq = query(collection(db, 'clients', currentUser.uid, 'weeklyEntries'), orderBy('weekStart', 'asc'), limit(16));
      const wsnap = await getDocs(wq);
      setWeeklyEntries(wsnap.docs.map(d => d.data()));

      setLoading(false);
    }
    load();
  }, [currentUser.uid]);

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  const weights = dailyEntries.filter(e => e.weight).map(e => ({
    date: e.date,
    label: format(new Date(e.date), 'dd/MM', { locale: fr }),
    weight: e.weight,
  }));

  const firstWeight = weights.length > 0 ? weights[0].weight : null;
  const lastWeight = weights.length > 0 ? weights[weights.length - 1].weight : null;
  const weightDelta = firstWeight && lastWeight ? Math.round((lastWeight - firstWeight) * 10) / 10 : null;

  // Measurements over time from weekly entries
  const measKeys = [
    { key: 'waist', label: 'Taille', emoji: '👗' },
    { key: 'hips', label: 'Hanches', emoji: '🔵' },
    { key: 'glutes', label: 'Fesses', emoji: '🍑' },
    { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
    { key: 'arms', label: 'Bras', emoji: '💪' },
  ];

  const measDeltas = measKeys.map(m => {
    const vals = weeklyEntries.filter(e => e.measurements?.[m.key]).map(e => e.measurements[m.key]);
    const delta = vals.length >= 2 ? Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10 : null;
    const current = vals.length > 0 ? vals[vals.length - 1] : null;
    return { ...m, delta, current };
  });

  // Sessions compliance
  const totalDays = dailyEntries.filter(e => e.didProgramSession !== null && e.didProgramSession !== undefined).length;
  const doneSessions = dailyEntries.filter(e => e.didProgramSession === true).length;
  const sessionRate = totalDays > 0 ? Math.round((doneSessions / totalDays) * 100) : null;

  // Weekly questionnaire averages
  const qKeys = ['energy', 'hunger', 'motivation', 'stress', 'adherence'];
  const qLabels = { energy: '⚡ Énergie', hunger: '🍽️ Faim', motivation: '💪 Motivation', stress: '🧘 Stress', adherence: '🎯 Adhérence' };
  const qAverages = qKeys.map(k => {
    const vals = weeklyEntries.filter(e => e.questionnaire?.[k]).map(e => e.questionnaire[k]);
    return { key: k, label: qLabels[k], avg: vals.length > 0 ? Math.round((vals.reduce((a,b) => a+b,0) / vals.length) * 10) / 10 : null };
  });

  const backUrl = coachMode ? '/coach' : '/dashboard';

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to={backUrl} style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Mes progrès</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">
        {/* Key numbers */}
        <h2 className="section-title">Chiffres clés</h2>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Poids actuel</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{lastWeight || '—'}<span className="stat-unit">kg</span></div>
            {weightDelta !== null && <div style={{ marginTop: 4, fontSize: 12 }}><Delta value={weightDelta} unit=" kg" reverse /></div>}
          </div>
          <div className="stat-card">
            <div className="stat-label">Depuis le début</div>
            <div className="stat-value">{weightDelta !== null ? Math.abs(weightDelta) : '—'}<span className="stat-unit">kg</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {weightDelta !== null ? (weightDelta < 0 ? '📉 perdu' : '📈 pris') : ''}
            </div>
          </div>
          {sessionRate !== null && (
            <div className="stat-card">
              <div className="stat-label">Séances réalisées</div>
              <div className="stat-value" style={{ color: sessionRate >= 80 ? 'var(--success)' : 'var(--warning)' }}>{sessionRate}<span className="stat-unit">%</span></div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-label">Bilans enregistrés</div>
            <div className="stat-value">{weeklyEntries.length}</div>
          </div>
        </div>

        {/* Weight chart */}
        {weights.length > 1 && (
          <>
            <h2 className="section-title">Évolution du poids</h2>
            <div className="card" style={{ marginBottom: 20, padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={weights}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={35} />
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: 'var(--primary)' }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} formatter={v => [`${v} kg`, 'Poids']} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Measurements deltas */}
        {measDeltas.some(m => m.delta !== null) && (
          <>
            <h2 className="section-title">Évolution des mensurations</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {measDeltas.filter(m => m.current !== null).map(m => (
                <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: 14 }}>{m.emoji} {m.label}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{m.current} cm</span>
                    {m.delta !== null && <Delta value={m.delta} unit=" cm" reverse />}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Weekly questionnaire averages */}
        {qAverages.some(q => q.avg !== null) && (
          <>
            <h2 className="section-title">Moyennes des bilans</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {qAverages.filter(q => q.avg !== null).map(q => (
                <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{q.label}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1,2,3,4,5].map(n => (
                      <div key={n} style={{
                        width: 24, height: 24, borderRadius: 4,
                        background: n <= Math.round(q.avg)
                          ? q.avg <= 2 ? 'var(--danger)' : q.avg <= 3 ? 'var(--warning)' : 'var(--success)'
                          : 'var(--border-light)',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, minWidth: 28 }}>{q.avg}/5</span>
                </div>
              ))}
            </div>
          </>
        )}

        {weights.length === 0 && weeklyEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <p>Commence à remplir ton suivi quotidien pour voir tes progrès apparaître ici !</p>
          </div>
        )}
      </div>

      {!coachMode && (
        <nav className="tab-bar">
          <Link to="/dashboard" className="tab-item"><span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span></Link>
          <Link to="/checkin/daily" className="tab-item"><span style={{ fontSize: 20 }}>📋</span><span>Suivi</span></Link>
          <Link to="/progress" className="tab-item active"><span style={{ fontSize: 20 }}>📈</span><span>Progrès</span></Link>
          <Link to="/profile" className="tab-item"><span style={{ fontSize: 20 }}>👤</span><span>Profil</span></Link>
        </nav>
      )}
    </div>
  );
}
