// src/pages/MealPlan.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import TabBar from '../components/TabBar';

// Base de données d'aliments de référence
const DEFAULT_FOODS = {
  protein: [
    { name: 'Poulet / dinde', unit: 'g', gramsPerUnit: 1, protPer100g: 31, visual: '1 paume épaisse ≈ 120g', emoji: '🍗' },
    { name: 'Skyr', unit: 'g', gramsPerUnit: 1, protPer100g: 11, visual: '1 pot (150g) = 17g prot', emoji: '🥛' },
    { name: 'Fromage blanc 0%', unit: 'g', gramsPerUnit: 1, protPer100g: 8, visual: '200g = 16g prot', emoji: '🥛' },
    { name: 'Thon en boîte', unit: 'g', gramsPerUnit: 1, protPer100g: 25, visual: '1 boîte (140g égoutté)', emoji: '🐟' },
    { name: 'Œufs', unit: 'unité', gramsPerUnit: 60, protPer100g: 10, visual: '1 œuf = 6g prot · 70 kcal', emoji: '🥚' },
    { name: 'Saumon', unit: 'g', gramsPerUnit: 1, protPer100g: 25, visual: '1 beau filet ≈ 150g', emoji: '🐟' },
    { name: 'Jambon blanc', unit: 'tranche', gramsPerUnit: 45, protPer100g: 21, visual: '3-4 tranches', emoji: '🥩' },
    { name: 'Steak haché 5%', unit: 'g', gramsPerUnit: 1, protPer100g: 21, visual: '1 steak = 100g', emoji: '🥩' },
    { name: 'Tofu', unit: 'g', gramsPerUnit: 1, protPer100g: 17, visual: '½ bloc ≈ 150g', emoji: '🫘' },
    { name: 'Protéines végétales', unit: 'g', gramsPerUnit: 1, protPer100g: 70, visual: '1 dose (30g)', emoji: '💪' },
  ],
  carbs: [
    { name: 'Riz cuit', unit: 'c.s.', gramsPerUnit: 25, carbsPer100g: 28, visual: '6-8 c.s. = ¼ assiette', emoji: '🍚' },
    { name: 'Pâtes cuites', unit: 'c.s.', gramsPerUnit: 25, carbsPer100g: 25, visual: '6-8 c.s. = ¼ assiette', emoji: '🍝' },
    { name: 'Quinoa cuit', unit: 'c.s.', gramsPerUnit: 25, carbsPer100g: 22, visual: '6-8 c.s. = ¼ assiette', emoji: '🌾' },
    { name: 'Patate douce', unit: 'c.s.', gramsPerUnit: 30, carbsPer100g: 20, visual: '½ patate moyenne', emoji: '🍠' },
    { name: 'Pain complet', unit: 'tranche', gramsPerUnit: 35, carbsPer100g: 44, visual: '1 tranche ≈ 2,5 c.s.', emoji: '🍞' },
    { name: 'Flocons d\'avoine', unit: 'c.s.', gramsPerUnit: 15, carbsPer100g: 60, visual: '4-5 c.s. = 60g', emoji: '🥣' },
    { name: 'Lentilles cuites', unit: 'c.s.', gramsPerUnit: 30, carbsPer100g: 17, visual: '6-8 c.s. = ¼ assiette', emoji: '🫘' },
  ],
  fat: [
    { name: 'Huile d\'olive', unit: 'c.à.c', gramsPerUnit: 5, fatPer100g: 100, visual: '1 c.à.c = 5g lipides', emoji: '🫒' },
    { name: 'Avocat', unit: 'c.s.', gramsPerUnit: 25, fatPer100g: 15, visual: '¼ avocat = 4g lipides', emoji: '🥑' },
    { name: 'Amandes / noix', unit: 'unité', gramsPerUnit: 5, fatPer100g: 55, visual: '10-15 amandes ≈ 15g', emoji: '🥜' },
    { name: 'Beurre de cacahuète', unit: 'c.à.c', gramsPerUnit: 10, fatPer100g: 50, visual: '1 c.à.c = 5g lipides', emoji: '🥜' },
  ],
};

const MEAL_LABELS = {
  morning: { label: 'Petit-déjeuner', emoji: '🌅' },
  lunch: { label: 'Déjeuner', emoji: '☀️' },
  dinner: { label: 'Dîner', emoji: '🌙' },
  snack: { label: 'Collation', emoji: '🍱' },
};

