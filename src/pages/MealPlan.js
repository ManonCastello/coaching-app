// src/pages/MealPlan.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import TabBar from '../components/TabBar';

const FOODS = {
  protein: [
    { id: 'poulet', name: 'Poulet / dinde', emoji: '🍗', kcal: 106, prot: 23, lip: 1.5, gluc: 0, baseGrams: 120, baseLabel: '1 paume (120g)', altLabel: function(n) { return Math.round(n*120) + 'g'; } },
    { id: 'skyr', name: 'Skyr', emoji: '🥛', kcal: 53, prot: 8.7, lip: 0.5, gluc: 4.9, baseGrams: 50, baseLabel: '1 c.s. (50g)', altLabel: function(n) { return (Math.round(n*2*10)/10) + ' c.s.'; } },
    { id: 'fb', name: 'Fromage blanc 0%', emoji: '🥛', kcal: 79, prot: 8.4, lip: 3.2, gluc: 4, baseGrams: 50, baseLabel: '1 c.s. (50g)', altLabel: function(n) { return (Math.round(n*2*10)/10) + ' c.s.'; } },
    { id: 'thon', name: 'Thon naturel', emoji: '🐟', kcal: 109, prot: 25, lip: 1, gluc: 0, baseGrams: 140, baseLabel: '1 boite (140g)', altLabel: function(n) { return Math.round(n*140) + 'g'; } },
    { id: 'oeuf', name: 'Oeuf entier', emoji: '🥚', kcal: 132, prot: 11.3, lip: 9.4, gluc: 0, baseGrams: 53, baseLabel: '1 oeuf (53g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' oeuf(s)'; } },
    { id: 'saumon', name: 'Saumon', emoji: '🐟', kcal: 136, prot: 24, lip: 4.4, gluc: 0, baseGrams: 150, baseLabel: '1 filet (150g)', altLabel: function(n) { return Math.round(n*150) + 'g'; } },
    { id: 'jambon', name: 'Jambon blanc', emoji: '🥩', kcal: 109, prot: 21.8, lip: 1.8, gluc: 1.8, baseGrams: 45, baseLabel: '1 tranche (45g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' tranche(s)'; } },
    { id: 'steak', name: 'Steak hache 5%', emoji: '🥩', kcal: 193, prot: 29.2, lip: 7.6, gluc: 0, baseGrams: 100, baseLabel: '1 steak (100g)', altLabel: function(n) { return Math.round(n*100) + 'g'; } },
    { id: 'tofu', name: 'Tofu nature', emoji: '🫘', kcal: 169, prot: 15, lip: 8, gluc: 5.5, baseGrams: 30, baseLabel: '1 c.s. (30g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' c.s.'; } },
    { id: 'pvt', name: 'Proteine vegetale', emoji: '🌱', kcal: 327, prot: 51.5, lip: 1.2, gluc: 51.4, baseGrams: 30, baseLabel: '1 dose (30g)', altLabel: function(n) { return Math.round(n*30) + 'g'; } },
    { id: 'whey', name: 'Whey', emoji: '💪', kcal: 381, prot: 75, lip: 6.3, gluc: 5.9, baseGrams: 25, baseLabel: '1 dose (25g)', altLabel: function(n) { return Math.round(n*25) + 'g'; } },
  ],
  carbs: [
    { id: 'riz', name: 'Riz basmati', emoji: '🍚', kcal: 350, prot: 7.4, lip: 0.6, gluc: 78, baseGrams: 50, baseLabel: '50g cru = 100g cuit = 4 c.s.', altLabel: function(n) { return Math.round(n*50) + 'g cru = ' + Math.round(n*100) + 'g cuit = ' + (Math.round(n*4*10)/10) + ' c.s.'; } },
    { id: 'pates', name: 'Pates', emoji: '🍝', kcal: 356, prot: 12, lip: 1.5, gluc: 72.2, baseGrams: 50, baseLabel: '50g cru = 100g cuit = 4 c.s.', altLabel: function(n) { return Math.round(n*50) + 'g cru = ' + Math.round(n*100) + 'g cuit = ' + (Math.round(n*4*10)/10) + ' c.s.'; } },
    { id: 'quinoa', name: 'Quinoa cuit', emoji: '🌾', kcal: 151, prot: 7.8, lip: 3.4, gluc: 26.3, baseGrams: 25, baseLabel: '1 c.s. (25g cuit)', altLabel: function(n) { return (Math.round(n*10)/10) + ' c.s.'; } },
    { id: 'pdouce', name: 'Patate douce', emoji: '🍠', kcal: 100, prot: 1.2, lip: 0.3, gluc: 23, baseGrams: 30, baseLabel: '1 c.s. (30g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' c.s.'; } },
    { id: 'pdterre', name: 'Pomme de terre', emoji: '🥔', kcal: 80, prot: 2, lip: 0.1, gluc: 19, baseGrams: 150, baseLabel: '1 pomme de terre (150g)', altLabel: function(n) { return Math.round(n*150) + 'g'; } },
    { id: 'pain_c', name: 'Pain complet', emoji: '🍞', kcal: 250, prot: 9, lip: 1.8, gluc: 50.6, baseGrams: 35, baseLabel: '1 tranche (35g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' tranche(s)'; } },
    { id: 'pain_b', name: 'Pain blanc', emoji: '🍞', kcal: 259, prot: 9.3, lip: 2.8, gluc: 50, baseGrams: 35, baseLabel: '1 tranche (35g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' tranche(s)'; } },
    { id: 'avoine', name: "Flocons d'avoine", emoji: '🥣', kcal: 364, prot: 11, lip: 7, gluc: 68.9, baseGrams: 15, baseLabel: '1 c.s. (15g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' c.s.'; } },
    { id: 'lentilles', name: 'Lentilles cuites', emoji: '🫘', kcal: 94, prot: 7.1, lip: 0.5, gluc: 13, baseGrams: 30, baseLabel: '1 c.s. (30g cuit)', altLabel: function(n) { return (Math.round(n*10)/10) + ' c.s.'; } },
  ],
  fat: [
    { id: 'huile', name: "Huile d'olive", emoji: '🫒', kcal: 900, prot: 0, lip: 100, gluc: 0, baseGrams: 5, baseLabel: '1 c.a.c (5ml)', altLabel: function(n) { return (Math.round(n*10)/10) + ' c.a.c'; } },
    { id: 'avocat', name: 'Avocat', emoji: '🥑', kcal: 220, prot: 2, lip: 22, gluc: 3.5, baseGrams: 80, baseLabel: '1/2 avocat (80g)', altLabel: function(n) { return Math.round(n*80) + 'g'; } },
    { id: 'amandes', name: 'Amandes', emoji: '🥜', kcal: 600, prot: 21, lip: 53, gluc: 21, baseGrams: 10, baseLabel: '10g = 7-8 amandes', altLabel: function(n) { return Math.round(n*10) + 'g'; } },
    { id: 'bdc', name: 'Beurre de cacahuete', emoji: '🥜', kcal: 620, prot: 29, lip: 50, gluc: 12, baseGrams: 10, baseLabel: '1 c.a.c (10g)', altLabel: function(n) { return (Math.round(n*10)/10) + ' c.a.c'; } },
  ],
};

const ALL_FOODS = [...FOODS.protein, ...FOODS.carbs, ...FOODS.fat];
const VEG_KCAL = 160, VEG_PROT = 5, VEG_GLUC = 18, VEG_LIP = 0.5;
const FRUIT_KCAL = 180;

const MEAL_ORDER = ['morning', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = {
  morning: { label: 'Petit-dejeuner', emoji: '🌅' },
  lunch: { label: 'Dejeuner', emoji: '☀️' },
  dinner: { label: 'Diner', emoji: '🌙' },
  snack: { label: 'Collation', emoji: '🍱' },
};

const CATS = [
  { key: 'protein', label: 'Proteines', emoji: '🥩', color: '#7C3AED' },
  { key: 'carbs', label: 'Glucides', emoji: '🍚', color: '#EC4899' },
  { key: 'fat', label: 'Lipides', emoji: '🥑', color: '#F59E0B' },
];

function macrosForPortions(portions) {
  var kcal = 0, prot = 0, gluc = 0, lip = 0;
  Object.entries(portions).forEach(function(entry) {
    var id = entry[0], qty = entry[1];
    if (!qty) return;
    var food = ALL_FOODS.find(function(f) { return f.id === id; });
    if (!food) return;
    var g = food.baseGrams * qty;
    kcal += (g / 100) * food.kcal;
    prot += (g / 100) * food.prot;
    gluc += (g / 100) * food.gluc;
    lip  += (g / 100) * food.lip;
  });
  return { kcal: Math.round(kcal), prot: Math.round(prot*10)/10, gluc: Math.round(gluc*10)/10, lip: Math.round(lip*10)/10 };
}

export default function MealPlan() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [mealSplit, setMealSplit] = useState(null);
  const [customFoods, setCustomFoods] = useState({ protein: [], carbs: [], fat: [] });
  const [loading, setLoading] = useState(true);
  const [activeMeal, setActiveMeal] = useState('lunch');
  const [portions, setPortions] = useState({});
  const [activeCategory, setActiveCategory] = useState('protein');

  useEffect(function() {
    async function load() {
      var profileDoc = await getDoc(doc(db, 'clients', currentUser.uid));
      if (profileDoc.exists()) {
        var data = profileDoc.data();
        setProfile(data);
        setMealSplit(data.mealSplit || null);
        setCustomFoods(data.customFoods || { protein: [], carbs: [], fat: [] });
        var h = new Date().getHours();
        if (h < 10) setActiveMeal('morning');
        else if (h < 15) setActiveMeal('lunch');
        else setActiveMeal('dinner');
      }
      setLoading(false);
    }
    load();
  }, [currentUser.uid]);

  if (loading) return React.createElement('div', { className: 'app-shell' }, React.createElement('div', { className: 'loading' }, React.createElement('div', { className: 'spinner' })));
  if (!profile) return null;

  var targets = profile.targets || {};
  var totalCal = targets.calories || 2000;
  var totalProt = targets.protein || 130;
  var totalCarbs = targets.carbs || 150;
  var totalFat = targets.fat || 55;
  var isIntuitif = profile.coachingMode === 'intuitif';

  var defaultSplit = { morning: 25, lunch: 35, dinner: 30, snack: 0 };
  var split = mealSplit || defaultSplit;
  var activeMeals = MEAL_ORDER
    .filter(function(k) { return split[k] > 0 && (k !== 'snack' || profile.hasSnack); })
    .map(function(k) { return [k, split[k]]; });

  function getMealBudget(mealKey, pct) {
    var isMain = mealKey === 'lunch' || mealKey === 'dinner';
    var mainCount = activeMeals.filter(function(m) { return m[0] === 'lunch' || m[0] === 'dinner'; }).length || 1;
    var cal = Math.round((totalCal - FRUIT_KCAL) * pct / 100) - (isMain ? VEG_KCAL : 0);
    var prt = Math.round(totalProt * pct / 100) - (isMain ? Math.round(VEG_PROT * 2 / mainCount) : 0);
    var crb = Math.round(totalCarbs * pct / 100) - (isMain ? Math.round(VEG_GLUC * 2 / mainCount) : 0);
    var fat = Math.round(totalFat * pct / 100) - (isMain ? Math.round(VEG_LIP * 2 / mainCount) : 0);
    return { cal: Math.max(cal, 0), prot: Math.max(prt, 0), carbs: Math.max(crb, 0), fat: Math.max(fat, 0) };
  }

  var currentPct = (activeMeals.find(function(m) { return m[0] === activeMeal; }) || [activeMeal, 30])[1];
  var budget = getMealBudget(activeMeal, currentPct);
  var eaten = macrosForPortions(portions);

  var remaining = {
    cal: Math.max(0, budget.cal - eaten.kcal),
    prot: Math.max(0, budget.prot - eaten.prot),
    carbs: Math.max(0, budget.carbs - eaten.carbs),
    fat: Math.max(0, budget.fat - eaten.fat),
  };

  function changeQty(id, delta) {
    setPortions(function(p) {
      var current = p[id] || 0;
      // Premier ajout : toujours partir à 1
      var next = current === 0 && delta > 0 ? 1 : Math.round((current + delta) * 10) / 10;
      if (next <= 0) { var copy = Object.assign({}, p); delete copy[id]; return copy; }
      return Object.assign({}, p, { [id]: next });
    });
  }

  var allFoods = {
    protein: FOODS.protein.concat(customFoods.protein || []),
    carbs: FOODS.carbs.concat(customFoods.carbs || []),
    fat: FOODS.fat.concat(customFoods.fat || []),
  };

  function suggestQty(food, macroKey) {
    var rem = remaining[macroKey];
    if (!rem || rem <= 0) return null;
    var macroPerBase = (food.baseGrams / 100) * (macroKey === 'prot' ? food.prot : macroKey === 'carbs' ? food.gluc : food.lip);
    if (!macroPerBase || macroPerBase <= 0) return null;
    var qty = Math.round((rem / macroPerBase) * 10) / 10;
    return qty > 0 ? qty : null;
  }

  var calPct = budget.cal > 0 ? Math.min(100, Math.round((eaten.kcal / budget.cal) * 100)) : 0;
  var protPct = budget.prot > 0 ? Math.min(100, Math.round((eaten.prot / budget.prot) * 100)) : 0;
  var carbsPct = budget.carbs > 0 ? Math.min(100, Math.round((eaten.carbs / budget.carbs) * 100)) : 0;
  var fatPct = budget.fat > 0 ? Math.min(100, Math.round((eaten.fat / budget.fat) * 100)) : 0;

  var macroSuggestKey = activeCategory === 'protein' ? 'prot' : activeCategory === 'carbs' ? 'carbs' : 'fat';
  var catColor = (CATS.find(function(c) { return c.key === activeCategory; }) || {}).color || 'var(--primary)';

  var macrobars = [
    { label: 'Proteines', eaten: eaten.prot, budget: budget.prot, pct: protPct, color: '#7C3AED', unit: 'g' },
    { label: 'Glucides', eaten: eaten.gluc, budget: budget.carbs, pct: carbsPct, color: '#EC4899', unit: 'g' },
    { label: 'Lipides', eaten: eaten.lip, budget: budget.fat, pct: fatPct, color: '#F59E0B', unit: 'g' },
  ];
  if (!isIntuitif) macrobars.push({ label: 'Calories', eaten: eaten.kcal, budget: budget.cal, pct: calPct, color: '#6B7280', unit: 'kcal' });

  return (
    <div className="app-shell">
      <div className="top-nav">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: 22 }}>{'<'}</Link>
        <div className="top-nav-title">Fiches repas</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page">

        {/* Assiette type */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>L'assiette type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: '1/2 assiette', sub: 'Legumes', color: '#22C55E', bg: '#F0FDF4', emoji: '🥦' },
              { label: '1/4 assiette', sub: 'Proteines', color: '#7C3AED', bg: '#F5F3FF', emoji: '🍗' },
              { label: '1/4 assiette', sub: 'Glucides', color: '#EC4899', bg: '#FDF2F8', emoji: '🍚' },
              { label: 'Petite portion', sub: 'Lipides', color: '#F59E0B', bg: '#FFFBEB', emoji: '🥑' },
            ].map(function(s) {
              return (
                <div key={s.sub} style={{ padding: '8px', borderRadius: 8, background: s.bg, textAlign: 'center' }}>
                  <div style={{ fontSize: 16 }}>{s.emoji}</div>
                  <div style={{ fontWeight: 700, fontSize: 11, color: s.color }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Repas tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
          {activeMeals.map(function(meal) {
            var key = meal[0], pct = meal[1];
            var b = getMealBudget(key, pct);
            var isActive = activeMeal === key;
            return (
              <button key={key} onClick={function() { setActiveMeal(key); setPortions({}); }} style={{
                flexShrink: 0, padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: '2px solid ' + (isActive ? 'var(--primary)' : 'var(--border)'),
                background: isActive ? 'var(--primary-bg)' : 'white',
                fontFamily: 'var(--font-body)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18 }}>{MEAL_LABELS[key].emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--primary)' : 'var(--text)', marginTop: 2 }}>
                  {MEAL_LABELS[key].label}
                </div>
                {!isIntuitif && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.cal} kcal</div>}
              </button>
            );
          })}
        </div>

        {/* Budget + barres */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {MEAL_LABELS[activeMeal].emoji} {MEAL_LABELS[activeMeal].label}
            </div>
            {(activeMeal === 'lunch' || activeMeal === 'dinner') && (
              <span style={{ fontSize: 11, color: '#22C55E', background: '#F0FDF4', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
                250g legumes inclus
              </span>
            )}
          </div>

          {macrobars.map(function(m) {
            return (
              <div key={m.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: m.color }}>{m.label}</span>
                  <span style={{ color: m.pct >= 100 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {m.pct >= 100 ? '✅ ' : ''}{m.eaten}{m.unit} / {m.budget}{m.unit}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 4 }}>
                  <div style={{ height: '100%', borderRadius: 4, background: m.pct >= 100 ? '#22C55E' : m.color, width: m.pct + '%', transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })}

          {Object.keys(portions).length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Dans mon assiette :</div>
              {Object.entries(portions).map(function(entry) {
                var id = entry[0], qty = entry[1];
                var food = ALL_FOODS.find(function(f) { return f.id === id; });
                if (!food) return null;
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{food.emoji} {food.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{food.altLabel(qty)}</span>
                      <button onClick={function() { changeQty(id, -0.5); }} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>-</button>
                      <input
                        type="number"
                        value={qty}
                        step="0.1"
                        min="0.1"
                        onChange={function(e) {
                          var val = parseFloat(e.target.value.replace(',', '.'));
                          if (!isNaN(val) && val > 0) setPortions(function(p) { return Object.assign({}, p, { [id]: Math.round(val * 10) / 10 }); });
                        }}
                        style={{ width: 36, textAlign: 'center', fontSize: 13, fontWeight: 700, border: 'none', borderBottom: '1.5px solid var(--primary)', background: 'transparent', fontFamily: 'var(--font-body)', outline: 'none' }}
                      />
                      <button onClick={function() { changeQty(id, 0.5); }} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--primary)', background: 'var(--primary-bg)', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Constructeur */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Composer mon repas</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {CATS.map(function(cat) {
              var isActive = activeCategory === cat.key;
              return (
                <button key={cat.key} onClick={function() { setActiveCategory(cat.key); }} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  border: '2px solid ' + (isActive ? cat.color : 'var(--border)'),
                  background: isActive ? cat.color + '18' : 'white',
                  fontFamily: 'var(--font-body)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 16 }}>{cat.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: cat.color, marginTop: 2 }}>{cat.label}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allFoods[activeCategory].map(function(food) {
              var qty = portions[food.id] || 0;
              var isSelected = qty > 0;
              var macroKey = activeCategory === 'protein' ? 'prot' : activeCategory === 'carbs' ? 'carbs' : 'fat';
              var sugQty = !isSelected ? suggestQty(food, macroKey) : null;
              var macroPerBase = (food.baseGrams / 100) * (activeCategory === 'protein' ? food.prot : activeCategory === 'carbs' ? food.gluc : food.lip);
              var budgetMacro = budget[macroKey === 'prot' ? 'prot' : macroKey === 'carbs' ? 'carbs' : 'fat'] || 1;
              var basePct = Math.round((macroPerBase / budgetMacro) * 100);

              return (
                <div key={food.id} style={{
                  borderRadius: 10,
                  border: '1.5px solid ' + (isSelected ? catColor : 'var(--border-light)'),
                  background: isSelected ? catColor + '08' : 'white',
                  overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{food.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{food.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {food.baseLabel} = {basePct}% {activeCategory === 'protein' ? 'prot.' : activeCategory === 'carbs' ? 'gluc.' : 'lip.'} du repas
                      </div>
                      {sugQty !== null && (
                        <div style={{ fontSize: 11, color: catColor, fontWeight: 600, marginTop: 2 }}>
                          Suggestion : {food.altLabel(sugQty)} pour completer
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {isSelected && (
                        <button onClick={function() { changeQty(food.id, -0.5); }} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', color: 'var(--text)' }}>-</button>
                      )}
                      {isSelected && (
                        <input
                          type="number"
                          value={qty}
                          step="0.1"
                          min="0.1"
                          onChange={function(e) {
                            var val = parseFloat(e.target.value.replace(',', '.'));
                            if (!isNaN(val) && val > 0) {
                              setPortions(function(p) { return Object.assign({}, p, { [food.id]: Math.round(val * 10) / 10 }); });
                            }
                          }}
                          style={{ width: 40, textAlign: 'center', fontSize: 13, fontWeight: 800, color: catColor, border: 'none', borderBottom: '1.5px solid ' + catColor, background: 'transparent', fontFamily: 'var(--font-body)', outline: 'none' }}
                        />
                      )}
                      <button onClick={function() { changeQty(food.id, 0.5); }} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid ' + catColor, background: isSelected ? catColor : 'white', cursor: 'pointer', fontWeight: 700, fontSize: 16, color: isSelected ? 'white' : catColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>+</button>
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ padding: '4px 12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>
                      {food.altLabel(qty)} · {Math.round((food.baseGrams * qty / 100) * food.prot * 10) / 10}g prot · {Math.round((food.baseGrams * qty / 100) * food.gluc * 10) / 10}g gluc · {Math.round((food.baseGrams * qty / 100) * food.lip * 10) / 10}g lip{!isIntuitif ? ' · ' + Math.round((food.baseGrams * qty / 100) * food.kcal) + ' kcal' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fruits */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🍎 Fruits — 2 à 3 / jour</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: '#FEF3C7', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>🍎</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {isIntuitif
                ? 'Mange 2 à 3 fruits par jour. Pas en jus.'
                : '~180 kcal déjà déduits de ton objectif journalier · 1 fruit = 50–80 kcal · Pas en jus'
              }
            </div>
          </div>
        </div>

        {/* Hydratation */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>💧 Hydratation</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: '#EFF6FF', borderRadius: 10 }}>
            <span style={{ fontSize: 28 }}>💧</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              1,5 à 2L d'eau par jour minimum<br />
              Plus les jours de sport · Commence chaque repas par un grand verre<br />
              Thé/café sans sucre comptent · Pas de boissons sucrées
            </div>
          </div>
        </div>

        {/* Repas plaisir */}
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
