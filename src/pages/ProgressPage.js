// src/pages/ProgressPage.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, startOfWeek, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import TabBar from '../components/TabBar';
import CoachToggle from '../components/CoachToggle';

function Delta({ value, unit = '', reverse = false }) {
  if (value === null || value === undefined || isNaN(value)) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const good = reverse ? value < 0 : value > 0;
  const color = value === 0 ? 'var(--text-muted)' : good ? 'var(--success)' : 'var(--danger)';
  return <span style={{ color, fontWeight: 700 }}>{value > 0 ? '+' : ''}{value}{unit}</span>;
}

export default function ProgressPage() {
  const { currentUser, userRole, coachMode, switchMode } = useAuth();
  const [profile, setProfile] = useState(null);
  const [dailyEntries, setDailyEntries] = useState([]);
  const [weeklyEntries, setWeeklyEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) setProfile(profileDoc.data());
      const dq = query(collection(db, 'clients', currentUser.uid, 'dailyEntries'), orderBy('date', 'asc'), limit(90));
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

  // ── Poids ──
  const weights = dailyEntries.filter(e => e.weight).map(e => ({
    date: e.date, label: format(new Date(e.date), 'dd/MM', { locale: fr }), weight: e.weight,
  }));
  const startWeight = profile?.startWeight || (weights.length > 0 ? weights[0].weight : null);
  const lastWeight = weights.length > 0 ? weights[weights.length - 1].weight : null;
  const weightDelta = startWeight && lastWeight ? +(lastWeight - startWeight).toFixed(1) : null;

  // ── Moyenne poids de la semaine (depuis le dernier bilan) ──
  const lastBilan = weeklyEntries.length > 0 ? weeklyEntries[weeklyEntries.length - 1] : null;
  const lastBilanDate = lastBilan?.weekStart || null;
  const weekWeights = dailyEntries.filter(e => e.weight && (!lastBilanDate || e.date >= lastBilanDate));
  const avgWeightSinceBilan = weekWeights.length > 0
    ? +(weekWeights.reduce((s, e) => s + e.weight, 0) / weekWeights.length).toFixed(1)
    : null;

  // ── Séances ──
  const sessionsDone = dailyEntries.filter(e => e.didProgramSession === true).length;
  const sessionsTotal = dailyEntries.filter(e => e.didProgramSession !== null && e.didProgramSession !== undefined).length;
  const sessionRate = sessionsTotal > 0 ? Math.round((sessionsDone / sessionsTotal) * 100) : null;

  // ── Entre les 2 derniers bilans ──
  const prevBilan = weeklyEntries.length >= 2 ? weeklyEntries[weeklyEntries.length - 2] : null;

  const weightBilanDelta = lastBilan?.avgWeight && prevBilan?.avgWeight
    ? +(lastBilan.avgWeight - prevBilan.avgWeight).toFixed(1)
    : lastBilan?.avgWeight && startWeight
    ? +(lastBilan.avgWeight - startWeight).toFixed(1)
    : null;

  const measKeys = [
    { key: 'waist', label: 'Taille', emoji: '👗' },
    { key: 'hips', label: 'Hanches', emoji: '🔵' },
    { key: 'glutes', label: 'Fesses', emoji: '🍑' },
    { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
    { key: 'arms', label: 'Bras', emoji: '💪' },
  ];

  // Progression entre 2 derniers bilans (ou départ → dernier bilan)
  const measProgress = measKeys.map(m => {
    const current = lastBilan?.measurements?.[m.key] || null;
    const previous = prevBilan?.measurements?.[m.key] || profile?.startMeasurements?.[m.key] || null;
    const start = profile?.startMeasurements?.[m.key] || null;
    const delta = current && previous ? +(current - previous).toFixed(1) : null;
    const deltaFromStart = current && start ? +(current - start).toFixed(1) : null;
    return { ...m, current, previous, delta, deltaFromStart, start };
  });

  // ── Évolution du poids depuis le dernier bilan ──
  const weightsSinceBilan = weights.filter(w => !lastBilanDate || w.date >= lastBilanDate);

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Mes progrès</div>
        {userRole === 'coach' && <CoachToggle mode={coachMode} onSwitch={() => switchMode()} />}
      </div>

      <div className="page">

        {/* ── CHIFFRES CLÉS ── */}
        <h2 className="section-title">Chiffres clés</h2>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Poids actuel</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{lastWeight || '—'}<span className="stat-unit">kg</span></div>
            {weightDelta !== null && <div style={{ marginTop: 4, fontSize: 12 }}><Delta value={weightDelta} unit=" kg" reverse /></div>}
          </div>
          <div className="stat-card">
            <div className="stat-label">Moy. semaine</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{avgWeightSinceBilan || '—'}<span className="stat-unit">kg</span></div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>depuis dernier bilan</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Perdu depuis début</div>
            <div className="stat-value" style={{ color: weightDelta !== null && weightDelta < 0 ? 'var(--success)' : 'var(--danger)' }}>
              {weightDelta !== null ? Math.abs(weightDelta) : '—'}<span className="stat-unit">kg</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {weightDelta !== null ? (weightDelta < 0 ? '📉 perdu' : '📈 pris') : ''}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Séances faites</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{sessionsDone}</div>
            {sessionRate !== null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sessionRate}% de présence</div>}
          </div>
          <div className="stat-card">
            <div className="stat-label">Bilans</div>
            <div className="stat-value">{weeklyEntries.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>enregistrés</div>
          </div>
        </div>

        {/* ── PROGRÈS ENTRE LES 2 DERNIERS BILANS ── */}
        {lastBilan && (
          <>
            <h2 className="section-title">
              Entre les bilans
              {prevBilan ? ` (${format(new Date(prevBilan.weekStart), 'd MMM', { locale: fr })} → ${format(new Date(lastBilan.weekStart), 'd MMM', { locale: fr })})` : ' (depuis le début)'}
            </h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {/* Poids */}
              {lastBilan.avgWeight && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>⚖️ Poids moy.</span>
                    {prevBilan?.avgWeight && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>avant : {prevBilan.avgWeight} kg</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{lastBilan.avgWeight} kg</div>
                    {weightBilanDelta !== null && <div style={{ fontSize: 12 }}><Delta value={weightBilanDelta} unit=" kg" reverse /></div>}
                  </div>
                </div>
              )}
              {/* Mensurations */}
              {measProgress.filter(m => m.current).map((m, i, arr) => (
                <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.filter(x => x.current).length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{m.emoji} {m.label}</span>
                    {m.previous && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>avant : {m.previous} cm</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{m.current} cm</div>
                    {m.delta !== null && <div style={{ fontSize: 12 }}><Delta value={m.delta} unit=" cm" reverse /></div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── PROGRÈS DEPUIS LE DÉBUT ── */}
        {(profile?.startWeight || profile?.startMeasurements) && lastBilan && (
          <>
            <h2 className="section-title">Depuis le début</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {profile.startWeight && lastWeight && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>⚖️ Poids</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>départ : {profile.startWeight} kg</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{lastWeight} kg</div>
                    <div style={{ fontSize: 12 }}><Delta value={weightDelta} unit=" kg" reverse /></div>
                  </div>
                </div>
              )}
              {measProgress.filter(m => m.current && m.start).map((m, i, arr) => (
                <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.filter(x => x.current && x.start).length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{m.emoji} {m.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>départ : {m.start} cm</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{m.current} cm</div>
                    {m.deltaFromStart !== null && <div style={{ fontSize: 12 }}><Delta value={m.deltaFromStart} unit=" cm" reverse /></div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ÉVOLUTION DU POIDS depuis le dernier bilan ── */}
        {weightsSinceBilan.length > 1 && (
          <>
            <h2 className="section-title">Évolution du poids{lastBilanDate ? ` (depuis le ${format(new Date(lastBilanDate), 'd MMM', { locale: fr })})` : ''}</h2>
            <div className="card" style={{ marginBottom: 20, padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={weightsSinceBilan}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={35} />
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v} kg`]} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Vide */}
        {dailyEntries.length === 0 && weeklyEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <p>Commence à remplir ton suivi quotidien pour voir tes progrès ici !</p>
          </div>
        )}
      </div>
      <TabBar />
    </div>
  );
}
