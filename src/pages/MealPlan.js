// src/pages/MealPlan.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import TabBar from '../components/TabBar';

// ─── BASE DE DONNÉES NUTRITIONNELLES RÉELLES ───────────────────────────────
// Toutes les valeurs sont pour 100g (sauf indication), mesurées depuis MFP
const FOODS = {
  protein: [
    {
      name: 'Poulet / dinde', emoji: '🍗',
      kcalPer100g: 106, protPer100g: 23, lipPer100g: 1.5, glucPer100g: 0,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 paume épaisse ≈ 120g',
      portionHint: (g) => `${Math.round(g)}g — environ ${Math.round(g/120*10)/10} paume(s)`,
    },
    {
      name: 'Skyr', emoji: '🥛',
      kcalPer100g: 53, protPer100g: 8.7, lipPer100g: 0.5, glucPer100g: 4.9,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 pot = 150g · 1 c.s. ≈ 50g',
      portionHint: (g) => `${Math.round(g)}g — environ ${Math.round(g/50)} c.s.`,
    },
    {
      name: 'Fromage blanc 0%', emoji: '🥛',
      kcalPer100g: 79, protPer100g: 8.4, lipPer100g: 3.2, glucPer100g: 4,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 c.s. ≈ 50g · 1 pot = 100-150g',
      portionHint: (g) => `${Math.round(g)}g — environ ${Math.round(g/50)} c.s.`,
    },
    {
      name: 'Thon naturel', emoji: '🐟',
      kcalPer100g: 109, protPer100g: 25, lipPer100g: 1, glucPer100g: 0,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 boîte égoutée ≈ 140g',
      portionHint: (g) => `${Math.round(g)}g — environ ${Math.round(g/140*10)/10} boîte(s)`,
    },
    {
      name: 'Œuf entier', emoji: '🥚',
      kcalPer100g: 132, protPer100g: 11.3, lipPer100g: 9.4, glucPer100g: 0,
      // 1 œuf = 53g → 70 kcal, 6g prot, 5g lip
      unit: 'unité', gramsPerUnit: 53,
      visual: '1 œuf (53g) = 6g prot · 70 kcal',
      portionHint: (g) => {
        const units = Math.round(g / 53 * 2) / 2;
        return `${units} œuf(s) (${Math.round(units * 53)}g)`;
      },
    },
    {
      name: 'Saumon', emoji: '🐟',
      kcalPer100g: 136, protPer100g: 24, lipPer100g: 4.4, glucPer100g: 0,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 beau filet ≈ 150g',
      portionHint: (g) => `${Math.round(g)}g — environ ${Math.round(g/150*10)/10} filet(s)`,
    },
    {
      name: 'Jambon blanc', emoji: '🥩',
      kcalPer100g: 109, protPer100g: 21.8, lipPer100g: 1.8, glucPer100g: 1.8,
      unit: 'tranche', gramsPerUnit: 45,
      visual: '1 tranche ≈ 45g',
      portionHint: (g) => {
        const tr = Math.round(g / 45 * 2) / 2;
        return `${tr} tranche(s) (${Math.round(tr * 45)}g)`;
      },
    },
    {
      name: 'Steak haché 5%', emoji: '🥩',
      kcalPer100g: 193, protPer100g: 29.2, lipPer100g: 7.6, glucPer100g: 0,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 steak ≈ 100g',
      portionHint: (g) => `${Math.round(g)}g — ${Math.round(g/100*10)/10} steak(s)`,
    },
    {
      name: 'Tofu nature', emoji: '🫘',
      kcalPer100g: 169, protPer100g: 15, lipPer100g: 8, glucPer100g: 5.5,
      unit: 'g', gramsPerUnit: 1,
      visual: '½ bloc ≈ 150g · 1 c.s. ≈ 30g',
      portionHint: (g) => `${Math.round(g)}g — environ ${Math.round(g/30)} c.s.`,
    },
    {
      name: 'Protéine végétale texturée', emoji: '🌱',
      kcalPer100g: 327, protPer100g: 51.5, lipPer100g: 1.2, glucPer100g: 51.4,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 dose = 30g (sèche)',
      portionHint: (g) => `${Math.round(g)}g sec — environ ${Math.round(g/30)} dose(s)`,
    },
    {
      name: 'Whey (Impact MyProtein)', emoji: '💪',
      kcalPer100g: 381, protPer100g: 75, lipPer100g: 6.3, glucPer100g: 5.9,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 dose ≈ 25g',
      portionHint: (g) => `${Math.round(g)}g — environ ${Math.round(g/25*10)/10} dose(s)`,
    },
  ],
  carbs: [
    {
      name: 'Riz basmati', emoji: '🍚',
      kcalPer100g: 350, protPer100g: 7.4, lipPer100g: 0.6, glucPer100g: 78,
      unit: 'g_cru', gramsPerUnit: 1,
      visual: 'Peser CRU · 100g cru = 200g cuit ≈ 8 c.s.',
      portionHint: (g) => {
        const cuit = Math.round(g * 2);
        const cs = Math.round(cuit / 25);
        return `${Math.round(g)}g cru → ${cuit}g cuit ≈ ${cs} c.s.`;
      },
    },
    {
      name: 'Pâtes (penne/rigate)', emoji: '🍝',
      kcalPer100g: 356, protPer100g: 12, lipPer100g: 1.5, glucPer100g: 72.2,
      unit: 'g_cru', gramsPerUnit: 1,
      visual: 'Peser CRU · 100g cru = 200g cuit ≈ 8 c.s.',
      portionHint: (g) => {
        const cuit = Math.round(g * 2);
        const cs = Math.round(cuit / 25);
        return `${Math.round(g)}g cru → ${cuit}g cuit ≈ ${cs} c.s.`;
      },
    },
    {
      name: 'Quinoa cuit', emoji: '🌾',
      kcalPer100g: 151, protPer100g: 7.8, lipPer100g: 3.4, glucPer100g: 26.3,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 c.s. ≈ 25g cuit',
      portionHint: (g) => `${Math.round(g)}g cuit ≈ ${Math.round(g/25)} c.s.`,
    },
    {
      name: 'Patate douce', emoji: '🍠',
      kcalPer100g: 100, protPer100g: 1.2, lipPer100g: 0.3, glucPer100g: 23,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 petite patate ≈ 150g · 1 c.s. ≈ 30g',
      portionHint: (g) => `${Math.round(g)}g ≈ ${Math.round(g/30)} c.s.`,
    },
    {
      name: 'Pomme de terre', emoji: '🥔',
      kcalPer100g: 80, protPer100g: 2, lipPer100g: 0.1, glucPer100g: 19,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 moyenne ≈ 150g · 1 c.s. ≈ 30g',
      portionHint: (g) => `${Math.round(g)}g ≈ ${Math.round(g/150*10)/10} pomme(s) de terre`,
    },
    {
      name: 'Pain complet', emoji: '🍞',
      kcalPer100g: 250, protPer100g: 9, lipPer100g: 1.8, glucPer100g: 50.6,
      unit: 'tranche', gramsPerUnit: 35,
      visual: '1 tranche ≈ 35g',
      portionHint: (g) => {
        const tr = Math.round(g / 35 * 2) / 2;
        return `${tr} tranche(s) (${Math.round(tr * 35)}g)`;
      },
    },
    {
      name: 'Pain blanc', emoji: '🍞',
      kcalPer100g: 259, protPer100g: 9.3, lipPer100g: 2.8, glucPer100g: 50,
      unit: 'tranche', gramsPerUnit: 35,
      visual: '1 tranche ≈ 35g',
      portionHint: (g) => {
        const tr = Math.round(g / 35 * 2) / 2;
        return `${tr} tranche(s) (${Math.round(tr * 35)}g)`;
      },
    },
    {
      name: 'Flocons d\'avoine', emoji: '🥣',
      kcalPer100g: 364, protPer100g: 11, lipPer100g: 7, glucPer100g: 68.9,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 c.s. ≈ 15g · 1 bol = 60g',
      portionHint: (g) => `${Math.round(g)}g ≈ ${Math.round(g/15)} c.s.`,
    },
    {
      name: 'Lentilles cuites', emoji: '🫘',
      kcalPer100g: 94, protPer100g: 7.1, lipPer100g: 0.5, glucPer100g: 13,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 c.s. ≈ 30g cuit',
      portionHint: (g) => `${Math.round(g)}g cuit ≈ ${Math.round(g/30)} c.s.`,
    },
  ],
  fat: [
    {
      name: 'Huile d\'olive', emoji: '🫒',
      kcalPer100g: 900, protPer100g: 0, lipPer100g: 100, glucPer100g: 0,
      unit: 'ml', gramsPerUnit: 10, // 1 c.à.c = ~5ml, 1 c.s. = ~10ml
      visual: '1 c.à.c = 5ml = 45 kcal · 1 c.s. = 10ml = 90 kcal',
      portionHint: (g) => {
        const ml = Math.round(g / 1.0); // huile : 1ml ≈ 0.9g lipides → on simplifie
        const cs = Math.round(ml / 10 * 2) / 2;
        const cac = Math.round(ml / 5 * 2) / 2;
        return `${ml}ml ≈ ${cs} c.s. ou ${cac} c.à.c`;
      },
    },
    {
      name: 'Avocat', emoji: '🥑',
      kcalPer100g: 220, protPer100g: 2, lipPer100g: 22, glucPer100g: 3.5,
      unit: 'g', gramsPerUnit: 1,
      visual: '½ avocat ≈ 80g · ¼ avocat ≈ 40g',
      portionHint: (g) => `${Math.round(g)}g ≈ ${Math.round(g/80*10)/10} demi-avocat(s)`,
    },
    {
      name: 'Amandes', emoji: '🥜',
      kcalPer100g: 600, protPer100g: 21, lipPer100g: 53, glucPer100g: 21,
      unit: 'g', gramsPerUnit: 1,
      visual: '10g = 60 kcal ≈ 7-8 amandes',
      portionHint: (g) => `${Math.round(g)}g ≈ ${Math.round(g / 10 * 7)}-${Math.round(g / 10 * 8)} amandes`,
    },
    {
      name: 'Beurre de cacahuète', emoji: '🥜',
      kcalPer100g: 620, protPer100g: 29, lipPer100g: 50, glucPer100g: 12,
      unit: 'g', gramsPerUnit: 1,
      visual: '1 c.à.c = 10g · 1 c.s. = 20g',
      portionHint: (g) => {
        const cac = Math.round(g / 10 * 2) / 2;
        return `${Math.round(g)}g ≈ ${cac} c.à.c`;
      },
    },
  ],
};

