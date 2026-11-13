import type { BodyMeasurement } from '../services/database';

/**
 * Mesures suivies, dans l'ordre d'affichage : le poids (kg) puis les tours
 * (cm), de haut en bas du corps. Seuls les tours ont une zone sur le mannequin.
 */
export const MEASUREMENT_ZONES = [
  { key: 'poids', label: 'Poids', code: 'M.01', unit: 'kg' },
  { key: 'cou', label: 'Cou', code: 'M.02', unit: 'cm' },
  { key: 'epaules', label: 'Épaules', code: 'M.03', unit: 'cm' },
  { key: 'pectoraux', label: 'Pectoraux', code: 'M.04', unit: 'cm' },
  { key: 'abdos', label: 'Abdos', code: 'M.05', unit: 'cm' },
  { key: 'fessiers', label: 'Fessiers', code: 'M.06', unit: 'cm' },
  { key: 'cuisse', label: 'Cuisse', code: 'M.07', unit: 'cm' },
  { key: 'mollet', label: 'Mollet', code: 'M.08', unit: 'cm' },
  { key: 'bras', label: 'Bras', code: 'M.09', unit: 'cm' },
  { key: 'avant_bras', label: 'Avant-bras', code: 'M.10', unit: 'cm' },
] as const;

export type MeasurementZone = (typeof MEASUREMENT_ZONES)[number]['key'];

/** Où l'on prend la mesure : rappelé dans la feuille de saisie. */
export const MEASUREMENT_HINTS: Record<MeasurementZone, string> = {
  poids: 'Le matin, à jeun, toujours sur la même balance.',
  cou: 'Sous la pomme d’Adam, ruban à l’horizontale.',
  epaules: 'Tour complet, au plus large des deltoïdes, bras le long du corps.',
  pectoraux: 'Au niveau des mamelons, poitrine relâchée, en fin d’expiration.',
  abdos: 'Au niveau du nombril, ventre relâché.',
  fessiers: 'Au plus large des fessiers, pieds joints.',
  cuisse: 'Au plus large de la cuisse, sous le pli fessier.',
  mollet: 'Au plus large du mollet, debout.',
  bras: 'Au plus large du biceps, bras contracté.',
  avant_bras: 'Au plus large, sous le coude, poing serré.',
};

/** Dernière mesure d'une zone et l'écart avec la précédente. */
export interface ZoneReading {
  latest: BodyMeasurement | null;
  /** Dernière − précédente, null s'il n'y a qu'une mesure. */
  delta: number | null;
  /** Dernière − première (évolution totale), null s'il n'y a qu'une mesure. */
  total: number | null;
  /** Mesures de la zone, de la plus récente à la plus ancienne. */
  history: BodyMeasurement[];
}

/** Regroupe les mesures (triées récentes d'abord) par zone. */
export function readingsByZone(rows: BodyMeasurement[]): Record<MeasurementZone, ZoneReading> {
  const result = {} as Record<MeasurementZone, ZoneReading>;
  for (const zone of MEASUREMENT_ZONES) {
    const history = rows.filter((row) => row.zone === zone.key);
    const latest = history[0] ?? null;
    const previous = history[1] ?? null;
    const first = history[history.length - 1] ?? null;
    result[zone.key] = {
      latest,
      delta: latest && previous ? round1(latest.value_cm - previous.value_cm) : null,
      total: latest && first && history.length > 1 ? round1(latest.value_cm - first.value_cm) : null,
      history,
    };
  }
  return result;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** « 38,5 » : une décimale au plus, virgule française. */
export function formatCm(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace('.', ',');
}

/** « +0,5 » / « −1 » / « = ». */
export function formatCmDelta(delta: number): string {
  if (delta === 0) return '=';
  return `${delta > 0 ? '+' : '−'}${formatCm(Math.abs(delta))}`;
}

/** Lit une saisie « 38,5 » ou « 38.5 » ; null si invalide ou hors bornes plausibles. */
export function parseMeasure(input: string, zone: MeasurementZone): number | null {
  if (input.trim() === '') return null;
  const value = Number(input.trim().replace(',', '.'));
  const [low, high] = zone === 'poids' ? [20, 400] : [5, 300];
  if (!Number.isFinite(value) || value < low || value > high) return null;
  return Math.round(value * 10) / 10;
}
