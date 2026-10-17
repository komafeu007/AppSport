# AppSport Local

Application mobile (Expo + React Native + TypeScript) de suivi d'entraînement : catalogue d'exercices, recherche, génération de programme et journal de séances. Interface **dark mode haut contraste**, textes et données en **français**.

> 📌 **Document vivant** — ce README est mis à jour à chaque évolution. On coche la feuille de route et on ajuste les sections plutôt que de tout réécrire.

## État du projet

- [x] Base SQLite locale (migrations versionnées) + catalogue de **1 324 exercices**
- [x] **Recherche** d'exercices par nom (FR/EN) ou par muscle (résultats *Principal* puis *Secondaire*), dans le picker de séance
- [x] Vignettes **embarquées** (hors-ligne) dans la liste d'exercices du picker
- [ ] Module 1 — Onboarding (profil : prénom, âge, poids, taille, douleurs, matériel, fréquence, durée)
- [x] Module 2 — **Création de séance** manuelle : séances rangées en **groupes/splits** (PPL, Maison, Upper/Lower…), nom, ajout d'exercices, séries / fourchette de reps / repos (à la seconde) / **poids par série** (la série 1 s'applique à toutes, les séries surchargées restent), renommage, retrait de l'accueil et suppression — depuis le menu « ⋯ » du groupe, qui supprime aussi ses séances (confirmation demandée). *(Génération auto PPL / FullBody / Upper-Lower encore à faire.)*
- [ ] Module 2 — Génération automatique de programme (PPL / FullBody / Upper-Lower, matériel) + substitution par groupe musculaire
- [ ] Module 4 — Stats (volume total, 1RM estimé, répartition par muscle)
- [x] Écran **Main** : carte de la séance à faire (nom + bouton **Démarrer** pleine largeur ; si le nom fait ≤ 20 caractères, bouton compact **Go** à côté ; rotation auto par groupe), choix du groupe. Un groupe peut être **retiré de la page principale** via son menu « ⋯ » dans l'onglet Séance.
- [x] Navigation multi-écrans : **2 onglets en bas** (Main / Séance) + écrans empilés (Éditeur, Séance en cours)
- [x] Module 3 — **Live Workout (base)** : lancer une séance depuis Main, voir les exos, modifier poids/nb de séries, coche « tout valider » par exercice, saisir les reps par série (sauvegardées), poids reporté d'une séance à l'autre, arrêter et enregistrer. *(À venir : minuteur de repos auto, exercices volatils.)*
- [ ] Module 3 — Minuteur de repos + exercices volatils
- [ ] Configuration EAS (`eas.json`) pour les builds

## Stack

- **Expo SDK 57**, React Native 0.86, React 19, TypeScript strict
- `expo-sqlite` (persistance), `expo-location`, `expo-status-bar`, `react-native-safe-area-context`
- `@react-navigation/native` + `native-stack` + `bottom-tabs` (onglets Main/Séance + écrans empilés)
- `expo-sqlite/kv-store` (préférences clé/valeur, ex. groupe actif)
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
App.tsx                     # point d'entrée : SQLiteProvider + RootNavigator
index.ts                    # registerRootComponent(App)
src/
  components/
    ActionSheet.tsx         # menu d'actions en feuille basse (appui à côté = fermer)
    ExerciseDetailModal.tsx # fiche exercice (image + tuto) en feuille basse
    ExerciseSearchList.tsx  # liste + recherche d'exercices (picker de séance)
    PlateCalculatorModal.tsx # calculateur de chargement (barre + disques)
    ui/                     # Design system : Button, Card, Chip, Sheet, ConfirmSheet…
  data/
    exercises.seed.json     # catalogue (généré depuis le dataset)
    exerciseImages.ts       # map fichier -> require() des vignettes (généré)
  domain/
    workoutRules.ts         # règles repos/séries du CDC + bornes de saisie + formatage
  lib/
    exerciseSearch.ts       # logique de recherche / classement par pertinence
  navigation/
    RootNavigator.tsx       # onglets (Main, Séance) + stack (éditeur, séance en cours)
    BubbleTabBar.tsx        # barre d'onglets « bulle » (pastille animée)
    types.ts                # RootStackParamList + MainTabParamList + types de navigation
  screens/
    MainScreen.tsx          # accueil : séance à faire (nom + Démarrer) + choix du groupe
    SessionListScreen.tsx   # onglet Séance : groupes/splits (PPL, Maison…) + liste des séances
    SessionEditorScreen.tsx # création/édition de séance
    LiveWorkoutScreen.tsx   # séance en cours : poids/séries/reps, arrêt & enregistrement
  services/
    database.ts             # ouverture, migrations, seed, requêtes (+ CRUD séances/groupes)
    preferences.ts          # préférences clé/valeur (groupe actif, groupes retirés de l'accueil) via expo-sqlite/kv-store
  theme/
    colors.ts               # palette officielle + neutres + ombre
    tokens.ts               # jetons : espacements, rayons, typographie, durées, ressort
assets/exercises/           # 1 324 vignettes 180x180 (© Gym visual)
docs/                       # specs, schéma, guide de test
```

## Style & animations

- **Un seul vocabulaire visuel** : tout passe par `src/theme/tokens.ts` (espacements, rayons, échelle typographique, durées) et par les briques de `src/components/ui/` (`Button`, `Card`, `Chip`, `IconButton`, `Input`, `Badge`, `Thumb`, `SectionTitle`, `ScreenHeader`, `StateView`, `Sheet`, `Appear`, `PressableScale`). Pas de nombres ou de couleurs en dur dans les écrans.
- **Feuilles** : toutes les modales de contenu sont des feuilles basses (`Sheet`) qui apparaissent en glissé + ressort et se ferment en touchant à côté, avec le bouton de fermeture, ou avec le retour Android.
- **Confirmations** : les cartes de validation et les messages d'erreur passent par `ConfirmSheet` (titre, détail, gros bouton rouge si destructif, « Annuler ») — plus aucune `Alert.alert` native.
- **Animations** : glissé/fondu entre les onglets Main ↔ Séance, pastille d'onglet animée, écrans empilés en glissé (séance en cours depuis le bas), apparitions en escalier (`Appear`), appui avec enfoncement (`PressableScale`), coche de série remplie au ressort.

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
