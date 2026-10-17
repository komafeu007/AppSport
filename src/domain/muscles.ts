/**
 * Regroupement des muscles pour la répartition du volume (Module 4 - Stats).
 *
 * Le catalogue vient du dataset hasaneyldrm/exercises-dataset : les muscles
 * (`target`, `muscle_group`, `secondary_muscles`) sont en anglais et très
 * granulaires (28 valeurs pour `muscle_group`). On les range dans un petit
 * ensemble de groupes français, dans un ordre anatomique stable, pour tracer
 * un radar lisible et comparable d'une séance à l'autre.
 */

export interface MuscleGroup {
  key: string;
  label: string;
}

/** Ordre canonique des axes du radar (haut → tour complet). */
export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  { key: 'pectoraux', label: 'Pectoraux' },
  { key: 'dos', label: 'Dos' },
  { key: 'epaules', label: 'Épaules' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'abdos', label: 'Abdos' },
  { key: 'quadriceps', label: 'Quadriceps' },
  { key: 'ischios', label: 'Ischios' },
  { key: 'fessiers', label: 'Fessiers' },
  { key: 'mollets', label: 'Mollets' },
  { key: 'avant-bras', label: 'Avant-bras' },
] as const;

const LABELS = new Map(MUSCLE_GROUPS.map((group) => [group.key, group.label]));

/** libellé français d'une clé de groupe (ex. « quadriceps » → « Quadriceps »). */
export function muscleLabel(key: string): string {
  return LABELS.get(key) ?? key;
}

/** Correspondance mot-clé anglais (dataset) → clé de groupe canonique. */
const KEYWORDS: Record<string, string> = {
  pectorals: 'pectoraux',
  chest: 'pectoraux',
  lats: 'dos',
  latissimus: 'dos',
  'latissimus dorsi': 'dos',
  'upper back': 'dos',
  back: 'dos',
  rhomboids: 'dos',
  spine: 'dos',
  'lower back': 'dos',
  traps: 'dos',
  trapezius: 'dos',
  'levator scapulae': 'dos',
  delts: 'epaules',
  deltoids: 'epaules',
  shoulders: 'epaules',
  'rotator cuff': 'epaules',
  biceps: 'biceps',
  triceps: 'triceps',
  abs: 'abdos',
  abdominals: 'abdos',
  core: 'abdos',
  obliques: 'abdos',
  'hip flexors': 'abdos',
  quads: 'quadriceps',
  quadriceps: 'quadriceps',
  adductors: 'quadriceps',
  abductors: 'quadriceps',
  hamstrings: 'ischios',
  glutes: 'fessiers',
  calves: 'mollets',
  soleus: 'mollets',
  ankles: 'mollets',
  'ankle stabilizers': 'mollets',
  forearms: 'avant-bras',
  wrists: 'avant-bras',
  'wrist flexors': 'avant-bras',
  'wrist extensors': 'avant-bras',
  hands: 'avant-bras',
};

/** Clé canonique d'un muscle brut du dataset (null si non reconnu / non musculaire). */
export function muscleKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const term = raw.trim().toLowerCase();
  if (KEYWORDS[term]) return KEYWORDS[term];
  // Repli tolérant : « lats (dorsal) » → contient « lats ».
  for (const keyword of Object.keys(KEYWORDS)) {
    if (term.includes(keyword)) return KEYWORDS[keyword];
  }
  return null;
}

/** Lit la colonne `secondary_muscles` (tableau JSON de mots-clés anglais). */
export function parseSecondaryMuscles(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

/** Volume réalisé sur un exercice, à répartir entre ses muscles. */
export interface MuscleVolumeEntry {
  /** Muscle principal visé (dataset `target`). */
  target: string | null;
  /** Groupe musculaire de secours si `target` est absent (dataset `muscle_group`). */
  muscle_group: string;
  /** Muscles secondaires bruts (dataset `secondary_muscles`). */
  secondary: string[];
  /** Volume total de l'exercice (kg) = Σ poids × reps. */
  volume: number;
}

export interface MuscleVolume {
  key: string;
  label: string;
  volume: number;
}

/** Part du volume comptée pour chaque muscle secondaire (échauffement de la zone). */
const SECONDARY_SHARE = 0.5;

/**
 * Répartit le volume des exercices sur les groupes musculaires : le muscle
 * principal prend tout, chaque muscle secondaire la moitié. Renvoie les groupes
 * réellement travaillés, dans l'ordre anatomique de `MUSCLE_GROUPS`.
 */
export function aggregateMuscleVolume(entries: MuscleVolumeEntry[]): MuscleVolume[] {
  const totals = new Map<string, number>();
  const add = (key: string, amount: number) =>
    totals.set(key, (totals.get(key) ?? 0) + amount);

  for (const entry of entries) {
    if (entry.volume <= 0) continue;
    const primary = muscleKey(entry.target) ?? muscleKey(entry.muscle_group);
    if (primary) add(primary, entry.volume);
    for (const raw of entry.secondary) {
      const key = muscleKey(raw);
      if (key && key !== primary) add(key, entry.volume * SECONDARY_SHARE);
    }
  }

  return MUSCLE_GROUPS.filter((group) => (totals.get(group.key) ?? 0) > 0).map((group) => ({
    key: group.key,
    label: group.label,
    volume: totals.get(group.key) ?? 0,
  }));
}