function roundToHalf(n) { return Math.round(n * 2) / 2; }

function calcPortions(macro, amount, foods, macroKey) {
  // Calcule les meilleures équivalences pour un objectif macro donné
  return foods.map(food => {
    let grams, portions, label;
    if (macro === 'protein') {
      grams = (amount / food.protPer100g) * 100;
      if (food.unit === 'unité') { portions = roundToHalf(grams / food.gramsPerUnit); label = `${portions} ${portions <= 1 ? 'unité' : 'unités'}`; }
      else if (food.unit === 'tranche') { portions = roundToHalf(grams / food.gramsPerUnit); label = `${portions} ${portions <= 1 ? 'tranche' : 'tranches'}`; }
      else { label = `${Math.round(grams)} g`; }
    } else if (macro === 'carbs') {
      grams = (amount / food.carbsPer100g) * 100;
      if (food.unit === 'c.s.') { portions = roundToHalf(grams / food.gramsPerUnit); label = `${portions} c.s.`; }
      else if (food.unit === 'tranche') { portions = roundToHalf(grams / food.gramsPerUnit); label = `${portions} ${portions <= 1 ? 'tranche' : 'tranches'}`; }
      else { label = `${Math.round(grams)} g`; }
    } else if (macro === 'fat') {
      grams = (amount / food.fatPer100g) * 100;
      if (food.unit === 'c.à.c') { portions = roundToHalf(grams / food.gramsPerUnit); label = `${portions} c.à.c`; }
      else if (food.unit === 'c.s.') { portions = roundToHalf(grams / food.gramsPerUnit); label = `${portions} c.s.`; }
      else if (food.unit === 'unité') { portions = roundToHalf(grams / food.gramsPerUnit); label = `${portions} unités`; }
      else { label = `${Math.round(grams)} g`; }
    }
    return { ...food, label };
  });
}

