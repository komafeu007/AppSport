# AppSport Local

Application mobile (Expo + React Native + TypeScript) de suivi d'entraînement : catalogue d'exercices, recherche, génération de programme et journal de séances. Interface **dark mode haut contraste**, textes et données en **français**.

> 📌 **Document vivant** — ce README est mis à jour à chaque évolution. On coche la feuille de route et on ajuste les sections plutôt que de tout réécrire.

## État du projet

- [x] Base SQLite locale (migrations versionnées) + catalogue de **1 324 exercices**
- [x] **Recherche** par nom (FR/EN) ou par muscle (résultats *Principal* puis *Secondaire*)
- [x] Vignettes **embarquées** (hors-ligne) + **GIF** à la demande dans la vue détail
- [ ] Module 1 — Onboarding (profil : prénom, âge, poids, taille, douleurs, matériel, fréquence, durée)
- [ ] Module 2 — Programme (PPL / FullBody / Upper-Lower, substitution par groupe musculaire)
- [ ] Module 3 — Live Workout (minuteur auto, saisie poids/reps, exercices volatiles)
- [ ] Module 4 — Stats (volume total, 1RM estimé, répartition par muscle)
- [ ] Navigation multi-écrans (React Navigation est installé mais pas encore câblé)
- [ ] Configuration EAS (`eas.json`) pour les builds

## Stack

- **Expo SDK 57**, React Native 0.86, React 19, TypeScript strict
- `expo-sqlite` (persistance), `expo-location`, `expo-status-bar`, `react-native-safe-area-context`
- `@react-navigation/native` + `native-stack` (dépendances prêtes, pas encore utilisées)
- EAS (builds cloud, à configurer)

## Démarrage rapide

Projet **npm** (présence de `package-lock.json` → utiliser `npx`, pas `bunx`).

```bash
npm install
npx expo start          # serveur de dev + QR code
```

Autres commandes utiles :

```bash
npx expo install <pkg>  # toujours pour ajouter une dépendance (versions compatibles SDK)
npx tsc --noEmit        # vérification TypeScript (unique vérif configurée)
npx expo-doctor         # diagnostic dépendances / config
npx expo install --fix  # corriger des versions incompatibles
```

> Pas de linter ni de tests configurés pour l'instant (pas d'ESLint, pas de runner de tests).

### Tester sur ton téléphone

Le plus simple : **Expo Go** (aucun build natif — `expo-sqlite` est inclus). Détails et dépannage : [`docs/TESTING.md`](docs/TESTING.md).

## Structure

```
App.tsx                     # point d'entrée : fournit la base (SQLiteProvider) + écran
index.ts                    # registerRootComponent(App)
src/
  data/
    exercises.seed.json     # catalogue (généré depuis le dataset)
    exerciseImages.ts       # map fichier -> require() des vignettes (généré)
  screens/
    ExercisesScreen.tsx     # liste + recherche + vue détail
  services/
    database.ts             # ouverture, migrations, seed, requêtes
  theme/
    colors.ts               # palette officielle + neutres
assets/exercises/           # 1 324 vignettes 180x180 (© Gym visual)
docs/                       # specs, schéma, guide de test
```

## Données

- Catalogue importé depuis [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (code/données **MIT**).
- Champs **dérivés, non officiels** : `nom_fr` (traduction automatique best-effort) et `is_poly` (heuristique par mots-clés). À ne pas considérer comme fiables.
- `docs/SCHEMA.sql` est la **source de vérité** du schéma SQLite (à garder synchronisé avec `src/services/database.ts`).
- Remarques pour les agents/développeurs : [`AGENTS.md`](AGENTS.md).

## Palette

| Rôle | Couleur |
| --- | --- |
| Fond | `#121218` |
| Accent / validation | `#00E676` |
| Secondaire / liens | `#00B0FF` |
| Alerte / timer | `#FF3D00` |

## Documentation

- [`docs/CDC.md`](docs/CDC.md) — cahier des charges produit (v2.0)
- [`docs/SCHEMA.sql`](docs/SCHEMA.sql) — schéma SQLite
- [`docs/TESTING.md`](docs/TESTING.md) — tester sur téléphone
- [`AGENTS.md`](AGENTS.md) — conventions et pièges pour les agents

## Licence

Projet sous **MIT** (voir [`LICENSE`](LICENSE)).

Tiers : structure/données du dataset sous MIT ; les **médias** (vignettes et GIF) sont **© [Gym visual](https://gymvisual.com/)** et redistribués via le dataset à 180×180. Conserve l'attribution. Expo est sous MIT.
