# 🌿 Manon Castello — Coaching Nutrition App
## Guide de déploiement complet

---

## Ce que fait l'app

### Côté client (coaché·e)
- Inscription en 5 étapes : compte, identité, mesures, objectifs, résumé
- Calcul automatique BMR, TDEE, macros
- Dashboard quotidien avec barre de progression calories/pas
- Suivi quotidien : poids, pas, calories, protéines, sommeil, notes
- Bilan hebdomadaire : mensurations + questionnaire 5 critères + questions ouvertes
- Graphique d'évolution du poids
- Rappel quotidien à l'heure choisie (via notification navigateur)

### Côté coach (toi)
- Espace protégé (compte Firebase séparé avec rôle "coach")
- Vue d'ensemble : combien de clients ont fait leur suivi aujourd'hui
- Fiche détaillée par client : graphique poids, journal 14j, bilan hebdo
- Modification des objectifs (calories, macros, pas, sommeil, kcal/1000 pas)

---

## Étape 1 — Créer le projet Firebase

1. Va sur https://console.firebase.google.com
2. "Créer un projet" → donne-lui un nom
3. **Authentication** : Activer > Email/Mot de passe
4. **Firestore** : Créer une base de données (mode production)
5. **Project Settings** → "Tes apps" → Ajouter une app Web → Copie la config

---

## Étape 2 — Configurer Firebase dans l'app

Ouvre `src/firebase.js` et remplace les valeurs :

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## Étape 3 — Règles Firestore

Dans Firebase Console > Firestore > Règles, colle ceci :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Coaches can read all clients
    match /coaches/{coachId} {
      allow read, write: if request.auth != null && request.auth.uid == coachId;
    }
    
    // Clients can only access their own data
    match /clients/{clientId} {
      allow read, write: if request.auth != null && request.auth.uid == clientId;
      
      match /dailyEntries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == clientId;
      }
      match /weeklyEntries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == clientId;
      }
    }
    
    // Coaches can read all clients data
    match /clients/{clientId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/coaches/$(request.auth.uid));
      
      match /dailyEntries/{entryId} {
        allow read: if request.auth != null && 
          exists(/databases/$(database)/documents/coaches/$(request.auth.uid));
      }
      match /weeklyEntries/{entryId} {
        allow read: if request.auth != null && 
          exists(/databases/$(database)/documents/coaches/$(request.auth.uid));
      }
    }
  }
}
```

---

## Étape 4 — Créer ton compte coach

1. Va sur ton app déployée, crée un compte avec ton email coach
2. Dans Firebase Console > Authentication, copie ton UID
3. Dans Firestore > Créer une collection `coaches` > Nouveau document avec **ton UID comme ID**
4. Ajoute le champ : `role: "coach"`

Désormais quand tu te connectes, tu arrives sur l'espace coach.

---

## Étape 5 — Installer et lancer en local

```bash
cd coaching-app
npm install
npm start
```

L'app tourne sur http://localhost:3000

---

## Étape 6 — Déployer sur Vercel (recommandé, gratuit)

1. Crée un compte sur https://vercel.com
2. "Add New Project" → importe le dossier ou connecte GitHub
3. Build command : `npm run build`
4. Output directory : `build`
5. Deploy → tu obtiens une URL du type `ton-projet.vercel.app`

Tu peux aussi utiliser ton propre nom de domaine dans les settings Vercel.

---

## Installer comme app iPhone (PWA)

1. Ouvre l'URL dans Safari sur iPhone
2. Bouton partage (carré avec flèche) → "Sur l'écran d'accueil"
3. L'app apparaît comme une vraie app, plein écran

---

## Pour les notifications

Les notifications navigateur PWA sur iOS fonctionnent depuis iOS 16.4.
L'app demande l'autorisation automatiquement au premier login.

---

## Structure des données Firestore

```
clients/
  {userId}/
    firstName, lastName, sex, age, profession
    weight, height, activityLevel, goal
    bmr, tdee, reminderTime
    targets: { calories, protein, fat, carbs, steps, sleep, kcalPer1000Steps }
    
    dailyEntries/
      {YYYY-MM-DD}/
        date, weight, steps, calories, protein, sleep, sleepQuality, notes
    
    weeklyEntries/
      {YYYY-MM-DD (lundi)}/
        weekStart, avgWeight
        measurements: { waist, hips, thighs, arms, chest }
        questionnaire: { energy, hunger, motivation, stress, adherence }
        weekHighlight, weekDifficulty, weekNotes

coaches/
  {coachId}/
    role: "coach"
```
