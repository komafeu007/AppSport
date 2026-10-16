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
2. **Génération de Programme** :
   - Exclure les exercices ciblant les zones de douleur/pathologies.
   - Filtrer selon le matériel disponible (`equipment`).
   - Découpage du programme (PPL, FullBody, Upper/Lower) selon la fréquence hebdomadaire choisie (1 à 6 séances).

## Modules Fonctionnels
- **Module 1 - Onboarding** : Profiling (prénom, âge, poids, taille, douleurs, matériel, fréquence, durée).
- **Module 2 - Programme** : Consultation et modification des séances/exercices, substitution d'exercices par groupe musculaire.
- **Module 3 - Live Workout** : Minuteur dynamique auto-lancé à la validation d'une série, saisie des poids/reps, ajout/suppression d'exercices volatiles.
- **Module 4 - Stats** : Calcul du volume total ($kg$), récapitulatif post-séance, suivi de progression du 1RM estimé et répartition du volume par muscle.
