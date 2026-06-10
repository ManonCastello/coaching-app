// src/pages/ClientDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

export default function ClientDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [todayEntry, setTodayEntry] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) setProfile(profileDoc.data());
      const todayDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', today));
      if (todayDoc.exists()) setTodayEntry(todayDoc.data());
      const q = query(collection(db, 'clients', currentUser.uid, 'dailyEntries'), orderBy('date', 'desc'), limit(7));
      const snap = await getDocs(q);
      setRecentEntries(snap.docs.map(d => d.data()).reverse());
      setLoading(false);
    }
    load();
  }, [currentUser.uid, today]);

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;
  if (!profile) return null;

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

  return (
    <div className="app-shell">
      <div className="top-nav">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{todayLabel}</div>
          <div className="top-nav-title">Bonjour, {profile.firstName} 👋</div>
        </div>
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 14
          }}>
            {profile.firstName[0]}{profile.lastName[0]}
          </div>
        </Link>
      </div>

      <div className="page">
        {/* Check-in CTA */}
        {!todayEntry && (
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            borderRadius: 'var(--radius)', padding: '20px', marginBottom: 20,
            color: 'white', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>📋 Pas encore rempli aujourd'hui</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>Fais ton suivi quotidien</h3>
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
          {todayEntry && (
            <Link to="/checkin/daily" style={{ textDecoration: 'none', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Modifier ✏️</Link>
          )}
        </div>

        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Calories</div>
            <div className="stat-value">{todayCalories.toLocaleString()}<span className="stat-unit">/ {adjustedCalories.toLocaleString()}</span></div>
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{ width: `${caloriePct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pas</div>
            <div className="stat-value">{todaySteps.toLocaleString()}<span className="stat-unit">/ {(targets?.steps || 10000).toLocaleString()}</span></div>
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{ width: `${stepPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Poids du jour</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{todayWeight || '—'}<span className="stat-unit">kg</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ajustement pas</div>
            <div className="stat-value" style={{ color: stepBonus >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {stepBonus >= 0 ? '+' : ''}{stepBonus}<span className="stat-unit">kcal</span>
            </div>
          </div>
        </div>

        {/* Weight sparkline */}
        {recentEntries.filter(e => e.weight).length > 1 && (
          <>
            <h2 className="section-title">Évolution du poids</h2>
            <div className="card" style={{ marginBottom: 20, padding: '16px 16px 8px' }}>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={recentEntries.filter(e => e.weight)}>
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', r: 4 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} formatter={v => [`${v} kg`, 'Poids']} labelFormatter={l => format(new Date(l), 'dd/MM', { locale: fr })} />
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
            { icon: '😴', label: 'Sommeil', value: `${targets?.sleep || 8} h`, color: '#60A5FA' },
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

      <nav className="tab-bar">
        <Link to="/dashboard" className="tab-item active"><span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span></Link>
        <Link to="/checkin/daily" className="tab-item"><span style={{ fontSize: 20 }}>📋</span><span>Suivi</span></Link>
        <Link to="/progress" className="tab-item"><span style={{ fontSize: 20 }}>📈</span><span>Progrès</span></Link>
        <Link to="/profile" className="tab-item"><span style={{ fontSize: 20 }}>👤</span><span>Profil</span></Link>
      </nav>
    </div>
  );
}
