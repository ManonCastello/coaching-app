// src/pages/CoachDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function CoachDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('coach'); // 'coach' | 'athlete'
  const [coachProfile, setCoachProfile] = useState(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      // Load coach's own client profile if exists
      const coachClientDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (coachClientDoc.exists()) setCoachProfile(coachClientDoc.data());

      const snap = await getDocs(query(collection(db, 'clients'), orderBy('firstName')));
      const list = await Promise.all(snap.docs
        .filter(d => d.id !== currentUser.uid) // exclude coach's own profile
        .map(async d => {
          const client = d.data();
          try {
            const todayEntry = await getDoc(doc(db, 'clients', d.id, 'dailyEntries', today));
            return { ...client, id: d.id, lastEntry: todayEntry.exists() ? todayEntry.data() : null, checkedInToday: todayEntry.exists() };
          } catch {
            return { ...client, id: d.id, lastEntry: null, checkedInToday: false };
          }
        }));
      setClients(list);
      setLoading(false);
    }
    load();
  }, [currentUser.uid, today]);

  // If in athlete mode, redirect to client dashboard logic
  if (mode === 'athlete') {
    return (
      <div className="app-shell">
        <div className="top-nav">
          <div className="top-nav-logo">FitLog</div>
          <button
            onClick={() => setMode('coach')}
            style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-full)', padding: '8px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            🏅 Espace coach
          </button>
        </div>
        <div className="page">
          <div className="hero-banner" style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Mon suivi perso</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
              {coachProfile ? `${coachProfile.firstName} ${coachProfile.lastName}` : 'Mon profil'} 🌿
            </h2>
          </div>

          {!coachProfile ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 14 }}>Tu n'as pas encore de profil élève. Crée-en un pour suivre ton propre programme.</p>
              <Link to="/register">
                <button className="btn btn-primary">Créer mon profil élève</button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link to="/checkin/daily" style={{ textDecoration: 'none' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <span style={{ fontSize: 32 }}>📋</span>
                  <div><div style={{ fontWeight: 700 }}>Suivi quotidien</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Poids, pas, calories du jour</div></div>
                </div>
              </Link>
              <Link to="/checkin/weekly" style={{ textDecoration: 'none' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <span style={{ fontSize: 32 }}>📊</span>
                  <div><div style={{ fontWeight: 700 }}>Bilan hebdomadaire</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mensurations, photos, ressenti</div></div>
                </div>
              </Link>
              <Link to="/progress" style={{ textDecoration: 'none' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <span style={{ fontSize: 32 }}>📈</span>
                  <div><div style={{ fontWeight: 700 }}>Mes progrès</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Graphiques et évolution</div></div>
                </div>
              </Link>
              <Link to="/profile" style={{ textDecoration: 'none' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <span style={{ fontSize: 32 }}>👤</span>
                  <div><div style={{ fontWeight: 700 }}>Mon profil</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Objectifs et paramètres</div></div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const filtered = clients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );
  const checkedInCount = clients.filter(c => c.checkedInToday).length;

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="app-shell">
      <div className="top-nav">
        <div className="top-nav-logo">🌿 FitLog</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setMode('athlete')}
            style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-full)', padding: '8px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            🏃 Espace élève
          </button>
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto', fontSize: 12, padding: '8px' }} onClick={async () => { await logout(); navigate('/login'); }}>
            Déco.
          </button>
        </div>
      </div>

      <div className="page">
        <div className="hero-banner" style={{ marginBottom: 24 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Tableau de bord coach</p>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{clients.length}</div><div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>clients actifs</div></div>
              <div><div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{checkedInCount}</div><div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>suivis aujourd'hui</div></div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: checkedInCount < clients.length ? '#FCA5A5' : '#6EE7B7' }}>{clients.length - checkedInCount}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>sans suivi</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un(e) coaché(e)..." />
        </div>

        <h2 className="section-title">Mes coaché(e)s</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Aucun client trouvé</div>}
          {filtered.map(client => (
            <Link key={client.id} to={`/coach/client/${client.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${client.checkedInToday ? 'var(--success), #059669' : 'var(--primary), var(--primary-dark)'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 16
                }}>
                  {client.firstName?.[0]}{client.lastName?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{client.firstName} {client.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {client.lastEntry ? `${client.lastEntry.calories || '—'} kcal · ${(client.lastEntry.steps || 0).toLocaleString()} pas` : 'Pas de suivi aujourd\'hui'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`badge ${client.checkedInToday ? 'badge-success' : 'badge-warning'}`}>
                    {client.checkedInToday ? '✅ OK' : '⏳ En attente'}
                  </span>
                  {client.lastEntry?.weight && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{client.lastEntry.weight} kg</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