const MEAL_ORDER = ['morning', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = {
  morning: { label: 'Petit-déjeuner', emoji: '🌅' },
  lunch: { label: 'Déjeuner', emoji: '☀️' },
  dinner: { label: 'Dîner', emoji: '🌙' },
  snack: { label: 'Collation', emoji: '🍱' },
};

// Calculer les grammes nécessaires pour atteindre targetG d'un macro
function gramsForMacro(food, macro, targetG) {
  const per100 = macro === 'protein' ? food.protPer100g
    : macro === 'carbs' ? food.glucPer100g
    : food.lipPer100g;
  if (!per100 || per100 === 0) return null;
  return (targetG / per100) * 100;
}

// Calories apportées par X grammes d'un aliment
function kcalFor(food, grams) {
  return Math.round((grams / 100) * food.kcalPer100g);
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
        // Définir le repas actif par défaut selon l'heure
        const h = new Date().getHours();
        if (h < 10) setActiveMeal('morning');
        else if (h < 15) setActiveMeal('lunch');
        else if (h < 20) setActiveMeal('dinner');
        else setActiveMeal('dinner');
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

  const defaultSplit = { morning: 25, lunch: 35, dinner: 30, snack: 0 };
  const split = mealSplit || defaultSplit;
  const activeMeals = MEAL_ORDER.filter(k => split[k] > 0 && (k !== 'snack' || profile.hasSnack))
    .map(k => [k, split[k]]);

  function getMealMacros(mealKey, pct) {
    return {
      calories: Math.round(totalCalories * pct / 100),
      protein: Math.round(totalProtein * pct / 100),
      carbs: Math.round(totalCarbs * pct / 100),
      fat: Math.round(totalFat * pct / 100),
    };
  }

  const allFoods = {
    protein: [...FOODS.protein, ...(customFoods.protein || [])],
    carbs: [...FOODS.carbs, ...(customFoods.carbs || [])],
    fat: [...FOODS.fat, ...(customFoods.fat || [])],
  };

  const currentMealPct = activeMeals.find(([k]) => k === activeMeal)?.[1] || 30;
  const mealMacros = getMealMacros(activeMeal, currentMealPct);

  const macroTabs = [
    { key: 'protein', label: 'Protéines', emoji: '🥩', color: '#7C3AED', amount: mealMacros.protein },
    { key: 'carbs', label: 'Glucides', emoji: '🍚', color: '#EC4899', amount: mealMacros.carbs },
    { key: 'fat', label: 'Lipides', emoji: '🥑', color: '#F59E0B', amount: mealMacros.fat },
  ];

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>←</Link>
        <div className="top-nav-title">🍽️ Fiches repas</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">

        {/* Info calories journalières */}
        <div className="card" style={{ marginBottom: 20, background: 'var(--primary-bg)', border: '1.5px solid var(--primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>Objectif journalier</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Dont ~180 kcal pour 2-3 fruits · {totalCalories - 180} kcal pour les repas
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--primary)' }}>{totalCalories}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>kcal / jour</div>
            </div>
          </div>
        </div>

        {/* Assiette type */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🍽️ L'assiette type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[
              { label: '½ assiette', sub: '🥦 Légumes', color: '#22C55E', bg: '#F0FDF4' },
              { label: '¼ assiette', sub: '🍗 Protéines', color: '#7C3AED', bg: '#F5F3FF' },
              { label: '¼ assiette', sub: '🍚 Glucides', color: '#EC4899', bg: '#FDF2F8' },
              { label: 'Petite portion', sub: '🥑 Lipides', color: '#F59E0B', bg: '#FFFBEB' },
            ].map(s => (
              <div key={s.sub} style={{ padding: '10px', borderRadius: 10, background: s.bg, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{s.sub.split(' ')[0]}</div>
                <div style={{ fontWeight: 700, fontSize: 12, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.sub.split(' ').slice(1).join(' ')}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Mange lentement · Si encore faim : augmente les légumes et les protéines
          </p>
        </div>

        {/* Sélection du repas */}
        <h2 className="section-title">Mes repas</h2>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
          {activeMeals.map(([key, pct]) => {
            const mm = getMealMacros(key, pct);
            return (
              <button key={key} onClick={() => setActiveMeal(key)} style={{
                flexShrink: 0, padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `2px solid ${activeMeal === key ? 'var(--primary)' : 'var(--border)'}`,
                background: activeMeal === key ? 'var(--primary-bg)' : 'white',
                fontFamily: 'var(--font-body)', transition: 'all 0.2s', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20 }}>{MEAL_LABELS[key]?.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: activeMeal === key ? 'var(--primary)' : 'var(--text)', marginTop: 2 }}>
                  {MEAL_LABELS[key]?.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {profile?.coachingMode !== 'intuitif' ? `${mm.calories} kcal` : `${pct}%`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Détail macros + équivalences */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            {MEAL_LABELS[activeMeal]?.emoji} {MEAL_LABELS[activeMeal]?.label}
            {profile?.coachingMode !== 'intuitif' && ` — ${mealMacros.calories} kcal`}
          </div>

          {/* Tabs macro */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {macroTabs.map(m => (
              <button key={m.key} onClick={() => setActiveMacro(m.key)} style={{
                flex: 1, padding: '10px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `2px solid ${activeMacro === m.key ? m.color : 'var(--border)'}`,
                background: activeMacro === m.key ? `${m.color}18` : 'white',
                fontFamily: 'var(--font-body)', textAlign: 'center', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 18 }}>{m.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: m.color, marginTop: 2 }}>{m.amount}g</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.label}</div>
              </button>
            ))}
          </div>

          {/* Liste équivalences */}
          {(() => {
            const macro = macroTabs.find(m => m.key === activeMacro);
            const foods = allFoods[activeMacro];
            const isIntuitif = profile?.coachingMode === 'intuitif';

            return (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Objectif <strong style={{ color: macro.color }}>{macro.label.toLowerCase()}</strong> pour ce repas.
                  Chaque ligne = <strong>1 portion de base</strong> et sa couverture :
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {foods.map((food, i) => {
                    const grams = gramsForMacro(food, activeMacro, macro.amount);
                    if (!grams || grams <= 0 || grams > 1200) return null;
                    const kcal = kcalFor(food, grams);
                    const calPct = Math.round((kcal / mealMacros.calories) * 100);

                    // Calculer pour 1 unité de base
                    let baseGrams, baseLabel, baseMacroPct, baseCalPct;
                    if (food.unit === 'unité') {
                      baseGrams = food.gramsPerUnit; // 1 œuf = 53g
                      baseLabel = '1 unité';
                    } else if (food.unit === 'tranche') {
                      baseGrams = food.gramsPerUnit;
                      baseLabel = '1 tranche';
                    } else if (food.unit === 'c.s.') {
                      baseGrams = food.gramsPerUnit;
                      baseLabel = '1 c.s.';
                    } else if (food.unit === 'c.à.c') {
                      baseGrams = food.gramsPerUnit;
                      baseLabel = '1 c.à.c';
                    } else if (food.unit === 'ml') {
                      baseGrams = food.gramsPerUnit;
                      baseLabel = '1 c.s. (10ml)';
                    } else if (food.unit === 'g_cru') {
                      // Pour le riz/pâtes on montre 50g cru comme base
                      baseGrams = 50;
                      baseLabel = '50g cru';
                    } else {
                      // Pour les aliments en grammes, montrer une portion de ~100g ou la portion recommandée
                      baseGrams = Math.min(Math.round(grams / 2 / 25) * 25, 200);
                      baseGrams = Math.max(baseGrams, 50);
                      baseLabel = `${baseGrams}g`;
                    }

                    const macroKey = activeMacro === 'protein' ? 'protPer100g' : activeMacro === 'carbs' ? 'glucPer100g' : 'lipPer100g';
                    const baseMacroG = Math.round((baseGrams / 100) * food[macroKey] * 10) / 10;
                    baseMacroPct = Math.round((baseMacroG / macro.amount) * 100);
                    baseCalPct = Math.round((kcalFor(food, baseGrams) / mealMacros.calories) * 100);

                    // Combien de cette base pour couvrir l'objectif
                    const portions = Math.round((macro.amount / baseMacroG) * 10) / 10;
                    const portionText = food.portionHint ? food.portionHint(grams) : `${Math.round(grams)}g`;

                    // Couleur selon couverture calorique de la portion complète
                    const calColor = calPct > 75 ? 'var(--danger)' : calPct > 50 ? 'var(--warning)' : 'var(--success)';

                    return (
                      <div key={i} style={{
                        borderRadius: 10, border: '1px solid var(--border-light)',
                        background: 'var(--bg)', overflow: 'hidden',
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{food.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{food.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{food.visual}</div>
                          </div>
                        </div>
                        {/* Base unit */}
                        <div style={{ padding: '8px 12px', background: 'white' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>1 portion de base ({baseLabel})</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: macro.color }}>{baseMacroPct}% {activeMacro === 'protein' ? 'prot.' : activeMacro === 'carbs' ? 'gluc.' : 'lip.'}</span>
                              {!isIntuitif && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{baseCalPct}% cal.</span>}
                            </div>
                          </div>
                          {/* Barre de progression macro */}
                          <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3 }}>
                            <div style={{ height: '100%', borderRadius: 3, background: macro.color, width: `${Math.min(100, baseMacroPct)}%`, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        {/* Portion recommandée pour le repas */}
                        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Portion recommandée pour ce repas</span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: macro.color }}>{portionText}</div>
                            {!isIntuitif && <div style={{ fontSize: 10, color: calColor }}>{calPct}% des calories du repas</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </div>

        {/* Fruits */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🍎 Fruits — ~180 kcal/jour</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: '#FFF7ED', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>🍎</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#F97316' }}>2 à 3 fruits entiers par jour</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                ≈ 180 kcal déjà inclus dans ton objectif · 1 fruit = 50-80 kcal<br/>
                Idéalement : 1 au petit-déjeuner + 1 en collation ou dessert · Pas en jus
              </div>
            </div>
          </div>
        </div>

        {/* Légumes */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🥦 Légumes — à volonté</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: '#F0FDF4', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>🥦</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#22C55E' }}>½ assiette à chaque repas principal</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                250-300g · 8-10 c.s. cuits · Crus ou cuits selon tolérance digestive<br/>
                Légumes cuits si sensible au transit
              </div>
            </div>
          </div>
        </div>

        {/* Hydratation */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>💧 Hydratation</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: '#EFF6FF', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>💧</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#3B82F6' }}>1,5 à 2L d'eau par jour minimum</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                Plus les jours de sport · Commence chaque repas par un grand verre<br/>
                Thé/café sans sucre comptent · Pas de boissons sucrées
              </div>
            </div>
          </div>
        </div>

        {/* Plaisir */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🎉 Repas plaisir</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            1 à 2 fois par semaine : restau, viennoiserie, glace... Si restau → allège les glucides et lipides autour. Si tu bouges plus → tu peux manger un peu plus.
          </div>
        </div>

      </div>
      <TabBar />
    </div>
  );
}