export default function MealPlan() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [mealSplit, setMealSplit] = useState(null);
  const [customFoods, setCustomFoods] = useState({ protein: [], carbs: [], fat: [] });
  const [loading, setLoading] = useState(true);
  const [activeMeal, setActiveMeal] = useState('lunch');
  const [activeMacro, setActiveMacro] = useState('protein');

  useEffect(() => {
    async function load() {
      const profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        setProfile(data);
        setMealSplit(data.mealSplit || null);
        setCustomFoods(data.customFoods || { protein: [], carbs: [], fat: [] });
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid]);

  if (loading) return <div className="app-shell"><div className="loading"><div className="spinner" /></div></div>;
  if (!profile) return null;

  const targets = profile.targets || {};
  const totalCalories = targets.calories || 2000;
  const totalProtein = targets.protein || 130;
  const totalCarbs = targets.carbs || 150;
  const totalFat = targets.fat || 55;

  // Repas actifs selon mealSplit
  const defaultSplit = { morning: 25, lunch: 35, dinner: 30, snack: 10 };
  const split = mealSplit || defaultSplit;
  const meals = Object.entries(split).filter(([k, v]) => v > 0 && (k !== 'snack' || profile.hasSnack));

  // Si pas de mealSplit défini, afficher morning/lunch/dinner par défaut
  const MEAL_ORDER = ['morning', 'lunch', 'dinner', 'snack'];
  const activeMeals = mealSplit
    ? MEAL_ORDER.map(k => [k, split[k]]).filter(([, v]) => v > 0)
    : [['morning', 25], ['lunch', 35], ['dinner', 30]];

  function getMealMacros(mealKey, pct) {
    return {
      calories: Math.round(totalCalories * pct / 100),
      protein: Math.round(totalProtein * pct / 100),
      carbs: Math.round(totalCarbs * pct / 100),
      fat: Math.round(totalFat * pct / 100),
    };
  }

  const allFoods = {
    protein: [...DEFAULT_FOODS.protein, ...(customFoods.protein || [])],
    carbs: [...DEFAULT_FOODS.carbs, ...(customFoods.carbs || [])],
    fat: [...DEFAULT_FOODS.fat, ...(customFoods.fat || [])],
  };

  const currentMealPct = activeMeals.find(([k]) => k === activeMeal)?.[1] || 30;
  const mealMacros = getMealMacros(activeMeal, currentMealPct);

  const macroTabs = [
    { key: 'protein', label: 'Protéines', emoji: '🥩', color: '#7C3AED', amount: mealMacros.protein, unit: 'g' },
    { key: 'carbs', label: 'Glucides', emoji: '🍚', color: '#EC4899', amount: mealMacros.carbs, unit: 'g' },
    { key: 'fat', label: 'Lipides', emoji: '🥑', color: '#F59E0B', amount: mealMacros.fat, unit: 'g' },
  ];

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">🍽️ Fiches repas</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">

        {/* Assiette type */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🍽️ L'assiette type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: '½ assiette', sub: '🥦 Légumes', color: '#22C55E', bg: '#F0FDF4' },
              { label: '¼ assiette', sub: '🍗 Protéines', color: '#7C3AED', bg: '#F5F3FF' },
              { label: '¼ assiette', sub: '🍚 Glucides', color: '#EC4899', bg: '#FDF2F8' },
              { label: 'Petite portion', sub: '🥑 Lipides', color: '#F59E0B', bg: '#FFFBEB' },
            ].map(s => (
              <div key={s.sub} style={{ padding: '12px', borderRadius: 10, background: s.bg, textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.sub.split(' ')[0]}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub.split(' ').slice(1).join(' ')}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Mange lentement et en pleine conscience · Si tu as très faim : augmente les légumes et les protéines
          </p>
        </div>

        {/* Récap calories par repas */}
        <div style={{ marginBottom: 20 }}>
          <h2 className="section-title">Mes repas</h2>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {activeMeals.map(([key, pct]) => (
              <button key={key} onClick={() => setActiveMeal(key)} style={{
                flexShrink: 0, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                border: `2px solid ${activeMeal === key ? 'var(--primary)' : 'var(--border)'}`,
                background: activeMeal === key ? 'var(--primary-bg)' : 'white',
                cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 18 }}>{MEAL_LABELS[key]?.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: activeMeal === key ? 'var(--primary)' : 'var(--text)', marginTop: 2 }}>
                  {MEAL_LABELS[key]?.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{getMealMacros(key, pct).calories} kcal</div>
              </button>
            ))}
          </div>
        </div>

        {/* Macros du repas sélectionné */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            {MEAL_LABELS[activeMeal]?.emoji} {MEAL_LABELS[activeMeal]?.label} — {mealMacros.calories} kcal
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {macroTabs.map(m => (
              <button key={m.key} onClick={() => setActiveMacro(m.key)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `2px solid ${activeMacro === m.key ? m.color : 'var(--border)'}`,
                background: activeMacro === m.key ? `${m.color}15` : 'white',
                fontFamily: 'var(--font-body)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16 }}>{m.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.amount}g</div>
              </button>
            ))}
          </div>

          {/* Liste d'équivalences */}
          {(() => {
            const macro = macroTabs.find(m => m.key === activeMacro);
            const foods = calcPortions(activeMacro, macro.amount, allFoods[activeMacro]);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Pour atteindre <strong style={{ color: macro.color }}>{macro.amount}g de {macro.label.toLowerCase()}</strong> :
                </p>
                {foods.map((food, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg)', border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{food.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{food.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{food.visual}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: macro.color }}>{food.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Légumes */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🥦 Légumes</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: '#F0FDF4', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>🥦</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#22C55E' }}>½ assiette à chaque repas</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>8-10 grosses c.s. cuits · Si sensible au transit : préférer cuits</div>
            </div>
          </div>
        </div>

        {/* Fruits */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🍎 Fruits</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: '#FFF7ED', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>🍎</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#F97316' }}>2 à 3 fruits entiers par jour</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Pas en jus · 1 au petit-déjeuner · 1 en collation</div>
            </div>
          </div>
        </div>

        {/* Hydratation */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>💧 Hydratation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: '#EFF6FF', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>💧</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#3B82F6' }}>1,5 à 2L d'eau par jour</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Un peu plus les jours de sport · Commence chaque repas par un grand verre</div>
            </div>
          </div>
        </div>

        {/* Plaisir */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🎉 Plaisir</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            1 à 2 fois par semaine : une viennoiserie, un restau, une glace... Si restau, allège les glucides et lipides autour de ce repas. Si tu bouges plus, tu peux manger un peu plus.
          </div>
        </div>

      </div>
      <TabBar />
    </div>
  );
}
