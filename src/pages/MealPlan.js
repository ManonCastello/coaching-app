// src/pages/MealPlan.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TabBar from '../components/TabBar';

export default function MealPlan() {
  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">Fiches repas</div>
        <div style={{ width: 24 }} />
      </div>
      <div className="page">
        <p>Fiches repas en cours de chargement...</p>
      </div>
      <TabBar />
    </div>
  );
}
