/**
 * Règles de repos & séries du CDC (v2.0, §1) + fourchette de reps (double progression).
 * Les valeurs conseillées sont préremplies dans l'éditeur de séance mais restent
 * modifiables : les bornes ci-dessous ne sont que des garde-fous de saisie.
 */

export interface NumericRange {
  min: number;
  max: number;
  /** Précision d'arrondi (le pas de saisie). */
  step: number;
  /** Pas des boutons −/+ si différent de `step` (ex. repos : arrondi à 1 s, boutons à 15 s). */
  buttonStep?: number;
}

/** Bornes de saisie (larges) par champ d'un exercice de séance. */
export const SERIES_RANGE: NumericRange = { min: 1, max: 10, step: 1 };
export const REPS_RANGE: NumericRange = { min: 1, max: 50, step: 1 };
/** Repos à la seconde près (ex. 2 min 18 s) ; les boutons avancent de 15 s. */
export const REST_RANGE: NumericRange = { min: 0, max: 600, step: 1, buttonStep: 15 };
export const WEIGHT_RANGE: NumericRange = { min: 0, max: 500, step: 2.5 };

/**
 * Fourchette de reps par défaut (double progression) :
 * on démarre au **min**, on ajoute des reps jusqu'au **max**, puis on monte le poids
 * et on redescend au min. Reste modifiable exercice par exercice.
 */
export const DEFAULT_REPS_RANGE: readonly [number, number] = [8, 10];

export interface ExerciseRules {
  /** Séries conseillées [min, max]. */
  seriesRange: readonly [number, number];
  /** Repos conseillé [min, max] en secondes. */
  restRange: readonly [number, number];
  /** Fourchette de reps conseillée [min, max]. */
  repsRange: readonly [number, number];
}

/**
 * Règles conseillées selon `is_poly` (1 = polyarticulaire).
 * - Poly : repos 150 s, 3 à 5 séries.
 * - Mono : repos 60 à 90 s, 3 à 4 séries.
 */
export function rulesFor(isPoly: number | boolean): ExerciseRules {
  return isPoly
    ? { seriesRange: [3, 5], restRange: [150, 150], repsRange: DEFAULT_REPS_RANGE }
    : { seriesRange: [3, 4], restRange: [60, 90], repsRange: DEFAULT_REPS_RANGE };
}

export interface DraftTargets {
  series: number;
  reps_min: number;
  reps_max: number;
  rest_time: number;
  target_weight: number;
}

/** Valeurs par défaut préremplies pour un exercice (modifiables ensuite). */
export function defaultTargets(isPoly: number | boolean): DraftTargets {
  const rules = rulesFor(isPoly);
  return {
    series: rules.seriesRange[0],
    reps_min: rules.repsRange[0],
    reps_max: rules.repsRange[1],
    rest_time: isPoly ? rules.restRange[0] : 75,
    target_weight: 0,
  };
}

export function clamp(value: number, range: NumericRange): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, value));
}

/** Arrondit au pas du champ (utile pour les poids à 2,5 kg). */
export function roundToStep(value: number, range: NumericRange): number {
  const snapped = Math.round(value / range.step) * range.step;
  return clamp(Math.round(snapped * 100) / 100, range);
}

export function stepValue(value: number, range: NumericRange, direction: 1 | -1): number {
  const increment = range.buttonStep ?? range.step;
  return roundToStep(value + direction * increment, range);
}

/** Garantit min ≤ max et applique les bornes de saisie. */
export function normalizeRepBounds(
  min: number,
  max: number
): { reps_min: number; reps_max: number } {
  const a = clamp(min, REPS_RANGE);
  const b = clamp(max, REPS_RANGE);
  return a <= b ? { reps_min: a, reps_max: b } : { reps_min: b, reps_max: a };
}

/** Redimensionne un tableau de poids par série (dégressif) sur `series` entrées. */
export function fitWeights(weights: number[], series: number, fallback: number): number[] {
  const next = weights.slice(0, series);
  while (next.length < series) {
    next.push(next.length > 0 ? next[next.length - 1] : fallback);
  }
  return next;
}

/**
 * Génère des poids dégressifs à partir du premier poids (−10 % par série, arrondi
 * au pas de 2,5 kg, minimum 2,5 kg de baisse).
 */
export function buildDegressiveWeights(first: number, series: number): number[] {
  const drop = Math.max(WEIGHT_RANGE.step, roundToStep(first * 0.1, WEIGHT_RANGE));
  return Array.from({ length: series }, (_, index) =>
    clamp(roundToStep(first - index * drop, WEIGHT_RANGE), WEIGHT_RANGE)
  );
}

/** Lit un tableau de poids stocké en JSON (colonne `set_weights`). */
export function parseWeights(json: string | null): number[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const numbers = parsed.filter((value): value is number => typeof value === 'number');
    return numbers.length > 0 ? numbers : null;
  } catch {
    return null;
  }
}

/** Formate une durée en secondes, ex. 150 -> « 2 min 30 s ». */
export function formatRest(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest} s`;
  if (rest === 0) return `${minutes} min`;
  return `${minutes} min ${rest} s`;
}

/** Résumé court des règles conseillées, affiché sous chaque exercice. */
export function describeRules(isPoly: number | boolean): string {
  const { seriesRange, restRange } = rulesFor(isPoly);
  const rest =
    restRange[0] === restRange[1] ? `${restRange[0]} s` : `${restRange[0]}–${restRange[1]} s`;
  return `${isPoly ? 'Poly' : 'Mono'} · conseillé ${seriesRange[0]}–${seriesRange[1]} séries · repos ${rest}`;
}

/** Rappel de la double progression, affiché dans l'éditeur. */
export const PROGRESSION_HINT =
  'Double progression : démarre au min de reps, et dès que tu atteins le max, monte le poids et redescends au min.';

/** Une série (poids + reps) pour la comparaison des records. */
export interface SetPerformance {
  weight: number;
  reps: number;
}

/**
 * Une série `a` bat-elle `b` ? Plus lourd d'abord, puis, à poids égal, plus de
 * reps (ex. 15 kg × 6 bat 15 kg × 5).
 */
export function beatsSet(a: SetPerformance, b: SetPerformance): boolean {
  if (a.weight !== b.weight) return a.weight > b.weight;
  return a.reps > b.reps;
}

/** « 15 kg × 6 » — libellé court d'une série pour les records. */
export function formatPerformance(set: SetPerformance): string {
  return `${set.weight} kg × ${set.reps}`;
}
