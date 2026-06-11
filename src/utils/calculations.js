// src/utils/calculations.js

export const ACTIVITY_LEVELS = [
  { value: 'sedentaire', label: 'Sédentaire', description: 'Peu ou pas d\'exercice', multiplier: 1.2 },
  { value: 'leger', label: 'Légèrement actif', description: 'Exercice 1-3j/semaine', multiplier: 1.375 },
  { value: 'actif', label: 'Actif', description: 'Exercice 3-5j/semaine', multiplier: 1.55 },
  { value: 'tres_actif', label: 'Très actif', description: 'Exercice intense 6-7j/sem', multiplier: 1.725 },
  { value: 'extreme', label: 'Extrêmement actif', description: 'Athlète / travail physique', multiplier: 1.9 },
];

export const GOALS = [
  { value: 'seche', label: 'Sèche', description: 'Perte de graisse', calAdjust: -300 },
  { value: 'maintien', label: 'Maintien', description: 'Stabiliser le poids', calAdjust: 0 },
  { value: 'prise', label: 'Prise de masse', description: 'Gain musculaire', calAdjust: 250 },
];

export const WEEK_DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
];

export const FORMULES = [
  { value: 'gold', label: '🥇 Gold' },
  { value: 'platinium', label: '💎 Platinum' },
];

export function calculateAgeFromDOB(dob) {
  if (!dob) return null;
  try {
    const today = new Date();
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  } catch { return null; }
}

export function calculateBMR({ weight, height, age, sex }) {
  if (!weight || !height || !age) return null;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(sex === 'H' ? base + 5 : base - 161);
}

export function calculateTDEE({ bmr, activityLevel }) {
  if (!bmr) return null;
  const level = ACTIVITY_LEVELS.find(l => l.value === activityLevel);
  return Math.round(bmr * (level?.multiplier || 1.2));
}

export function calculateCalorieTarget({ tdee, goal }) {
  if (!tdee) return null;
  const g = GOALS.find(g => g.value === goal);
  return tdee + (g?.calAdjust || 0);
}

export function calculateMacros({ weight, calorieTarget, goal }) {
  if (!weight || !calorieTarget) return { protein: 0, fat: 0, carbs: 0 };
  const protein = Math.round(weight * 2);
  const fat = Math.round(goal === 'seche' ? weight * 0.8 : goal === 'prise' ? weight * 1.2 : weight * 1.0);
  const carbs = Math.round((calorieTarget - protein * 4 - fat * 9) / 4);
  return { protein, fat, carbs: Math.max(0, carbs) };
}

export function calculateBMI({ weight, height }) {
  if (!weight || !height) return null;
  const heightM = height / 100;
  return Math.round((weight / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi) {
  if (!bmi) return { label: '—', color: 'var(--text-muted)' };
  if (bmi < 18.5) return { label: 'Insuffisance pondérale', color: '#60a5fa' };
  if (bmi < 25) return { label: 'Poids normal', color: '#34d399' };
  if (bmi < 30) return { label: 'Surpoids', color: '#fbbf24' };
  return { label: 'Obésité', color: '#f87171' };
}
