// src/pages/ClientDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { format, getDay, startOfWeek, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import TabBar from '../components/TabBar';
import { getTargetsForDate } from '../utils/getTargetsForDate';
import CoachToggle from '../components/CoachToggle';

export default function ClientDashboard() {
  const { currentUser, logout, userRole, coachMode, switchMode } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [todayEntry, setTodayEntry] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [weeklyToday, setWeeklyToday] = useState(false);
  const [weekBalance, setWeekBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayDayOfWeek = getDay(new Date());
  const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  async function loadData() {
    const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
    if (!profileDoc.exists()) { setLoading(false); return; }
    const p = profileDoc.data();
    setProfile(p);

    // Check if today is bilan day and not done yet
    if (p.weeklyBilanDay !== undefined && p.weeklyBilanDay === todayDayOfWeek) {
      const weekDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'weeklyEntries', weekKey));
      setWeeklyToday(!weekDoc.exists());
    }

    // Today entry
    const todayDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', today));
    if (todayDoc.exists()) setTodayEntry(todayDoc.data());

    // Last 7 days for sparkline
    const q = query(collection(db, 'clients', currentUser.uid, 'dailyEntries'), orderBy('date', 'desc'), limit(7));
    const snap = await getDocs(q);
    const entries = snap.docs.map(d => d.data());
    setRecentEntries([...entries].reverse());

    // Week balance — check for manual reset first
    const resetDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'weekResets', weekKey));
    const resetOffset = resetDoc.exists() ? (resetDoc.data().offset || 0) : 0;

    let totalDiff = 0;
    for (const e of entries) {
      if (e.date >= weekKey && e.calories) {
        const t = await getTargetsForDate(currentUser.uid, e.date, p.targets || {});
        const stepBonus = Math.round(((e.steps || 0) - (t.steps || 10000)) / 1000 * (t.kcalPer1000Steps || 20));
        const sessionDef = e.didProgramSession === false ? -(t.sessionCalorieDeficit || 300) : 0;
        const extraCal = e.extraActivityCal ? +e.extraActivityCal : 0;
        const target = (t.calories || 2000) + stepBonus + extraCal + sessionDef;
        totalDiff += (e.calories - target);
      }
    }
    setWeekBalance(Math.round(totalDiff + resetOffset));

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [currentUser.uid, today]);

  function handleToggle() { switchMode(); navigate('/coach'); }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  if (!profile) return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🌿</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Pas encore de profil élève</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        Pour accéder à ton espace élève et suivre ton programme, crée d'abord ton profil.
      </p>
      <Link to="/register" style={{ textDecoration: 'none' }}>
        <button className="btn btn-primary">Créer mon profil élève</button>
      </Link>
      {userRole === 'coach' && (
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={handleToggle}>
          ← Retour espace coach
        </button>
      )}
    </div>
  );

  const { targets } = profile;
  const todayCalories = todayEntry?.calories || 0;
  const todaySteps = todayEntry?.steps || 0;
  const todayWeight = todayEntry?.weight || null;
  const stepBonus = Math.round(((todaySteps - (targets?.steps || 10000)) / 1000) * (targets?.kcalPer1000Steps || 20));
  const sessionAdj = todayEntry?.didProgramSession === false ? -(targets?.sessionCalorieDeficit || 300) : 0;
  const extraCal = todayEntry?.extraActivityCal || 0;
  const adjustedCalories = (targets?.calories || 2000) + stepBonus + sessionAdj + extraCal;
  const caloriePct = Math.min(100, Math.round((todayCalories / adjustedCalories) * 100));
  const stepPct = Math.min(100, Math.round((todaySteps / (targets?.steps || 10000)) * 100));

  const balanceColor = weekBalance === null ? 'var(--text-muted)'
    : weekBalance > 200 ? 'var(--warning)'
    : weekBalance < -200 ? 'var(--danger)'
    : 'var(--success)';

  return (
    <div className="app-shell">
      <div className="top-nav">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{todayLabel}</div>
          <div className="top-nav-title">Bonjour, {profile.firstName} 👋</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {userRole === 'coach' && <CoachToggle mode={coachMode} onSwitch={handleToggle} />}
          <Link to="/profile" style={{ textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>
              {profile.firstName[0]}{profile.lastName[0]}
            </div>
          </Link>
        </div>
      </div>

      <div className="page">
        {/* Bilan hebdo banner */}
        {weeklyToday && (
          <div style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: 16, color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>📅 C'est le jour de ton bilan !</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>Bilan hebdomadaire</h3>
              <Link to="/checkin/weekly" style={{ textDecoration: 'none' }}>
                <button style={{ background: 'white', color: '#D97706', border: 'none', borderRadius: 'var(--radius-full)', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14 }}>
                  Faire mon bilan →
                </button>
              </Link>
            </div>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
          </div>
        )}

        {/* Daily check-in CTA */}
        {!todayEntry && (
          <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderRadius: 'var(--radius)', padding: '20px', marginBottom: 16, color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>📋 Pas encore rempli aujourd'hui</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>Suivi quotidien</h3>
              <Link to="/checkin/daily" style={{ textDecoration: 'none' }}>
                <button style={{ background: 'white', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-full)', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14 }}>
                  Remplir maintenant →
                </button>
              </Link>
            </div>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          </div>
        )}

        {/* Today stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Aujourd'hui</h2>
          {todayEntry && <Link to="/checkin/daily" style={{ textDecoration: 'none', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Modifier ✏️</Link>}
        </div>

        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Calories</div>
            <div className="stat-value">{todayCalories.toLocaleString()}<span className="stat-unit">/ {adjustedCalories.toLocaleString()}</span></div>
            <div className="progress-bar" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: `${caloriePct}%` }} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pas</div>
            <div className="stat-value">{todaySteps.toLocaleString()}<span className="stat-unit">/ {(targets?.steps || 10000).toLocaleString()}</span></div>
            <div className="progress-bar" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: `${stepPct}%` }} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Poids du jour</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{todayWeight || '—'}<span className="stat-unit">kg</span></div>
          </div>
          {/* Week balance */}
          <div className="stat-card" style={{ border: `1.5px solid ${balanceColor}20` }}>
            <div className="stat-label">Balance semaine</div>
            <div className="stat-value" style={{ color: balanceColor, fontSize: 20 }}>
              {weekBalance !== null ? `${weekBalance > 0 ? '+' : ''}${weekBalance}` : '—'}
              <span className="stat-unit">kcal</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              {weekBalance === null ? '' : weekBalance > 200 ? 'Au-dessus' : weekBalance < -200 ? 'En dessous' : '✅ Dans la cible'}
            </div>
          </div>
        </div>

        {/* Weight sparkline */}
        {recentEntries.filter(e => e.weight).length > 1 && (
          <>
            <h2 className="section-title">Évolution du poids</h2>
            <div className="card" style={{ marginBottom: 20, padding: '16px 16px 8px' }}>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={recentEntries.filter(e => e.weight)}>
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', r: 3 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v} kg`]} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Targets */}
        <h2 className="section-title">Mes objectifs</h2>
        <div className="card" style={{ marginBottom: 20 }}>
          {[
            { icon: '🔥', label: 'Calories cibles', value: `${targets?.calories || '—'} kcal`, color: 'var(--primary)' },
            { icon: '🥩', label: 'Protéines', value: `${targets?.protein || '—'} g`, color: '#7C3AED' },
            { icon: '🌾', label: 'Glucides', value: `${targets?.carbs || '—'} g`, color: '#EC4899' },
            { icon: '🥑', label: 'Lipides', value: `${targets?.fat || '—'} g`, color: '#F59E0B' },
            { icon: '👟', label: 'Pas / jour', value: (targets?.steps || 10000).toLocaleString(), color: 'var(--success)' },
            { icon: '🏋️', label: 'Séances / semaine', value: targets?.sessionsPerWeek || 3, color: 'var(--primary)' },
          ].map(t => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.icon} {t.label}</span>
              <span style={{ fontWeight: 700, color: t.color }}>{t.value}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login'); }} style={{ marginBottom: 16 }}>
          Se déconnecter
        </button>
      </div>

      <TabBar />
    </div>
  );
}
