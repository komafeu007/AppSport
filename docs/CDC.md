# Spécifications Techniques - Application Sport Local (v2.0)

## Design System & Ergonomie
- **Mode** : Dark Mode à haut contraste.
- **Palette Couleurs** :
  - Fond : `#121218`
  - Accent / Validation (Néon Green) : `#00E676`
  - Secondaire / Liens (Electric Blue) : `#00B0FF`
  - Alerte / Timer (Intense Orange) : `#FF3D00`
- **UI Ergonomie** : Boutons de validation géants pour manipulation pendant l'effort, minuteur rétro-éclairé haute visibilité.

## Algorithmes Métier
1. **Règles de Repos & Séries** :
   - Exercices Polyarticulaires (`is_poly = 1`) : Repos par défaut = 150s (2 min 30s), 3 à 5 séries.
   - Exercices Monoarticulaires (`is_poly = 0`) : Repos par défaut = 60s à 90s (1 min à 1 min 30s), 3 à 4 séries.
2. **Génération de Programme** (moteur de règles, sans IA — voir `src/domain/programGenerator.ts`) :
   - Exclure les exercices ciblant les zones de douleur/pathologies (`ZONE_GUARDS`).
   - Filtrer selon le matériel disponible (`equipment`) et le format de séance.
   - Découpage du programme (PPL, FullBody, Upper/Lower, Split, Maison) selon la fréquence hebdomadaire choisie (1 à 6 séances).
   - Volume (séries par muscle, exercices par séance) piloté par l'**objectif** et le **niveau d'expérience** ; intensité (reps) et repos par objectif, sur la base des règles §1.
   - Sélection scorée dans le catalogue : mouvements attendus par groupe (`MUSCLE_PATTERNS`), priorité au polyarticulaire en exercice principal, variété (pas de doublon de mouvement dans la séance, exercices récents évités).
   - Ajustement à la **durée de séance** visée : retrait des exercices de fin de séance, puis réduction des séries ; ajout d'exercices complémentaires s'il reste du temps.
   - Charges de départ reprises de la dernière séance de l'exercice (`LOGS_SETS`).
   - **Aperçu obligatoire** : le programme est présenté (pourquoi + séances) avec « Régénérer » avant « Enregistrer ». Rien n'est écrit avant validation.
   - Un programme généré ouvre un **bloc de 8 semaines** (`SESSION_GROUPS.bloc_debut` / `bloc_semaines`) : à l'échéance, un nouveau programme est **proposé**, jamais appliqué sans validation.

## Modules Fonctionnels
- **Module 1 - Onboarding** : Profiling (prénom, âge, poids, taille, niveau, douleurs, matériel, fréquence, durée). À la fin du questionnaire : génération du programme (aperçu → validation).
- **Module 2 - Programme** : Consultation et modification des séances/exercices, substitution d'exercices par groupe musculaire, génération/régénération d'un programme complet. Après génération, chaque exercice de l'aperçu peut être **relancé individuellement** (autre variante du même groupe musculaire) sans régénérer tout le programme.
- **Module 3 - Live Workout** : Minuteur dynamique auto-lancé à la validation d'une série, saisie des poids/reps, ajout/suppression d'exercices volatiles.
  - **Endurance** : les exercices de cardio (course, vélo, rameur, corde à sauter, machines d'endurance) se comptent **au temps** et non en répétitions. La cible est une durée par série (format `mm:ss`), la charge n'est pas demandée ; chaque série peut être **mesurée au chrono** (bouton ▶/■) et le temps réalisé est enregistré à l'arrêt ; le récapitulatif affiche le temps d'effort au lieu des reps (volume kg et records inchangés).
- **Module 4 - Stats** : Calcul du volume total ($kg$), récapitulatif post-séance, suivi de progression du 1RM estimé et **répartition des répétitions** par muscle (le radar « araignée » ne compte pas les kilos).
