# AppSport Local

Application mobile (Expo + React Native + TypeScript) de suivi d'entraînement : catalogue d'exercices, recherche, génération de programme et journal de séances. Interface suivant la direction artistique **« Foulée »** — thème **clair ou sombre selon le téléphone** ([`docs/DA_Foulee_app_sport.md`](docs/DA_Foulee_app_sport.md)) — textes et données en **français**.

> 📌 **Document vivant** — ce README est mis à jour à chaque évolution. On coche la feuille de route et on ajuste les sections plutôt que de tout réécrire.

## État du projet

- [x] Base SQLite locale (migrations versionnées, **v11**) + catalogue de **1 324 exercices**
- [x] **Recherche** d'exercices par nom (FR/EN) ou par muscle (résultats *Principal* puis *Secondaire*), dans le picker de séance
- [x] Vignettes **embarquées** (hors-ligne) **+ démonstration animée (GIF)** chargée à la demande dans la fiche exercice
- [x] Module 1 — **Profils** : plusieurs profils par appareil, prénom, âge, taille, poids, objectif, niveau, zones douloureuses + note, fréquence/semaine, matériel, format et durée de séance
- [x] Module 2 — **Création de séance** manuelle : séances rangées en **groupes/splits** (PPL, Maison, Upper/Lower…), nom, ajout d'exercices, séries / fourchette de reps / repos (à la seconde) / **poids par série** (la série 1 s'applique à toutes, les séries surchargées restent), renommage, retrait de l'accueil et suppression — depuis le menu « ⋯ » du groupe, qui supprime aussi ses séances (confirmation demandée).
- [x] Module 2 — **Génération automatique de programme** : moteur de règles **local** (aucune IA, aucune clé d'API) sur les 1 324 exercices — split selon fréquence/format, volume, reps et repos par objectif, garde-fous par zone douloureuse, matériel et niveau. Aperçu (« pourquoi ce programme ? », volume par muscle) avant « Enregistrer », régénération par graine, **relance d'un seul exercice** depuis l'aperçu (bouton **↻** : autre variante du même muscle, sans toucher au reste de la séance), **bloc de 8 semaines** et proposition de renouvellement.
- [x] Module 2 — **Substitution** d'un exercice par un autre travaillant **les mêmes muscles** (variantes du même mouvement en tête), depuis la fiche d'un exercice de l'éditeur de séance
- [x] Module 3 — **Séance en cours** : poids/séries/reps par série, poids reporté d'une séance à l'autre (+ colonne « précédent »), **repos minuté** (bip + notification), record à battre, défilement automatique vers l'exercice suivant, arrêt et enregistrement. **Cocher une série (ou la coche d'exercice) remplit les reps vides au minimum de la fourchette**. **Quitter la séance ne la perd pas** : bulle « Reprendre la séance » au-dessus des onglets, avancement et chrono (en pause) conservés.
- [x] Module 3 — **Endurance (cardio)** : les exercices d'endurance (course, vélo, rameur, corde à sauter…) se comptent **au temps** et non en reps — cible `mm:ss` par série, poids masqué, et **chrono par série** (▶ lance, ■ arrête et enregistre la durée mesurée, la coche de la série l'arrête aussi). Le récapitulatif compte le **temps d'effort** au lieu des répétitions.
- [ ] Module 3 — Exercices volatils (ajouter un exercice non prévu en pleine séance)
- [x] Module 4 — **Récapitulatif de fin de séance** : volume, durée, reps, **radar des muscles — réparti en répétitions (pas en kilos)**, courbe d'évolution, détail des exercices et **records** (SVG). *(À venir : 1RM estimé, progression par exercice.)*
- [ ] Module 4 — Statistiques globales (progression par exercice, volume par semaine)
- [x] Écran **Accueil** : carte de la séance à faire (nom + bouton **Démarrer**, ou **Reprendre** si cette séance est en cours ; bouton compact **Go** si le nom est court ; rotation par groupe), choix du groupe et historique des séances terminées. Un groupe peut être **retiré de l'accueil** via son menu « ⋯ » dans l'onglet Séances.
- [x] Navigation : **2 onglets** (Accueil / Séances) + écrans empilés (éditeur, séance en cours, récapitulatif, profils)
- [x] **Thème clair / sombre** qui suit le téléphone (DA « Foulée ») et les deux polices de la DA
- [x] EAS configuré ([`eas.json`](eas.json)) : profil `preview` = **APK Android** autonome

