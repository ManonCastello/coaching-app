// src/components/TabBar.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function TabBar() {
  const { pathname } = useLocation();
  const tabs = [
    { to: '/dashboard', icon: '🏠', label: 'Accueil' },
    { to: '/checkin/daily', icon: '📋', label: 'Suivi' },
    { to: '/checkin/weekly', icon: '📅', label: 'Bilan' },
    { to: '/mealplan', icon: '🍽️', label: 'Repas' },
    { to: '/progress', icon: '📈', label: 'Progrès' },
    { to: '/profile', icon: '👤', label: 'Profil' },
  ];
  return (
    <nav className="tab-bar">
      {tabs.map(t => (
        <Link key={t.to} to={t.to} className={`tab-item ${pathname === t.to ? 'active' : ''}`}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
