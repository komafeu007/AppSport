# Direction artistique « Terminal » — Arny v2.6

Source visuelle : maquette `Arny — Refonte design-selection.pdf` (6 écrans : Accueil, Séances, Rapport de séance, Aperçu du programme, Nouveau profil, Édition de séance). Remplace la DA « Foulée » (`DA_Foulee_app_sport.md`, conservée pour l'historique).

## Concept

Un **poste de commande** : l'app se lit comme une console technique. Fond graphite, encre crème, un seul orange signal pour l'action. Les titres sont gravés en capitales, les métadonnées sont des relevés mono (`07.11 · 6 EXOS · 159 REPS`), chaque objet porte une référence (`RÉF. ARN-SE-001`, `A-01`, `EX-01`, `#009`, `GRP-A`).

## Couleurs — une couleur, un rôle

| Rôle (`theme.colors.*`) | Valeur | Usage |
|---|---|---|
| `background` | `#121211` graphite | fond d'écran |
| `surface` | `#1B1C1A` carbone | carte, feuille |
| `surfaceAlt` | `#242522` acier | champ, état pressé |
| `border` / `borderStrong` | `#2F302C` / `#55554E` | filets décoratifs / contours de contrôles et filets visibles |
| `text` / `textMuted` | `#E8E4D8` crème / `#8F8C82` cendre | encre / libellés mono, mentions |
| `action` | `#FF5A1F` orange | action principale, rubriques `// …`, onglet actif, valeurs clés |
| `selectedSurface` | crème | contrôle sélectionné (encre graphite) |
| `success` | `#BDB58A` kaki | statut validé, protocole, étiquette POLY/MONO |
| `marker` | `#F5C400` jaune | **records uniquement** (et la barre de repos en cours) |
| `danger` | `#E5484D` rouge | suppression, erreur |

Thème **sombre unique** (`app.json` → `userInterfaceStyle: "dark"`). Aucun dégradé.

## Typographie

- **Chakra Petch** 600/700, en capitales : titres d'écran (52), de section (26), de bloc (24), libellés de bouton, grands chiffres.
- **IBM Plex Sans Condensed** : noms d'exercices (casse normale), texte courant, aides.
- **IBM Plex Mono**, capitales espacées (~0,12 em) : rubriques `// 01 — TABLEAU DE BORD`, libellés de champ, métadonnées, unités, références, codes de commande `[ GO ]`.

Jetons dans `src/theme/tokens.ts` (`text.screenTitle`, `sectionTitle`, `title`, `button`, `label`, `caption`, `kicker`, `monoValue`…). Ne jamais ajouter `fontWeight` : la graisse est dans la famille.

## Formes

- **Angles vifs** partout (`radius.*` = 0 ; `pill` seulement pour une pastille ronde).
- Contours de 1 px (`borderStrong`), séparateurs de liste **en pointillés** (`DashedLine`, `Row`), points de conduite dans les fiches (`LeaderRow`).
- Une seule carte par écran (`Card`), la carte principale peut porter des **repères de visée** orange aux coins (`crosshair`).
- Une seule ombre : les feuilles (`Sheet`), coiffées d'un filet orange.
- Notation entre crochets pour les emplacements et commandes : `[ + ] AJOUTER UN EXERCICE`, `[ EMPLACEMENT VIDE ]`, `[■] FULLBODY` / `[ ] ANNA`.

## Composants (`src/components/ui/`)

`SystemBar` (bandeau `ARN-SYS / v2.6 · LUN 09.11.26 · SEM. 46`), `ScreenHeader` (`kicker` + grand titre), `SectionTitle` (titre + mention mono + filet), `Button` (`code="GO"` → `[ GO ]`, `arrow`), `Card` (`crosshair`, ton `marker` = records), `Badge` (`outline` kaki, `success` VALIDÉ, `marker` RECORD, `action`), `StatTiles` (télémétrie), `LeaderRow`, `DashedLine`, `Chip`, `IconButton` (carré au trait), `Input` (bloc acier, soulignement orange au focus). En-tête des écrans poussés : `src/navigation/TerminalStackHeader.tsx` (retour carré + intitulé mono centré). Barre d'onglets : deux moitiés numérotées `01 • ACCUEIL` / `02 SÉANCES`, trait orange sur l'onglet actif.

## Formats

Dates techniques `07.11` / `09.11.26` (`formatDotDate`, `formatDotDateYear`), semaine `SEM. 46` (`isoWeekNumber`), index `01`/`009` (`padIndex`). Poids avec espace de milliers `6 915 KG`. Schémas de séries en orange mono `4×8–12`, suivis de `· REPOS 2:15` en gris. Dates en phrase (`formatLongDate`) gardées là où une phrase est lue. Pas de point d'exclamation.

## Mouvement

Inchangé : retour de pression 100 ms (`PressableScale`), feuilles 360 ms, aucune section qui s'anime en entrant ; un graphique peut se déployer une fois à l'arrivée de ses données. Respecter le mouvement réduit (`useReduceMotion`).
