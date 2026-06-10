// src/components/CoachToggle.js — visible uniquement sur le compte coach
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function CoachToggle({ mode, onSwitch }) {
  // mode = 'coach' | 'athlete'
  const isCoach = mode === 'coach';
  return (
    <div
      onClick={onSwitch}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: isCoach ? 'var(--primary-bg)' : 'var(--success-light)',
        border: `1.5px solid ${isCoach ? 'var(--primary-light)' : 'var(--success)'}`,
        borderRadius: 'var(--radius-full)', padding: '6px 12px',
        cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none'
      }}>
      <span style={{ fontSize: 14 }}>{isCoach ? '🏅' : '🏃'}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: isCoach ? 'var(--primary)' : 'var(--success)' }}>
        {isCoach ? 'Coach' : 'Élève'}
      </span>
      <div style={{
        width: 32, height: 18, borderRadius: 100,
        background: isCoach ? 'var(--primary)' : 'var(--success)',
        position: 'relative', transition: 'background 0.2s'
      }}>
        <div style={{
          position: 'absolute', top: 3,
          left: isCoach ? 3 : 15,
          width: 12, height: 12, borderRadius: '50%',
          background: 'white', transition: 'left 0.2s'
        }} />
      </div>
    </div>
  );
}
