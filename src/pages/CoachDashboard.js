// src/pages/CoachDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { format, subDays } from 'date-fns';

export default function CoachDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      const snap = await getDocs(query(collection(db, 'clients'), orderBy('firstName')));
      const list = await Promise.all(snap.docs.map(async d => {
        const client = d.data();
        // Get today's entry
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const todayEntry = await getDoc(doc(db, 'clients', d.id, 'dailyEntries', today));
          const lastEntry = todayEntry.exists() ? todayEntry.data() : null;
          return { ...client, id: d.id, lastEntry, checkedInToday: todayEntry.exists() };
        } catch {
          return { ...client, id: d.id, lastEntry: null, checkedInToday: false };
        }
      }));
      setClients(list);
      setLoading(false);
    }
    load();
  }, [today]);

  const filtered = clients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const checkedInCount = clients.filter(c => c.checkedInToday).length;

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="app-shell">
      <div className="top-nav">
        <div>
          <div className="top-nav-logo">Manon Castello Coaching</div>
          <div className="top-nav-title">Espace Coach</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={async () => { await logout(); navigate('/login'); }}>
          Déco.
        </button>
      </div>

      <div className="page">
        {/* Stats banner */}
        <div className="hero-banner" style={{ marginBottom: 24 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Vue d'ensemble</p>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{clients.length}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>clients actifs</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{checkedInCount}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>suivi aujourd'hui</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: checkedInCount < clients.length ? '#FCA5A5' : '#6EE7B7' }}>
                  {clients.length - checkedInCount}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>sans suivi</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Rechercher un(e) coaché(e)..."
          />
        </div>

        <h2 className="section-title">Mes coaché(e)s</h2>

        {/* Client list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Aucun client trouvé
            </div>
          )}
          {filtered.map(client => (
            <Link key={client.id} to={`/coach/client/${client.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'transform 0.15s', ':hover': { transform: 'translateY(-1px)' } }}>
                {/* Avatar */}
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
                    {client.lastEntry
                      ? `${client.lastEntry.calories || '—'} kcal · ${(client.lastEntry.steps || 0).toLocaleString()} pas`
                      : 'Pas de suivi aujourd\'hui'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`badge ${client.checkedInToday ? 'badge-success' : 'badge-warning'}`}>
                    {client.checkedInToday ? '✅ OK' : '⏳ En attente'}
                  </span>
                  {client.lastEntry?.weight && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {client.lastEntry.weight} kg
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
