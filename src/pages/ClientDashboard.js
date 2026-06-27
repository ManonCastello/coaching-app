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
  const [allEntries, setAllEntries] = useState([]);
  const [journalLimit, setJournalLimit] = useState(7);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayDayOfWeek = getDay(new Date());
  const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  async function loadData() {
    try {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (!profileDoc.exists()) { setLoading(false); return; }
      const p = profileDoc.data();
      setProfile(p);

      // Lancer tous les appels en parallèle
      const [
        weekDoc,
        todayDoc,
        entriesSnap,
        resetDoc,
        weeklySnap,
        wgSnap,
      ] = await Promise.all([
        (p.weeklyBilanDay !== undefined && p.weeklyBilanDay === todayDayOfWeek)
          ? getDoc(doc(db, 'clients', currentUser.uid, 'weeklyEntries', weekKey))
          : Promise.resolve(null),
        getDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', today)),
        getDocs(query(collection(db, 'clients', currentUser.uid, 'dailyEntries'), orderBy('date', 'desc'), limit(90))),
        getDoc(doc(db, 'clients', currentUser.uid, 'weekResets', weekKey)),
        getDocs(query(collection(db, 'clients', currentUser.uid, 'weeklyEntries'), orderBy('weekStart', 'desc'), limit(1))),
        getDocs(query(collection(db, 'clients', currentUser.uid, 'weekGoals'), orderBy('weekStart', 'desc'), limit(1))),
      ]);

      if (weekDoc && !weekDoc.exists()) setWeeklyToday(true);
      if (todayDoc.exists()) {
        setTodayEntry(todayDoc.data());
        setTodayGoalChecks(todayDoc.data().goalChecks || null);
      }

      const entries = entriesSnap.docs.map(d => d.data());
      setAllEntries(entries); // desc order pour le journal
      setRecentEntries([...entries].slice(0, 7).reverse()); // asc order pour le graphique

      if (!weeklySnap.empty) setLastWeeklyEntry(weeklySnap.docs[0].data());
      if (!wgSnap.empty) setWeekGoals(wgSnap.docs[0].data());

      // Balance calorique — utilise la valeur figée stockée à la sauvegarde
      if ((p.coachingMode || 'tracking') !== 'intuitif') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const allEntries = entries.filter(e => e.date !== todayStr);
        const lastLocked = allEntries.find(e => e.locked && e.dailyBalance !== null && e.dailyBalance !== undefined);
        setWeekBalance(lastLocked ? Math.round(lastLocked.dailyBalance) : 0);
      }
    } catch (e) {
      console.error('loadData error:', e);
    }
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
  const baseCalories = targets?.calories || 2000;
  const adjustedCalories = baseCalories + (todayEntry ? stepBonus + sessionAdj + extraCal : 0);
  const caloriePct = Math.min(100, Math.round((todayCalories / baseCalories) * 100));
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
          {/* Calories + balance : mode tracking uniquement */}
          {(profile.coachingMode || 'tracking') !== 'intuitif' && (
            <div className="stat-card">
              <div className="stat-label">Calories</div>
              <div className="stat-value">{todayCalories.toLocaleString()}<span className="stat-unit">/ {baseCalories.toLocaleString()}</span></div>
              <div className="progress-bar" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: `${caloriePct}%` }} /></div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-label">Pas</div>
            <div className="stat-value">{todaySteps.toLocaleString()}<span className="stat-unit">/ {(targets?.steps || 10000).toLocaleString()}</span></div>
            <div className="progress-bar" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: `${stepPct}%` }} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Poids du jour</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{todayWeight || '—'}<span className="stat-unit">kg</span></div>
          </div>
          {(profile.coachingMode || 'tracking') !== 'intuitif' && weekBalance !== null && (
            <div className="stat-card" style={{ border: '1.5px solid ' + balanceColor + '20' }}>
              <div className="stat-label">Balance semaine</div>
              <div className="stat-value" style={{ color: balanceColor, fontSize: 20 }}>
                {weekBalance > 0 ? '+' : ''}{weekBalance}
                <span className="stat-unit">kcal</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                {weekBalance > 200 ? 'Au-dessus' : weekBalance < -200 ? 'En dessous' : '✅ Dans la cible'}
              </div>
            </div>
          )}
        </div>

        {/* ── MES OBJECTIFS ── */}
        <h2 className="section-title">Mes objectifs</h2>
        <div className="card" style={{ marginBottom: 20 }}>
          {[
            ...(profile.coachingMode !== 'intuitif' ? [
              { icon: '🔥', label: 'Calories cibles', value: `${targets?.calories || '—'} kcal`, color: 'var(--primary)' },
              { icon: '🥩', label: 'Protéines', value: `${targets?.protein || '—'} g`, color: '#F59E0B' },
              { icon: '🌾', label: 'Glucides', value: `${targets?.carbs || '—'} g`, color: '#EC4899' },
              { icon: '🥑', label: 'Lipides', value: `${targets?.fat || '—'} g`, color: '#7C3AED' },
            ] : []),
            { icon: '👟', label: 'Pas / jour', value: (targets?.steps || 10000).toLocaleString(), color: 'var(--success)' },
            { icon: '🏋️', label: 'Séances / semaine', value: targets?.sessionsPerWeek || 3, color: 'var(--primary)' },
          ].map(t => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.icon} {t.label}</span>
              <span style={{ fontWeight: 700, color: t.color }}>{t.value}</span>
            </div>
          ))}
        </div>

        {/* ── REPÈRE DE L'ASSIETTE ── */}
        {profile.coachingMode !== 'intuitif' && targets?.calories > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              {/* Camembert */}
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>L'assiette type</div>
                <svg width="170" height="170" viewBox="0 0 180 180">
                  <circle cx="90" cy="90" r="88" fill="rgba(0,0,0,0.04)"/>
                  <path d="M90,90 L90,2 A88,88 0 0,1 90,178 Z" fill="#5BAD6F"/>
                  <path d="M90,90 L90,178 A88,88 0 0,1 2,90 Z" fill="#EC4899"/>
                  <path d="M90,90 L2,90 A88,88 0 0,1 90,2 Z" fill="#F59E0B"/>
                  <circle cx="90" cy="90" r="32" fill="#7C3AED"/>
                  <text x="90" y="87" textAnchor="middle" fontSize="10" fill="white" fontWeight="600">🥑 Lipides</text>
                  <text x="90" y="100" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.8)">petit peu</text>
                  <text x="134" y="85" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">🥦</text>
                  <text x="134" y="98" textAnchor="middle" fontSize="10" fill="white">Légumes</text>
                  <text x="134" y="110" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.85)">½</text>
                  <text x="46" y="130" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">🌾</text>
                  <text x="46" y="143" textAnchor="middle" fontSize="10" fill="white">Glucides</text>
                  <text x="46" y="155" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.85)">¼</text>
                  <text x="46" y="48" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">🥩</text>
                  <text x="46" y="61" textAnchor="middle" fontSize="10" fill="white">Protéines</text>
                  <text x="46" y="73" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.85)">¼</text>
                </svg>
              </div>
              {/* Repères repas */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Répartition conseillée pour toi</div>
                {[
                  { label: '🌅 Matin', r: 0.25 },
                  { label: '☀️ Midi', r: 0.35 },
                  { label: '🌙 Soir', r: 0.30 },
                  { label: '🍎 Collation', r: 0.10 },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 6, border: '1px solid var(--border-light)', borderRadius: 10, background: 'var(--bg)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>~{Math.round(targets.calories * m.r)} kcal</span>
                      {targets.protein > 0 && (
                        <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, marginLeft: 8 }}>{Math.round(targets.protein * m.r)}g P</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── OBJECTIFS DE LA SEMAINE ── */}
        {weekGoals?.goals?.some(g => g.active) && (
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
        {allEntries.length > 0 && (
          <>
            <h2 className="section-title">Mon journal</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {allEntries.slice(0, journalLimit).map((entry, i) => (
                <div key={entry.date} style={{
                  padding: '12px 0',
                  borderBottom: i < Math.min(journalLimit, allEntries.length) - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>
                      {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {entry.menstruation && <span title="Règles">🩸</span>}
                      {entry.didProgramSession === true && <span style={{ fontSize: 11, background: 'var(--success-light)', color: 'var(--success)', padding: '2px 7px', borderRadius: 100, fontWeight: 600 }}>🏋️ Séance</span>}
                      {entry.didProgramSession === false && <span style={{ fontSize: 11, background: 'var(--danger-light)', color: 'var(--danger)', padding: '2px 7px', borderRadius: 100, fontWeight: 600 }}>❌ Séance</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {entry.weight && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⚖️ <strong>{entry.weight} kg</strong></span>}
                    {entry.steps > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👟 <strong>{(+entry.steps).toLocaleString()}</strong> pas</span>}
                    {profile.coachingMode !== 'intuitif' && entry.calories > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔥 <strong>{entry.calories}</strong> kcal</span>}
                    {entry.sleep && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>😴 <strong>{entry.sleep}h</strong></span>}
                    {entry.extraActivity && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🏃 {entry.extraActivity}</span>}
                  </div>
                  {/* Macros — mode tracking */}
                  {profile.coachingMode !== 'intuitif' && (entry.protein > 0 || entry.carbs > 0 || entry.fat > 0) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      {entry.protein > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                          🥩 {entry.protein}g
                          {profile.targets?.protein > 0 && <span style={{ opacity: 0.7, fontWeight: 400 }}> / {profile.targets.protein}g</span>}
                        </span>
                      )}
                      {entry.carbs > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}>
                          🌾 {entry.carbs}g
                          {profile.targets?.carbs > 0 && <span style={{ opacity: 0.7, fontWeight: 400 }}> / {profile.targets.carbs}g</span>}
                        </span>
                      )}
                      {entry.fat > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: '#F0FDF4', color: '#15803D', fontWeight: 600 }}>
                          🥑 {entry.fat}g
                          {profile.targets?.fat > 0 && <span style={{ opacity: 0.7, fontWeight: 400 }}> / {profile.targets.fat}g</span>}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Objectifs cochés — tous modes */}
                  {entry.goalChecks && Object.keys(entry.goalChecks).length > 0 && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      {entry.goalChecks.protein && ['morning','lunch','dinner','snack'].map(m => entry.goalChecks.protein[m] && (
                        <span key={m} style={{ fontSize: 10, background: 'var(--success-light)', color: 'var(--success)', padding: '2px 6px', borderRadius: 100, fontWeight: 600 }}>
                          🥩 {m === 'morning' ? 'Matin' : m === 'lunch' ? 'Midi' : m === 'dinner' ? 'Soir' : 'Collation'}
                        </span>
                      ))}
                      {entry.goalChecks.vegetables?.lunch && <span style={{ fontSize: 10, background: 'var(--success-light)', color: 'var(--success)', padding: '2px 6px', borderRadius: 100, fontWeight: 600 }}>🥦 Midi</span>}
                      {entry.goalChecks.vegetables?.dinner && <span style={{ fontSize: 10, background: 'var(--success-light)', color: 'var(--success)', padding: '2px 6px', borderRadius: 100, fontWeight: 600 }}>🥦 Soir</span>}
                      {entry.goalChecks.fruits?.done && <span style={{ fontSize: 10, background: 'var(--success-light)', color: 'var(--success)', padding: '2px 6px', borderRadius: 100, fontWeight: 600 }}>🍎 Fruits ✅</span>}
                    </div>
                  )}
                  {entry.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>"{entry.notes}"</p>}
                </div>
              ))}
              {allEntries.length > journalLimit && (
                <button onClick={() => setJournalLimit(l => l + 14)} style={{
                  width: '100%', padding: '12px', marginTop: 8, background: 'none', border: 'none',
                  color: 'var(--primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>
                  Voir plus ({allEntries.length - journalLimit} entrées) ↓
                </button>
              )}
            </div>
          </>
        )}

        <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login'); }} style={{ marginBottom: 16 }}>
          Se déconnecter
        </button>
      </div>

      <TabBar />
    </div>
  );
}
