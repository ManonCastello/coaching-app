// src/pages/ClientDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { format, getDay, startOfWeek, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts';
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
  const [lastWeeklyEntry, setLastWeeklyEntry] = useState(null);
  const [weekGoals, setWeekGoals] = useState(null);
  const [todayGoalChecks, setTodayGoalChecks] = useState(null);
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

    // Dernier bilan hebdo pour les progrès
    const { collection: col2, query: q2, orderBy: ob2, limit: lim2, getDocs: gd2 } = await import('firebase/firestore');
    const weeklyQ = q2(col2(db, 'clients', currentUser.uid, 'weeklyEntries'), ob2('weekStart', 'desc'), lim2(1));
    const weeklySnap = await gd2(weeklyQ);
    if (!weeklySnap.empty) setLastWeeklyEntry(weeklySnap.docs[0].data());

    // Objectifs hebdo
    const { format: fmt2, startOfWeek: sow2 } = await import('date-fns');
    const wkKey = fmt2(sow2(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const { collection: col3, query: q3, orderBy: ob3, limit: lim3, getDocs: gd3 } = await import('firebase/firestore');
    const wgQ = q3(col3(db, 'clients', currentUser.uid, 'weekGoals'), ob3('weekStart', 'desc'), lim3(1));
    const wgSnap = await gd3(wgQ);
    if (!wgSnap.empty) setWeekGoals(wgSnap.docs[0].data());
    // Coches du jour
    const todayStr = new Date().toISOString().split('T')[0];
    const { doc: docRef, getDoc: gdoc } = await import('firebase/firestore');
    const todayDoc = await gdoc(docRef(db, 'clients', currentUser.uid, 'dailyEntries', todayStr));
    if (todayDoc.exists()) setTodayGoalChecks(todayDoc.data().goalChecks || null);

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [currentUser.uid, today]);

  function handleToggle() { switchMode(); navigate('/coach'); }

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  if (!profile) return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>⚜️</div>
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
              {profile.firstName?.[0]}{profile.lastName?.[0]}
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

        {/* Bloc objectifs hebdo — mode intuitif */}
        {profile.coachingMode === 'intuitif' && weekGoals?.goals?.some(g => g.active) && (
          <>
            <h2 className="section-title">Objectifs de la semaine</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {weekGoals.goals.filter(g => g.active).map((goal, i, arr) => {
                let checks = [];
                let label = '';
                if (goal.key === 'protein') {
                  const meals = ['morning', 'lunch', 'dinner'];
                  if (goal.includeSnack) meals.push('snack');
                  const done = meals.filter(m => todayGoalChecks?.protein?.[m]).length;
                  checks = [{ label: `${done}/${meals.length} repas`, done: done === meals.length }];
                  label = '🥩 Protéines ≥ 30g';
                } else if (goal.key === 'vegetables') {
                  const done = ['lunch','dinner'].filter(m => todayGoalChecks?.vegetables?.[m]).length;
                  checks = [{ label: `${done}/2 repas`, done: done === 2 }];
                  label = '🥦 Légumes ≥ 250g';
                } else if (goal.key === 'fruits') {
                  const done = !!todayGoalChecks?.fruits?.done;
                  checks = [{ label: done ? 'Atteint ✅' : 'Pas encore', done }];
                  label = '🍎 2 fruits min.';
                } else if (goal.key === 'junkfood') {
                  const cal = todayGoalChecks?.junkfood?.calories;
                  const ok = cal ? +cal <= (goal.maxCalories || 300) : null;
                  checks = [{ label: cal ? `${cal} kcal${ok ? ' ✅' : ' ⚠️'}` : 'Non renseigné', done: ok }];
                  label = `🍕 Malbouffe (max ${goal.maxCalories || 300} kcal)`;
                }
                return (
                  <div key={goal.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: checks[0]?.done ? 'var(--success)' : 'var(--text-muted)' }}>{checks[0]?.label}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <a href="/checkin/daily" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                  ✏️ Compléter mon suivi du jour →
                </a>
              </div>
            </div>
          </>
        )}

        {/* Bloc Mes progrès */}
        {(profile.startWeight || profile.startMeasurements) && (
          <>
            <h2 className="section-title">Mes progrès</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {/* Poids */}
              {profile.startWeight && (() => {
                const currentW = todayWeight || lastWeeklyEntry?.avgWeight || null;
                const deltaW = currentW ? +(currentW - profile.startWeight).toFixed(1) : null;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>⚖️ Poids</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>départ : {profile.startWeight} kg</span>
                    </div>
                    {deltaW !== null ? (
                      <span style={{ fontWeight: 800, fontSize: 16, color: deltaW < 0 ? 'var(--success)' : deltaW > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {deltaW > 0 ? '+' : ''}{deltaW} kg
                      </span>
                    ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>}
                  </div>
                );
              })()}
              {/* Mensurations */}
              {profile.startMeasurements && lastWeeklyEntry?.measurements && [
                { key: 'waist', label: 'Taille', emoji: '👗' },
                { key: 'hips', label: 'Hanches', emoji: '🔵' },
                { key: 'glutes', label: 'Fesses', emoji: '🍑' },
                { key: 'thighs', label: 'Cuisses', emoji: '🦵' },
                { key: 'arms', label: 'Bras', emoji: '💪' },
              ].map((m, i, arr) => {
                const startVal = profile.startMeasurements[m.key];
                const currentVal = lastWeeklyEntry.measurements[m.key];
                if (!startVal || !currentVal) return null;
                const delta = +(currentVal - startVal).toFixed(1);
                return (
                  <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{m.emoji} {m.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>départ : {startVal} cm</span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 16, color: delta < 0 ? 'var(--success)' : delta > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {delta > 0 ? '+' : ''}{delta} cm
                    </span>
                  </div>
                );
              })}
              {(!lastWeeklyEntry?.measurements || !profile.startMeasurements) && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Remplis ton premier bilan hebdo pour voir tes progrès 📊
                </p>
              )}
            </div>
          </>
        )}

        {/* Weight chart */}
        {recentEntries.filter(e => e.weight).length > 1 && (
          <>
            <h2 className="section-title">Évolution du poids</h2>
            <div className="card" style={{ marginBottom: 20, padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={recentEntries.filter(e => e.weight)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'dd/MM', { locale: fr })} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={35} />
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: 'var(--primary)' }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v} kg`, 'Poids']} labelFormatter={d => format(new Date(d), 'dd/MM/yyyy', { locale: fr })} />
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
