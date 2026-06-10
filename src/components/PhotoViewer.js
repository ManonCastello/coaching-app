// src/components/PhotoViewer.js
import React, { useState, useEffect } from 'react';

const SLOTS = [
  { key: 'face', label: 'Face' },
  { key: 'profile', label: 'Profil' },
  { key: 'back', label: 'Dos' },
];

export default function PhotoViewer({ photoURLs, initialSlot, onClose }) {
  const available = SLOTS.filter(s => photoURLs?.[s.key]);
  const [current, setCurrent] = useState(
    available.findIndex(s => s.key === initialSlot) || 0
  );

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(0, c - 1));
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(available.length - 1, c + 1));
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [available.length, onClose]);

  if (!available.length) return null;
  const photo = available[current];

  async function handleDownload() {
    try {
      const response = await fetch(photoURLs[photo.key]);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo_${photo.label.toLowerCase()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(photoURLs[photo.key], '_blank');
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
      {/* Header */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {available.map((s, i) => (
            <button key={s.key} onClick={() => setCurrent(i)} style={{
              padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
              background: i === current ? 'white' : 'rgba(255,255,255,0.2)',
              color: i === current ? '#1A1A2E' : 'white',
              transition: 'all 0.2s'
            }}>{s.label}</button>
          ))}
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
          width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>✕</button>
      </div>

      {/* Image */}
      <div onClick={e => e.stopPropagation()} style={{ maxHeight: '75vh', maxWidth: '90vw', position: 'relative' }}>
        <img
          src={photoURLs[photo.key]}
          alt={photo.label}
          style={{ maxHeight: '75vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: 8 }}
        />
      </div>

      {/* Navigation arrows */}
      {available.length > 1 && (
        <>
          {current > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setCurrent(c => c - 1); }}
              style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                width: 44, height: 44, cursor: 'pointer', color: 'white', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>‹</button>
          )}
          {current < available.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setCurrent(c => c + 1); }}
              style={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                width: 44, height: 44, cursor: 'pointer', color: 'white', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>›</button>
          )}
        </>
      )}

      {/* Footer with download */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '20px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
        }}>
        <button onClick={handleDownload} style={{
          background: 'white', color: '#1A1A2E', border: 'none',
          borderRadius: 100, padding: '10px 24px',
          fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
        }}>
          ⬇️ Télécharger {photo.label}
        </button>
      </div>
    </div>
  );
}
