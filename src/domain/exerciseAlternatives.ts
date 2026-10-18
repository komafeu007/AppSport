/**
 * Substitution d'exercices : trouver, pour un exercice donné, ceux qui
 * **travaillent les mêmes muscles** (et de préférence le même mouvement).
 *
 * Aucun apprentissage ici : on s'appuie sur le référentiel du catalogue
 * (`primaryMuscle`, `secondaryMuscles`, `movementFamilies`, `movementScore`) et
 * sur un score de proximité. L'idée : « push-up » → « wide push-up »,
 * « diamond push-up » (même mouvement, muscles proches) avant « bench press ».
 */

import {
  isCompound,
  isNonStrength,
  junkPenalty,
  movementFamilies,
  movementScore,
  primaryMuscle,
  secondaryMuscles,
  type CatalogExercise,
} from './exerciseCatalog';

export interface AlternativeOptions {
  /** Ids jamais proposés (l'exercice courant, ceux déjà dans la séance…). */
  excludeIds?: readonly number[];
  /** Nombre maximum de résultats (défaut : pas de limite). */
  limit?: number;
}

interface MuscleFootprint {
  primary: string | null;
  secondary: string[];
}

function footprint(exercise: CatalogExercise): MuscleFootprint {
  return { primary: primaryMuscle(exercise), secondary: secondaryMuscles(exercise) };
}

/**
 * Score de proximité entre `base` et `candidate` (0 = rien en commun).
 * Poids volontairement lisibles : même muscle principal ≫ muscle secondaire
 * partagé ≫ même famille de mouvement, puis des bonus de contexte (matériel,
 * poly/mono) qui départagent sans jamais créer de match à eux seuls.
 */
function similarityScore(
  base: MuscleFootprint,
  candidate: MuscleFootprint,
  sameFamily: boolean,
  equipmentMatch: boolean,
  compoundMatch: boolean,
  canonical: number
): number {
  let score = 0;

  // ——— Recouvrement musculaire ———
  if (candidate.primary && base.primary && candidate.primary === base.primary) score += 10;
  if (candidate.primary && base.secondary.includes(candidate.primary)) score += 6;
  if (base.primary && candidate.secondary.includes(base.primary)) score += 4;
  const shared = candidate.secondary.filter((muscle) => base.secondary.includes(muscle)).length;
  score += Math.min(shared, 3) * 1.5;

  // ——— Même mouvement (variantes) ———
  if (sameFamily) score += 8;

  // ——— Contexte ———
  if (equipmentMatch) score += 2;
  if (compoundMatch) score += 1;
  score += canonical * 0.4;

  return score;
}

/**
 * Exercices proches d'un exercice de référence, **classés du plus proche au plus
 * lointain**. Ne renvoie que des exercices réellement liés (muscle ou mouvement
 * partagé) : un simple « même matériel » ne suffit pas.
 */
export function findExerciseAlternatives<T extends CatalogExercise>(
  base: T,
  catalogue: readonly T[],
  options: AlternativeOptions = {}
): T[] {
  const exclude = new Set(options.excludeIds ?? []);
  const baseFootprint = footprint(base);
  const baseFamilies = new Set(movementFamilies(base));
  const baseEquipment = base.equipment ?? 'body weight';
  const baseCompound = isCompound(base);

  const seenNames = new Set<string>([base.nom.trim().toLowerCase()]);
  const scored: Array<{ exercise: T; score: number }> = [];

  for (const candidate of catalogue) {
    if (candidate.id === base.id || exclude.has(candidate.id)) continue;
    // Les étirements / yoga / haltérophilie de compétition n'ont rien à faire ici.
    if (isNonStrength(candidate)) continue;

    const name = candidate.nom.trim().toLowerCase();
    if (seenNames.has(name)) continue; // doublons du dataset (id différent, nom identique)

    const candFootprint = footprint(candidate);
    const sameFamily = movementFamilies(candidate).some((family) => baseFamilies.has(family));

    // « Similaires » : même mouvement, ou même muscle **principal**. On écarte
    // les muscles simplement secondaires (sinon un développé couché rapprocherait
    // tout le catalogue du haut du corps) — ils ne pèsent que dans le score.
    const related =
      sameFamily ||
      (candFootprint.primary !== null && candFootprint.primary === baseFootprint.primary);
    if (!related) continue;

    const canonical = baseFootprint.primary ? movementScore(candidate, baseFootprint.primary) : 0;
    const score =
      similarityScore(
        baseFootprint,
        candFootprint,
        sameFamily,
        (candidate.equipment ?? 'body weight') === baseEquipment,
        isCompound(candidate) === baseCompound,
        canonical
      ) - junkPenalty(candidate) * 1.5;

    if (score <= 0) continue;
    seenNames.add(name);
    scored.push({ exercise: candidate, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.exercise.nom.length !== b.exercise.nom.length) {
      return a.exercise.nom.length - b.exercise.nom.length;
    }
    return a.exercise.nom.localeCompare(b.exercise.nom);
  });

  const ranked = scored.map((entry) => entry.exercise);
  return options.limit != null ? ranked.slice(0, options.limit) : ranked;
}
