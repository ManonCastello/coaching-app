// src/pages/ClientDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, startOfWeek, isToday } from 'date-fns';
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

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) setProfile(profileDoc.data());

      const todayDoc = await getDoc(doc(db, 'clients', currentUser.uid, 'dailyEntries', today));
      if (todayDoc.exists()) setTodayEntry(todayDoc.data());

      const q = query(
        collection(db, 'clients', currentUser.uid, 'dailyEntries'),
        orderBy('date', 'desc'),
        limit(7)
      );
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

  const stepBonus = Math.round(((todaySteps - targets.steps) / 1000) * (targets.kcalPer1000Steps || 80));
  const adjustedCalories = targets.calories + stepBonus;
  const caloriePct = Math.min(100, Math.round((todayCalories / adjustedCalories) * 100));
  const stepPct = Math.min(100, Math.round((todaySteps / targets.steps) * 100));

  const weekDay = format(new Date(), 'EEEE d MMMM', { locale: fr });

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="top-nav">
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{weekDay}</div>
          <div className="top-nav-title">Bonjour, {profile.firstName} 👋</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
      </div>

      <div className="page">
        {/* Check-in banner if not done today */}
        {!todayEntry && (
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            borderRadius: 'var(--radius)', padding: '20px', marginBottom: 20,
            color: 'white', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>📋 Pas encore rempli aujourd'hui</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>
                Fais ton suivi quotidien
              </h3>
              <Link to="/checkin/daily" style={{ textDecoration: 'none' }}>
                <button style={{
                  background: 'white', color: 'var(--primary)',
                  border: 'none', borderRadius: 'var(--radius-full)',
                  padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 14
                }}>
                  Remplir maintenant →
                </button>
              </Link>
            </div>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          </div>
        )}

        {/* Today stats */}
        <h2 className="section-title">Aujourd'hui</h2>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Calories</div>
            <div className="stat-value" style={{ color: caloriePct > 100 ? 'var(--warning)' : 'var(--text)' }}>
              {todayCalories.toLocaleString()}<span className="stat-unit">/ {adjustedCalories.toLocaleString()}</span>
            </div>
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{ width: `${caloriePct}%`, background: caloriePct > 105 ? 'var(--warning)' : undefined }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pas</div>
            <div className="stat-value">
              {todaySteps.toLocaleString()}<span className="stat-unit">/ {(targets.steps).toLocaleString()}</span>
            </div>
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{ width: `${stepPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Poids du jour</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>
              {todayWeight ? `${todayWeight}` : '—'}<span className="stat-unit">kg</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Bonus pas</div>
            <div className="stat-value" style={{ color: stepBonus >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {stepBonus >= 0 ? '+' : ''}{stepBonus}<span className="stat-unit">kcal</span>
            </div>
          </div>
        </div>

        {/* Weight chart */}
        {recentEntries.filter(e => e.weight).length > 1 && (
          <>
            <h2 className="section-title">Évolution du poids</h2>
            <div className="card" style={{ marginBottom: 20, padding: '16px 16px 8px' }}>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={recentEntries.filter(e => e.weight)}>
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', r: 4 }} />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                    formatter={(v) => [`${v} kg`, 'Poids']}
                    labelFormatter={(l) => format(new Date(l), 'dd/MM', { locale: fr })}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Macros targets */}
        <h2 className="section-title">Mes objectifs</h2>
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔥 Calories cibles</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{targets.calories} kcal</span>
            </div>
            <div className="divider" style={{ margin: '4px 0' }} />
            {[
              { icon: '🥩', label: 'Protéines', value: targets.protein, unit: 'g', color: '#7C3AED' },
              { icon: '🌾', label: 'Glucides', value: targets.carbs, unit: 'g', color: '#EC4899' },
              { icon: '🥑', label: 'Lipides', value: targets.fat, unit: 'g', color: '#F59E0B' },
              { icon: '👟', label: 'Pas / jour', value: targets.steps?.toLocaleString(), unit: '', color: 'var(--success)' },
              { icon: '😴', label: 'Sommeil', value: targets.sleep, unit: 'h', color: '#60A5FA' },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.icon} {t.label}</span>
                <span style={{ fontWeight: 700, color: t.color }}>{t.value}{t.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly check-in button */}
        <Link to="/checkin/weekly" style={{ textDecoration: 'none' }}>
          <button className="btn btn-secondary" style={{ marginBottom: 12 }}>
            📊 Bilan hebdomadaire
          </button>
        </Link>

        <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login'); }}>
          Se déconnecter
        </button>
      </div>

      {/* Tab bar */}
      <nav className="tab-bar">
        <Link to="/dashboard" className="tab-item active">
          <span style={{ fontSize: 20 }}>🏠</span><span>Accueil</span>
        </Link>
        <Link to="/checkin/daily" className="tab-item">
          <span style={{ fontSize: 20 }}>📋</span><span>Suivi</span>
        </Link>
        <Link to="/checkin/weekly" className="tab-item">
          <span style={{ fontSize: 20 }}>📊</span><span>Bilan</span>
        </Link>
        <Link to="/profile" className="tab-item">
          <span style={{ fontSize: 20 }}>👤</span><span>Profil</span>
        </Link>
      </nav>
    </div>
  );
}