## Stack

- **Expo SDK 57**, React Native 0.86, React 19, TypeScript strict
- `expo-sqlite` (persistance) et `expo-sqlite/kv-store` (préférences clé/valeur : groupe actif, groupes masqués, barres/disques, **séance en cours**)
- `@react-navigation/native` + `native-stack` + `bottom-tabs` (onglets Accueil / Séances + écrans empilés)
- `expo-font` + les deux polices de la DA (`@expo-google-fonts/big-shoulders-display`, `@expo-google-fonts/public-sans`), `react-native-svg` (graphiques du récapitulatif), `expo-image` (GIF de démonstration)
- `expo-notifications` + `expo-audio` (fin de repos), `expo-location`, `expo-status-bar`, `react-native-safe-area-context`
- EAS (`eas.json`) pour les builds cloud ; `npx expo run:android|ios` pour un build local

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
npx expo start -c       # serveur de dev sans cache (obligatoire après metro.config.js)
```

> Pas de linter ni de tests configurés pour l'instant (pas d'ESLint, pas de runner de tests).

## Installer l'app sur ton téléphone

### 1. Expo Go — le plus rapide (aucun build, aucun compte)

C'est la voie à utiliser pendant le développement, sur Android comme sur iPhone. Rien à compiler : Expo Go embarque déjà `expo-sqlite`, `expo-image`, `expo-font`, `expo-notifications`, `expo-audio` et `react-native-svg`.

```bash
npm install
npx expo start          # laisse ce terminal ouvert, le QR code s'affiche
```

1. Installe **Expo Go** ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)) et **mets-le à jour** (il faut la version qui supporte **Expo SDK 57**).
2. Mets le téléphone et le PC sur le **même Wi-Fi**, puis scanne le QR code :
   - **Android** : ouvre Expo Go → « Scan QR code ».
   - **iOS** : ouvre l'appareil photo → le lien s'ouvre dans Expo Go.
3. Si le QR code ne se connecte pas (Wi-Fi isolé, réseau d'entreprise…), passe par Internet :
   ```bash
   npx expo start --tunnel
   ```

À savoir :

- **Expo Go a toujours besoin du PC** : il retélécharge le bundle JS depuis Metro à chaque lancement (le tunnel change juste le chemin réseau, pas le besoin de serveur). Pour t'en passer, voir le **point 2** (APK autonome).
- **Sauvegarde un fichier** → l'app se recharge seule (Fast Refresh). Dans le terminal : `r` = reload, `m` = menu dev, `j` = debugger, `Shift + M` = inspecteur SQLite.
- **Après une modification de `metro.config.js`** (ou de `app.json`), relance avec `npx expo start -c` : Metro ne lit ces fichiers qu'au démarrage.
- **Ajouter une lib native** (`npx expo install …` avec du code natif) ne suffit plus dans Expo Go : il faut un build (point 2 ou 3).
- Premier lancement : l'écran de démarrage propose de **créer ton profil** (aucune donnée n'est écrite dans le dépôt, la base vit sur le téléphone).

### 2. APK autonome Android — pour le gymnase (sans PC ensuite)

L'app complète installée sur le téléphone : elle s'ouvre et fonctionne **hors-ligne**, sans PC ni Expo Go. C'est le profil `preview` de [`eas.json`](eas.json) (APK en distribution interne).

```bash
npx eas-cli@latest login                                   # compte Expo gratuit (une fois) — ou `register`
npx eas-cli@latest build --profile preview --platform android
```

- Le premier build crée le projet Expo et génère le **keystore Android** : garde ce compte, c'est lui qui livrera les mises à jour de la même app.
- À la fin, ouvre le lien (ou le QR code) donné dans le terminal **sur le téléphone** → installe l'APK (autorise l'installation depuis cette source).
- **Rebuild obligatoire** après l'ajout d'une lib native ou d'une police (`expo-font`, `expo-image`…) : un APK installé ne se met pas à jour tout seul.
- Astuce batterie (pour les notifications de fin de repos écran verrouillé) : Paramètres Android → Applications → AppSportLocal → Batterie → **sans restriction**.

### 3. Build local sur ton PC — sans EAS ni compte Expo

Tout se compile sur ta machine et s'installe par USB (il faut **Android Studio / SDK** et un **JDK**, et `android/` est généré à la volée — dossier ignoré par git).

```bash
npx expo run:android --device                      # compile et installe sur le téléphone branché
npx expo run:android --device --variant release    # même chose en APK autonome (hors-ligne)
```

Pour réinstaller un APK déjà compilé :

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

> Sur un **iPhone physique**, seule cette voie (Mac + Xcode) ou EAS Build fonctionne, avec un compte Apple Developer payant — sinon c'est Expo Go (point 1) avec le PC.

Dépannage détaillé, options A/B/C et vérifications à faire sur le téléphone : [`docs/TESTING.md`](docs/TESTING.md).

## Structure

```
App.tsx                     # point d'entrée : polices (expo-font) + ThemeProvider + SQLiteProvider
index.ts                    # registerRootComponent(App) — pas d'Expo Router (pas de src/app/)
metro.config.js             # contournement Expo Go (topics push) — relire avec `expo start -c`
eas.json                    # profils EAS : `preview` = APK Android autonome
src/
  components/
    ActionSheet.tsx         # menu d'actions en feuille basse (appui à côté = fermer)
    ActiveWorkoutBubble.tsx # bulle « Reprendre la séance » au-dessus des onglets
    DurationField.tsx       # champ de durée d'effort mm:ss (exercices d'endurance)
    ExerciseAlternatives.tsx # substituts d'un exercice (mêmes muscles) dans la fiche
    ExerciseDetailModal.tsx # fiche exercice (démonstration animée + tuto) en feuille basse
    ExerciseSearchList.tsx  # liste + recherche d'exercices (picker de séance)
    MuscleRadarChart.tsx    # radar des muscles du récapitulatif (SVG)
    PlateCalculatorModal.tsx # calculateur de chargement (barre + disques)
    VolumeLineChart.tsx     # courbe de volume/progression du récapitulatif (SVG)
    ui/                     # Design system : Button, Card, Row, Chip, Sheet, ConfirmSheet…
  data/
    exercises.seed.json     # catalogue (généré depuis le dataset)
    exerciseImages.ts       # map fichier -> require() des vignettes (généré)
  domain/                   # règles métier pures, sans UI ni base
    exerciseAlternatives.ts # substituts d'un exercice (même muscle / même mouvement)
    exerciseCatalog.ts      # profil → matériel, garde-fous par zone, patterns, familles
    exerciseLabels.ts       # vocabulaire français du catalogue (cible, matériel, muscles…)
    muscles.ts              # regroupement des muscles (radar, répartition en répétitions)
    plates.ts               # barre + disques : combinaisons de charge
    profile.ts              # référentiel des choix de profil (objectif, niveau, matériel…)
    programGenerator.ts     # moteur de génération de programme (règles, aucun appel réseau)
    workoutRules.ts         # règles repos/séries du CDC + bornes de saisie + formatage
  lib/
    exerciseMedia.ts        # URLs des démonstrations animées (GIF) sur le CDN du dataset
    exerciseSearch.ts       # logique de recherche / classement par pertinence
    format.ts               # formatage court (kg, durée, date)
  navigation/
    RootNavigator.tsx       # onglets (Accueil, Séances) + stack (éditeur, séance, récap…)
    StartLineTabBar.tsx     # barre d'onglets « ligne de départ » (trait bleu, fond surface)
    types.ts                # RootStackParamList + MainTabParamList + types de navigation
  screens/
    AccountSelectScreen.tsx # choix du profil (+ ⚙ gestion des profils)
    AccountFormScreen.tsx   # création / édition d'un profil et questionnaire
    MainScreen.tsx          # accueil : séance à faire (nom + Démarrer/Reprendre) + historique
    SessionListScreen.tsx   # onglet Séances : groupes/splits + séances + génération
    ProgramGeneratorScreen.tsx # aperçu d'un programme généré (régénérer, enregistrer)
    SessionEditorScreen.tsx # création/édition de séance (fiche exercice, substitution)
    LiveWorkoutScreen.tsx   # séance en cours : poids/séries/reps, repos, reprise, arrêt
    SessionSummaryScreen.tsx # récapitulatif de fin de séance (stats, records)
  services/                 # accès base / préférences / OS
    account.tsx             # AccountProvider + useAccount (profil actif)
    activeWorkout.ts        # séance en cours en mémoire + useActiveWorkout (bulle de reprise)
    database.ts             # ouverture, migrations, seed, requêtes (+ CRUD séances/groupes)
    preferences.ts          # préférences clé/valeur (groupe actif, groupes retirés, séance en cours)
    programGeneration.ts    # pont entre le moteur de génération et la base
    restAlert.ts            # notification de fin de repos (permission, canal Android)
  theme/
    colors.ts               # palette de la DA + rampes des zones d'effort
    tokens.ts               # jetons : espacements, rayons, typographie et familles, durées, courbes
    theme.tsx               # ThemeProvider + useTheme / useThemedStyles (clair & sombre, suit le téléphone)
    index.ts                # réexports du thème
