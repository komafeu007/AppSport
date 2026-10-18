# AppSport Local

Application mobile (Expo + React Native + TypeScript) de suivi d'entraînement : catalogue d'exercices, recherche, génération de programme et journal de séances. Interface suivant la direction artistique **« Foulée »** — thème **clair ou sombre selon le téléphone** ([`docs/DA_Foulee_app_sport.md`](docs/DA_Foulee_app_sport.md)) — textes et données en **français**.

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
- [x] Module 3 — **Live Workout (base)** : lancer une séance depuis Main, voir les exos, modifier poids/nb de séries, coche « tout valider » par exercice (**cocher une série vide la valide au minimum de la fourchette**), saisir les reps par série (sauvegardées), poids reporté d'une séance à l'autre, minuteur de repos (bip + notification), arrêter et enregistrer. **Quitter la séance ne la perd pas** : une **bulle « Reprendre la séance »** apparaît en bas des onglets (avancement et chrono conservés, « × » pour abandonner). *(À venir : exercices volatils.)*
- [ ] Module 3 — Exercices volatils dans la séance en cours
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
    ActiveWorkoutBubble.tsx # bulle « Reprendre la séance » au-dessus des onglets
    ExerciseAlternatives.tsx # substituts d'un exercice (mêmes muscles) dans la fiche
    ExerciseDetailModal.tsx # fiche exercice (démonstration animée + tuto) en feuille basse
    ExerciseSearchList.tsx  # liste + recherche d'exercices (picker de séance)
    PlateCalculatorModal.tsx # calculateur de chargement (barre + disques)
    ui/                     # Design system : Button, Card, Chip, Sheet, ConfirmSheet…
  data/
    exercises.seed.json     # catalogue (généré depuis le dataset)
    exerciseImages.ts       # map fichier -> require() des vignettes (généré)
  domain/
    exerciseAlternatives.ts # substituts d'un exercice (même muscle / même mouvement)
    exerciseLabels.ts       # vocabulaire français du catalogue (cible, matériel, muscles…)
    workoutRules.ts         # règles repos/séries du CDC + bornes de saisie + formatage
  lib/
    exerciseSearch.ts       # logique de recherche / classement par pertinence
    exerciseMedia.ts        # URLs des démonstrations animées (GIF) sur le CDN du dataset
  navigation/
    RootNavigator.tsx       # onglets (Main, Séance) + stack (éditeur, séance en cours)
    StartLineTabBar.tsx     # barre d'onglets « ligne de départ » (trait bleu, fond surface)
    types.ts                # RootStackParamList + MainTabParamList + types de navigation
  screens/
    MainScreen.tsx          # accueil : séance à faire (nom + Démarrer) + choix du groupe
    SessionListScreen.tsx   # onglet Séance : groupes/splits (PPL, Maison…) + liste des séances
    SessionEditorScreen.tsx # création/édition de séance
    LiveWorkoutScreen.tsx   # séance en cours : poids/séries/reps, arrêt & enregistrement
  services/
    activeWorkout.ts        # séance en cours en mémoire + useActiveWorkout (bulle de reprise)
    database.ts             # ouverture, migrations, seed, requêtes (+ CRUD séances/groupes)
    preferences.ts          # préférences clé/valeur (groupe actif, groupes retirés, séance en cours) via expo-sqlite/kv-store
  theme/
    colors.ts               # palette de la DA + rampes des zones d'effort
    tokens.ts               # jetons : espacements, rayons, typographie et familles, durées, courbes
    theme.tsx               # ThemeProvider + useTheme / useThemedStyles (clair & sombre, suit le téléphone)
assets/exercises/           # 1 324 vignettes 180x180 (© Gym visual)
docs/                       # specs, schéma, guide de test
```

## Direction artistique

L'app suit la DA « Foulée » ([`docs/DA_Foulee_app_sport.md`](docs/DA_Foulee_app_sport.md)) : le concept de **marquage au sol** (lignes et filets plutôt que cartes empilées).

- **Palette, une couleur = un rôle** : bleu court `#2347D6` (action), marine `#0D1B4C` (encre), jaune balise `#FFD60A` (record, « en cours » — jamais en texte), dalle `#EEF1F6` (fond), craie `#D5DAE5` (filets), ardoise `#5B6478` (texte secondaire), rouge piste `#D1273B` (erreur), vert gazon `#187A41` (réussi). Rien d'autre n'est bleu, sauf les données de progression.
- **Clair & sombre, qui suit le téléphone** : `ThemeProvider` (`src/theme/theme.tsx`) applique le thème clair ou sombre (§14 de la DA). Un écran lit ses couleurs par rôle via `useTheme()` et calcule sa feuille de style avec `useThemedStyles(createStyles)`.
- **Typographie** : Big Shoulders Display pour les chiffres et les titres, Public Sans pour le texte, chargées par `expo-font` dans `App.tsx`. Casse de phrase partout (aucune capitale espacée), le poids est porté par le nom de la famille.
- **Grille** : espacements sur une base de 4, marge de 20 px pour tout le texte, rayons 4 / 8 / 12 / 20, hauteur tactile 48 px (56 pendant la séance).
- **Une seule carte par écran**, réservée à l'action principale ; le reste est une liste à plat séparée par des filets de 1 px (`src/components/ui/Row.tsx`). Une seule ombre dans toute l'app : celle des feuilles.
- **Briques** : `Button`, `Card`, `Row`, `Chip`, `IconButton`, `Input`, `Badge`, `Thumb`, `SectionTitle`, `ScreenHeader`, `StateView`, `Sheet`, `ConfirmSheet`, `ActionSheet`, `PressableScale`. Pas de nombre, de couleur ou de taille de police en dur dans les écrans.
- **Feuilles** : toutes les modales de contenu sont des feuilles basses (`Sheet`, glissé 360 ms) qui se ferment en touchant à côté, avec le bouton de fermeture, ou avec le retour Android.
- **Confirmations** : les cartes de validation et les messages d'erreur passent par `ConfirmSheet` (titre, détail, gros bouton rouge si destructif, « Annuler ») — plus aucune `Alert.alert` native.
- **Animations** : glissé entre les onglets Accueil ↔ Séances, trait de départ sur l'onglet actif, écrans empilés en glissé (séance en cours depuis le bas), enfoncement de 100 ms à l'appui (`PressableScale`), coche de série remplie. Aucune apparition automatique des sections (interdit par la DA) : `Appear` n'est plus qu'une enveloppe.

## Données

- Catalogue importé depuis [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (code/données **MIT**).
- **Langue** : les **noms d'exercices restent en anglais** ; le reste des repères du catalogue (`target`, `category`, `equipment`, `muscle_group`, `secondary_muscles`) est affiché en français via `src/domain/exerciseLabels.ts`.
- **Substitution** : depuis la fiche d'un exercice de l'éditeur de séance, `src/domain/exerciseAlternatives.ts` propose des exercices qui travaillent les mêmes muscles (variantes du même mouvement en tête), avec un accès à la liste complète (`ExerciseAlternatives`). Le remplacement garde séries/reps/repos et remet les poids à zéro.
- Champs **dérivés, non officiels** : `nom_fr` (traduction automatique best-effort, **non affichée**, seulement indexée par la recherche) et `is_poly` (heuristique par mots-clés). À ne pas considérer comme fiables.
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
