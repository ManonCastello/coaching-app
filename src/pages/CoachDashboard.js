// src/pages/CoachDashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import CoachToggle from '../components/CoachToggle';

export default function CoachDashboard() {
  const { currentUser, logout, coachMode, switchMode } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  async function loadClients() {
    const snap = await getDocs(query(collection(db, 'clients'), orderBy('firstName')));
    const list = await Promise.all(snap.docs.map(async d => {
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

  useEffect(() => { loadClients(); }, [today]);

  async function toggleArchive(clientId, archived) {
    await updateDoc(doc(db, 'clients', clientId), { archived: !archived });
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, archived: !archived } : c));
  }

  function handleToggle() {
    switchMode();
    navigate('/dashboard');
  }

  const activeClients = clients.filter(c => !c.archived);
  const archivedClients = clients.filter(c => c.archived);
  const displayClients = showArchived ? archivedClients : activeClients;
  const filtered = displayClients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );
  const checkedInCount = activeClients.filter(c => c.checkedInToday).length;

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="app-shell">
      <div className="top-nav">
        <div className="top-nav-logo">⚜️ FitLog</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CoachToggle mode={coachMode} onSwitch={handleToggle} />
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
              <div><div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{activeClients.length}</div><div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>clients actifs</div></div>
              <div><div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{checkedInCount}</div><div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>suivis aujourd'hui</div></div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: checkedInCount < activeClients.length ? '#FCA5A5' : '#6EE7B7' }}>{activeClients.length - checkedInCount}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>sans suivi</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bouton nouvelle consultation */}
        <Link to="/coach/consultation/new" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
          <button style={{
            width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)',
            border: '2px solid var(--primary)', background: 'var(--primary-bg)',
            color: 'var(--primary)', fontFamily: 'var(--font-body)',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            📋 Nouvelle consultation nutrition
          </button>
        </Link>

        <div style={{ marginBottom: 16 }}>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." />
        </div>

        {/* Active / Archived toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setShowArchived(false)} style={{
            flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
            background: !showArchived ? 'var(--primary)' : 'var(--border-light)',
            color: !showArchived ? 'white' : 'var(--text-muted)'
          }}>Actifs ({activeClients.length})</button>
          <button onClick={() => setShowArchived(true)} style={{
            flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
            background: showArchived ? 'var(--primary)' : 'var(--border-light)',
            color: showArchived ? 'white' : 'var(--text-muted)'
          }}>Archivés ({archivedClients.length})</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Aucun client</div>}
          {filtered.map(client => (
            <div key={client.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link to={`/coach/client/${client.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${client.checkedInToday ? 'var(--success), #059669' : 'var(--primary), var(--primary-dark)'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 15, opacity: client.archived ? 0.5 : 1
                }}>
                  {client.firstName?.[0]}{client.lastName?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {client.firstName} {(client.lastName || '').toUpperCase()}
                    {client.id === currentUser.uid && <span style={{ fontSize: 11, background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 100, fontWeight: 600 }}>Moi</span>}
                    {client.formule && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 100, background: client.formule === 'platinium' ? 'var(--primary-bg)' : 'var(--warning-light)', color: client.formule === 'platinium' ? 'var(--primary)' : 'var(--warning)', fontWeight: 600 }}>{client.formule === 'platinium' ? '💎' : '🥇'}</span>}
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 100, background: 'var(--border-light)', color: 'var(--text-muted)', fontWeight: 600 }}>{client.coachingMode === 'intuitif' ? '🎯' : '📊'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {client.lastEntry ? `${client.lastEntry.calories || '—'} kcal · ${(client.lastEntry.steps || 0).toLocaleString()} pas` : 'Pas de suivi aujourd\'hui'}
                  </div>
                </div>
                <span className={`badge ${client.checkedInToday ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                  {client.checkedInToday ? '✅' : '⏳'}
                </span>
              </Link>
              {/* Désarchiver uniquement dans la vue archivés */}
              {client.archived && (
                <button
                  onClick={() => toggleArchive(client.id, client.archived)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '4px', color: 'var(--text-light)' }}
                  title="Désarchiver">
                  ♻️
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
