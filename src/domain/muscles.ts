/**
 * Regroupement des muscles pour la répartition du travail (Module 4 - Stats).
 *
 * La charge répartie par groupe est le **nombre de répétitions réalisées**
 * (et non les kilos soulevés) : un exercice lourd en séries courtes ne doit pas
 * écraser la répartition au même titre qu'un exercice léger en séries longues.
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

/**
 * Groupes musculaires **internes** : c'est la maille du profil (points forts /
 * faibles) et du générateur de programme, qui a besoin de distinguer quadriceps,
 * ischios, fessiers et mollets. Les radars, eux, affichent `MUSCLE_AXES`.
 */
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

/** Ramène un groupe interne à son axe d'affichage (les jambes n'en font qu'un). */
const AXIS_OF_GROUP: Record<string, string> = {
  quadriceps: 'jambes',
  ischios: 'jambes',
  fessiers: 'jambes',
  mollets: 'jambes',
};

/** Groupes internes réunis sous l'axe d'affichage « Jambes ». */
export const LEG_MUSCLE_KEYS: readonly string[] = [
  'quadriceps',
  'ischios',
  'fessiers',
  'mollets',
];

/** Ordre canonique des axes affichés (haut → tour complet). */
export const MUSCLE_AXES: readonly MuscleGroup[] = [
  { key: 'pectoraux', label: 'Pectoraux' },
  { key: 'dos', label: 'Dos' },
  { key: 'epaules', label: 'Épaules' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'abdos', label: 'Abdos' },
  { key: 'jambes', label: 'Jambes' },
  { key: 'avant-bras', label: 'Avant-bras' },
] as const;

const LABELS = new Map(
  [...MUSCLE_GROUPS, ...MUSCLE_AXES].map((group) => [group.key, group.label])
);

/** libellé français d'une clé de groupe (ex. « quadriceps » → « Quadriceps »). */
export function muscleLabel(key: string): string {
  return LABELS.get(key) ?? key;
}

/**
 * Éclate des clés d'affichage en groupes internes : « jambes » → quadriceps,
 * ischios, fessiers et mollets. Le générateur raisonne muscle par muscle, pas
 * par axe de radar.
 */
export function expandMuscleKeys(keys: readonly string[]): string[] {
  return keys.flatMap((key) => (key === 'jambes' ? LEG_MUSCLE_KEYS : [key]));
}

/** Replie des groupes internes sur les axes d'affichage (les 4 jambes → « jambes »). */
export function collapseMuscleKeys(keys: readonly string[]): string[] {
  const collapsed: string[] = [];
  for (const key of keys) {
    const axis = AXIS_OF_GROUP[key] ?? key;
    if (!collapsed.includes(axis)) collapsed.push(axis);
  }
  return collapsed;
}

/** Deux clés désignent-elles le même axe affiché ? (ex. « jambes » et « quadriceps ») */
export function sameMuscleAxis(a: string, b: string): boolean {
  return (AXIS_OF_GROUP[a] ?? a) === (AXIS_OF_GROUP[b] ?? b);
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

/** Charge de travail réalisée sur un exercice, à répartir entre ses muscles. */
export interface MuscleAmountEntry {
  /** Muscle principal visé (dataset `target`). */
  target: string | null;
  /** Groupe musculaire de secours si `target` est absent (dataset `muscle_group`). */
  muscle_group: string;
  /** Muscles secondaires bruts (dataset `secondary_muscles`). */
  secondary: string[];
  /** Charge totale de l'exercice = Σ répétitions réalisées. */
  amount: number;
}

export interface MuscleAmount {
  key: string;
  label: string;
  amount: number;
}

/** Part de la charge comptée pour chaque muscle secondaire (échauffement de la zone). */
const SECONDARY_SHARE = 0.5;

/**
 * Répartit la charge (répétitions) des exercices sur les axes musculaires : le
 * muscle principal prend tout, chaque muscle secondaire la moitié. Quadriceps,
 * ischios, fessiers et mollets sont cumulés sur l'axe « Jambes ». Renvoie les
 * axes réellement travaillés, dans l'ordre anatomique de `MUSCLE_AXES`.
 */
export function aggregateMuscleAmount(entries: MuscleAmountEntry[]): MuscleAmount[] {
  const totals = new Map<string, number>();
  const add = (key: string, amount: number) => {
    const axis = AXIS_OF_GROUP[key] ?? key;
    totals.set(axis, (totals.get(axis) ?? 0) + amount);
  };

  for (const entry of entries) {
    if (entry.amount <= 0) continue;
    const primary = muscleKey(entry.target) ?? muscleKey(entry.muscle_group);
    // Un secondaire déjà couvert par l'axe principal (ex. fessiers sur un
    // soulevé de terre, tous deux « Jambes ») ne compte pas deux fois.
    const primaryAxis = primary ? AXIS_OF_GROUP[primary] ?? primary : null;
    if (primary) add(primary, entry.amount);
    for (const raw of entry.secondary) {
      const key = muscleKey(raw);
      if (key && (AXIS_OF_GROUP[key] ?? key) !== primaryAxis) {
        add(key, entry.amount * SECONDARY_SHARE);
      }
    }
  }

  return MUSCLE_AXES.filter((axis) => (totals.get(axis.key) ?? 0) > 0).map((axis) => ({
    key: axis.key,
    label: axis.label,
    amount: totals.get(axis.key) ?? 0,
  }));
}
