/**
 * Calculateur de chargement (barre + disques).
 *
 * À partir d'un poids total visé et du poids de la barre, on calcule les disques à
 * mettre **de chaque côté** (identiques à gauche et à droite), du plus lourd au plus
 * léger. Les valeurs par défaut restent modifiables par l'utilisateur.
 */

/** Barres proposées par défaut (kg) : barre olympique 20, barre 10, barre 7,5. */
export const DEFAULT_BAR_WEIGHTS: readonly number[] = [20, 10, 7.5];

/** Disques proposés par défaut (kg). */
export const DEFAULT_PLATES: readonly number[] = [20, 15, 10, 5, 2.5, 1];

/** Barre par défaut (barre olympique). */
export const DEFAULT_BAR_WEIGHT = DEFAULT_BAR_WEIGHTS[0];

export interface PlateLoad {
  plate: number;
  /** Nombre de disques de ce poids, **par côté**. */
  count: number;
}

export interface PlateBreakdown {
  /** Disques par côté (du plus lourd au plus léger). */
  perSide: PlateLoad[];
  /** Poids des disques d'un seul côté. */
  sideWeight: number;
  /** Poids total atteint (barre + 2 × côté). */
  total: number;
  /** Poids impossible à atteindre par côté (0 si le poids tombe juste). */
  remainder: number;
  /** true si aucun disque n'est nécessaire (poids visé ≤ barre). */
  empty: boolean;
}

const EPSILON = 1e-6;
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Trie et dédoublonne une liste de poids, du plus lourd au plus léger. */
export function sortWeightsDesc(values: readonly number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort(
    (a, b) => b - a
  );
}

/**
 * Calcule le chargement pour atteindre `target` avec `bar`.
 * Renvoie les disques par côté, le poids réel atteint et le reste éventuel.
 */
export function computePlates(target: number, bar: number, plates: readonly number[]): PlateBreakdown {
  const side = round3((target - bar) / 2);
  if (!Number.isFinite(side) || side <= EPSILON) {
    return { perSide: [], sideWeight: 0, total: round3(bar), remainder: 0, empty: true };
  }

  const available = sortWeightsDesc(plates);
  const perSide: PlateLoad[] = [];
  let remaining = side;

  for (const plate of available) {
    const count = Math.floor((remaining + EPSILON) / plate);
    if (count > 0) {
      perSide.push({ plate, count });
      remaining = round3(remaining - count * plate);
    }
  }

  const sideWeight = round3(side - remaining);
  return {
    perSide,
    sideWeight,
    total: round3(bar + sideWeight * 2),
    remainder: round3(remaining),
    empty: perSide.length === 0,
  };
}

/** 100 → « 100 », 92.5 → « 92.5 ». */
export function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : String(round3(value));
}