assets/exercises/           # 1 324 vignettes 180x180 (© Gym visual)
docs/                       # CDC, DA, SCHEMA.sql, guide de test
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
- **Endurance** : les exercices de cardio sont comptés **au temps** — `WORKOUT_EXOS.duration_sec` (cible par série) et `LOGS_SETS.duration_sec` (réalisé), schéma **v11**. En séance, un **chrono par série** mesure l'effort et enregistre la durée. Le récapitulatif répartit les muscles **en répétitions** (le radar ne compte pas les kilos) et affiche le **temps d'effort** au lieu des reps.
- Champs **dérivés, non officiels** : `nom_fr` (traduction automatique best-effort, **non affichée**, seulement indexée par la recherche) et `is_poly` (heuristique par mots-clés). À ne pas considérer comme fiables.
- `docs/SCHEMA.sql` est la **source de vérité** du schéma SQLite (à garder synchronisé avec `src/services/database.ts`).
- Remarques pour les agents/développeurs : [`AGENTS.md`](AGENTS.md).

## Palette (DA « Foulée »)

**Une couleur = un rôle**, en clair comme en sombre (valeurs dans `src/theme/colors.ts`). Les écrans ne lisent jamais un code couleur : ils passent par `useTheme()` (`colors.action`, `colors.marker`, `colors.danger`, `colors.surface`…).

