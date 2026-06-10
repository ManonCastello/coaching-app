// src/pages/LoginPage.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function FleurDeLys({ size = 40, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 10 C50 10 42 25 42 38 C42 48 50 52 50 52 C50 52 58 48 58 38 C58 25 50 10 50 10Z" fill={color} opacity="0.95"/>
      <path d="M50 52 C50 52 35 45 28 35 C22 27 26 15 26 15 C26 15 36 22 40 32 C44 42 50 52 50 52Z" fill={color} opacity="0.9"/>
      <path d="M50 52 C50 52 65 45 72 35 C78 27 74 15 74 15 C74 15 64 22 60 32 C56 42 50 52 50 52Z" fill={color} opacity="0.9"/>
      <path d="M44 52 C44 52 40 56 40 62 C40 68 44 70 50 70 C56 70 60 68 60 62 C60 56 56 52 56 52 L44 52Z" fill={color} opacity="0.85"/>
      <rect x="45" y="68" width="10" height="18" rx="3" fill={color} opacity="0.8"/>
      <rect x="36" y="80" width="28" height="4" rx="2" fill={color} opacity="0.75"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Email ou mot de passe incorrect');
    }
    setLoading(false);
  }

  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(124,58,237,0.35)'
        }}>
          <FleurDeLys size={44} color="white" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          FitLog
        </h1>
        <p style={{ color: 'var(--primary)', fontSize: 13, marginTop: 2, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          by Manon Castello
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-group">
          <label className="input-label">Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" required />
        </div>
        <div className="input-group">
          <label className="input-label">Mot de passe</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-muted)' }}>
        Pas encore de compte ?{' '}
        <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>S'inscrire</Link>
      </p>
    </div>
  );
}