| Rôle | Clair | Sombre |
| --- | --- | --- |
| Fond | `#EEF1F6` (dalle) | `#0B1433` |
| Surface | `#FFFFFF` | `#141E45` |
| Action — interactif, liens, données de progression | `#2347D6` (bleu court) | `#7C95FF` |
| Encre / texte | `#0D1B4C` (marine) | `#F2F5FF` |
| Marqueur — record, « ici maintenant » (aplat à encre marine, **jamais en texte**) | `#FFD60A` (jaune balise) | `#FFD60A` |
| Filets, bordures | `#D5DAE5` (craie) | `#2B3A75` |
| Succès — fait, validé | `#187A41` (vert gazon) | `#4FD18B` |
| Danger — erreur, suppression | `#D1273B` (rouge piste) | `#FF6B7D` |

Les **zones d'effort** ont leur propre rampe Z1 → Z5 (`zonesLight` / `zonesDark`). La palette sombre du CDC (`#121218`, `#00E676`, `#00B0FF`, `#FF3D00`) est **remplacée** par cette DA.

## Documentation

- [`docs/DA_Foulee_app_sport.md`](docs/DA_Foulee_app_sport.md) — direction artistique « Foulée » (source de vérité visuelle)
- [`docs/CDC.md`](docs/CDC.md) — cahier des charges produit (v2.0)
- [`docs/SCHEMA.sql`](docs/SCHEMA.sql) — schéma SQLite
- [`docs/TESTING.md`](docs/TESTING.md) — installer/tester sur téléphone
- [`AGENTS.md`](AGENTS.md) — conventions et pièges pour les agents

## Licence

Projet sous **MIT** (voir [`LICENSE`](LICENSE)).

Tiers : structure/données du dataset sous MIT ; les **médias** (vignettes et GIF) sont **© [Gym visual](https://gymvisual.com/)** et redistribués via le dataset à 180×180. Conserve l'attribution. Expo est sous MIT.
