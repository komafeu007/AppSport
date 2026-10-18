/**
 * Générateur de programme : **moteur de règles pur** (aucune base, aucun réseau,
 * aucun aléatoire système). Il reçoit le profil + le catalogue et rend un plan.
 *
 * Principe : rien n'est écrit en dur sous forme de séances. Le générateur combine
 *   profil (objectif, niveau, fréquence, durée, format, matériel, douleurs)
 *   + modèles de découpage (PPL, Haut/Bas, Full body, Split, Maison)
 *   + tables de volume / intensité / repos par objectif et par niveau
 *   + sélection scorée dans les 1 324 fiches du catalogue.
 *
 * La répétabilité est assurée par une graine : « Régénérer » change la graine et
 * donc les variantes choisies, pas la structure.
 */

import {
  allowedEquipment,
  displayName,
  hasAvailableEquipment,
  isCardio,
  isCompound,
  isNonStrength,
  junkPenalty,
  movementFamily,
  movementPatterns,
  movementScore,
  needsPullUpBar,
  primaryMuscle,
  rawPrimary,
  secondaryMuscles,
  zoneViolation,
  type CatalogExercise,
} from './exerciseCatalog';
import { muscleLabel } from './muscles';

export interface GeneratorProfile {
  objectif: string | null;
  niveau: string | null;
  sessionsPerWeek: number | null;
  dureeSeance: number | null;
  format: string | null;
  materiel: string[];
  zonesDouloureuses: string[];
}

export interface GenerateProgramInput {
  profile: GeneratorProfile;
  catalog: readonly CatalogExercise[];
  /** Exercices faits récemment (du plus récent au plus ancien) : sert la variété. */
  recentExerciseIds?: readonly number[];
  /** Graine du tirage (« Régénérer » → nouvelle graine). */
  seed: number;
}

export interface PlannedExercise {
  exercise: CatalogExercise;
  series: number;
  repsMin: number;
  repsMax: number;
  restTime: number;
}

export interface PlannedSession {
  nom: string;
  /** Groupes musculaires visés (clés canoniques), dans l'ordre de travail. */
  muscles: string[];
  exercises: PlannedExercise[];
  /** Durée estimée, en minutes (échauffement inclus). */
  estimatedMinutes: number;
}

export interface GeneratedProgram {
  /** Nom du groupe de séances (ex. « PPL — généré »). */
  nomGroupe: string;
  /** Découpage retenu (clé interne, ex. « ppl »). */
  format: string;
  sessions: PlannedSession[];
  /** Volume hebdomadaire par muscle, en séries. */
  weeklySets: Array<{ muscle: string; label: string; sets: number }>;
  /** Ce qui a guidé la génération (affiché à l'utilisateur). */
  rationale: string[];
  /** Points de vigilance (matériel limité, durée, exclusions…). */
  warnings: string[];
}

// --- Tables d'expertise ----------------------------------------------------

interface SlotTemplate {
  /** Groupe musculaire canonique visé. */
  muscle: string;
  /** Séries **de référence** par séance (niveau intermédiaire, objectif « masse »). */
  sets: number;
  /**
   * Motifs (voir `MUSCLE_PATTERNS`) à privilégier pour ce créneau. Sert aux
   * découpages où un groupe est travaillé sous un **angle précis** : un jour
   * « Pull » veut des deltoïdes postérieurs, pas un développé militaire.
   */
  prefer?: readonly string[];
}

/** Options de sélection passées à `pickForMuscle`. */
interface PickOptions {
  /** Motifs déjà travaillés dans le groupe. */
  patterns?: ReadonlySet<string>;
  /** Familles de mouvement déjà travaillées dans le groupe. */
  families?: ReadonlySet<string>;
  /** Motifs à privilégier (angle imposé par la trame). */
  prefer?: readonly string[];
  /**
   * true = exercice **ajouté** à un groupe déjà servi (séance trop courte) : il est
   * scoré comme un complément (isolation privilégiée) et non comme le mouvement
   * principal du groupe.
   */
  complement?: boolean;
  /**
   * true = n'accepter qu'un exercice dont c'est le muscle **principal**. Les
   * candidats de secours (pris via leurs muscles secondaires) sont là pour couvrir
   * un groupe que le matériel rend inaccessible, pas pour remplir du temps : on ne
   * complète pas une séance avec une élévation frontale classée « biceps ».
   */
  strictOnly?: boolean;
}

interface SessionTemplate {
  nom: string;
  slots: readonly SlotTemplate[];
}

/** Format « full body » : chaque séance balaie tout le corps. */
const FULL_BODY: readonly SessionTemplate[] = [
  {
    nom: 'Full body A',
    slots: [
      { muscle: 'quadriceps', sets: 6 },
      { muscle: 'pectoraux', sets: 6 },
      { muscle: 'dos', sets: 6 },
      { muscle: 'epaules', sets: 3 },
      { muscle: 'abdos', sets: 3 },
    ],
  },
  {
    nom: 'Full body B',
    slots: [
      { muscle: 'ischios', sets: 6 },
      { muscle: 'dos', sets: 6 },
      { muscle: 'pectoraux', sets: 6 },
      { muscle: 'epaules', sets: 3 },
      { muscle: 'mollets', sets: 3 },
    ],
  },
  {
    nom: 'Full body C',
    slots: [
      { muscle: 'quadriceps', sets: 6 },
      { muscle: 'fessiers', sets: 4 },
      { muscle: 'dos', sets: 6 },
      { muscle: 'pectoraux', sets: 5 },
      { muscle: 'abdos', sets: 3 },
    ],
  },
];

/** Format « Push / Pull / Legs » : deux variantes par type de séance. */
const PPL: readonly SessionTemplate[] = [
  {
    nom: 'Push A',
    slots: [
      { muscle: 'pectoraux', sets: 7 },
      { muscle: 'epaules', sets: 4 },
      { muscle: 'triceps', sets: 4 },
    ],
  },
  {
    nom: 'Pull A',
    slots: [
      { muscle: 'dos', sets: 8 },
      { muscle: 'biceps', sets: 4 },
      // Un jour « Pull » : deltoïdes postérieurs et haut du dos, pas un développé.
      { muscle: 'epaules', sets: 2, prefer: ['rear delt', 'face pull', 'reverse fly'] },
    ],
  },
  {
    nom: 'Jambes A',
    slots: [
      { muscle: 'quadriceps', sets: 7 },
      { muscle: 'ischios', sets: 4 },
      { muscle: 'fessiers', sets: 4 },
      { muscle: 'mollets', sets: 4 },
      { muscle: 'abdos', sets: 3 },
    ],
  },
  {
    nom: 'Push B',
    slots: [
      { muscle: 'pectoraux', sets: 7 },
      { muscle: 'epaules', sets: 6 },
      { muscle: 'triceps', sets: 3 },
    ],
  },
  {
    nom: 'Pull B',
    slots: [
      { muscle: 'dos', sets: 8 },
      { muscle: 'biceps', sets: 5 },
      { muscle: 'avant-bras', sets: 2 },
    ],
  },
  {
    nom: 'Jambes B',
    slots: [
      { muscle: 'quadriceps', sets: 7 },
      { muscle: 'ischios', sets: 6 },
      { muscle: 'fessiers', sets: 3 },
      { muscle: 'mollets', sets: 4 },
      { muscle: 'abdos', sets: 3 },
    ],
  },
];

/** Format « Haut / Bas du corps ». */
const UPPER_LOWER: readonly SessionTemplate[] = [
  {
    nom: 'Haut du corps A',
    slots: [
      { muscle: 'pectoraux', sets: 7 },
      { muscle: 'dos', sets: 6 },
      { muscle: 'epaules', sets: 4 },
      { muscle: 'triceps', sets: 3 },
      { muscle: 'biceps', sets: 3 },
    ],
  },
  {
    nom: 'Bas du corps A',
    slots: [
      { muscle: 'quadriceps', sets: 7 },
      { muscle: 'ischios', sets: 4 },
      { muscle: 'fessiers', sets: 4 },
      { muscle: 'mollets', sets: 4 },
      { muscle: 'abdos', sets: 3 },
    ],
  },
  {
    nom: 'Haut du corps B',
    slots: [
      { muscle: 'dos', sets: 7 },
      { muscle: 'pectoraux', sets: 6 },
      { muscle: 'epaules', sets: 5 },
      { muscle: 'biceps', sets: 3 },
      { muscle: 'triceps', sets: 4 },
    ],
  },
  {
    nom: 'Bas du corps B',
    slots: [
      { muscle: 'ischios', sets: 6 },
      { muscle: 'quadriceps', sets: 6 },
      { muscle: 'fessiers', sets: 5 },
      { muscle: 'mollets', sets: 3 },
      { muscle: 'abdos', sets: 3 },
    ],
  },
];

/** Format « Split par muscle ». */
const MUSCLE_SPLIT: readonly SessionTemplate[] = [
  {
    nom: 'Pectoraux / Triceps',
    slots: [
      { muscle: 'pectoraux', sets: 9 },
      { muscle: 'triceps', sets: 6 },
    ],
  },
  {
    nom: 'Dos / Biceps',
    slots: [
      { muscle: 'dos', sets: 9 },
      { muscle: 'biceps', sets: 6 },
      { muscle: 'avant-bras', sets: 2 },
    ],
  },
  {
    nom: 'Jambes',
    slots: [
      { muscle: 'quadriceps', sets: 8 },
      { muscle: 'ischios', sets: 6 },
      { muscle: 'fessiers', sets: 4 },
      { muscle: 'mollets', sets: 5 },
    ],
  },
  {
    nom: 'Épaules / Abdos',
    slots: [
      { muscle: 'epaules', sets: 8 },
      { muscle: 'abdos', sets: 6 },
    ],
  },
  {
    nom: 'Bras',
    slots: [
      { muscle: 'biceps', sets: 7 },
      { muscle: 'triceps', sets: 7 },
      { muscle: 'avant-bras', sets: 4 },
    ],
  },
  {
    nom: 'Rappel haut du corps',
    slots: [
      { muscle: 'dos', sets: 5 },
      { muscle: 'pectoraux', sets: 5 },
      { muscle: 'epaules', sets: 4 },
    ],
  },
];

/** Volume et intensité d'un objectif. */
interface ObjectiveRules {
  label: string;
  /** Facteur appliqué aux séries de référence de la trame. */
  setsFactor: number;
  polyReps: [number, number];
  monoReps: [number, number];
  /** Décalage de repos par rapport à la règle du CDC (poly 150 s / mono 75 s). */
  restDelta: number;
}

/** Volume et intensité par objectif. */
const OBJECTIVE_RULES: Record<string, ObjectiveRules> = {
  masse: {
    label: 'Prise de masse',
    setsFactor: 1.05,
    polyReps: [8, 10],
    monoReps: [10, 12],
    restDelta: 0,
  },
  force: {
    label: 'Force',
    setsFactor: 1,
    polyReps: [4, 6],
    monoReps: [8, 10],
    restDelta: 45,
  },
  seche: {
    label: 'Perte de poids',
    setsFactor: 0.95,
    polyReps: [12, 15],
    monoReps: [12, 15],
    restDelta: -45,
  },
  forme: {
    label: 'Remise en forme',
    setsFactor: 0.9,
    polyReps: [8, 12],
    monoReps: [10, 12],
    restDelta: -30,
  },
  sante: {
    label: 'Santé / mobilité',
    setsFactor: 0.75,
    polyReps: [12, 15],
    monoReps: [12, 15],
    restDelta: -30,
  },
};

const DEFAULT_OBJECTIVE = 'forme';

/** Facteur de volume par niveau d'expérience. */
const LEVEL_FACTOR: Record<string, number> = {
  debutant: 0.75,
  intermediaire: 1,
  avance: 1.15,
};

const LEVEL_LABEL: Record<string, string> = {
  debutant: 'débutant',
  intermediaire: 'intermédiaire',
  avance: 'avancé',
};

const DEFAULT_LEVEL = 'debutant';

/** Matériel « libre » (barre, haltères) privilégié pour la force et la masse. */
const FREE_WEIGHTS: readonly string[] = [
  'barbell',
  'olympic barbell',
  'ez barbell',
  'trap bar',
  'dumbbell',
  'kettlebell',
];

/** Matériel guidé (machines, poulies) : second choix, très bien pour l'isolation. */
const GUIDED_EQUIPMENT: readonly string[] = ['leverage machine', 'cable', 'smith machine', 'hammer'];

/** Nombre de séances maximum générées (la 7e n'apporterait rien de bon). */
const MAX_SESSIONS = 6;

/** Échauffement + transitions, comptés dans la durée estimée (minutes). */
const WARMUP_MINUTES = 5;

/** Durée moyenne d'une série, en secondes (exécution + installation). */
const POLY_WORK_SECONDS = 45;
const MONO_WORK_SECONDS = 30;

/** Bornes d'une série par exercice dans un programme généré. */
const MIN_SERIES = 2;
const MAX_SERIES = 6;

/** Séance tenable par défaut si le profil n'indique pas de durée (minutes). */
const DEFAULT_DURATION = 60;

// --- Aléatoire reproductible ----------------------------------------------

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine → même plan. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Découpage -------------------------------------------------------------

const FORMAT_LABEL: Record<string, string> = {
  ppl: 'Push / Pull / Legs',
  'upper-lower': 'Haut / Bas du corps',
  'full-body': 'Full body',
  split: 'Split par muscle',
  maison: 'Maison (poids du corps)',
};

const FORMAT_GROUP_NAME: Record<string, string> = {
  ppl: 'PPL',
  'upper-lower': 'Haut / Bas',
  'full-body': 'Full body',
  split: 'Split',
  maison: 'Maison',
};

/** Découpage cohérent avec la fréquence, quand le profil n'en impose pas. */
function defaultFormat(sessionsPerWeek: number): string {
  if (sessionsPerWeek <= 2) return 'full-body';
  if (sessionsPerWeek === 3) return 'ppl';
  if (sessionsPerWeek === 4) return 'upper-lower';
  return 'ppl';
}

/** Découpage retenu après vérification de la compatibilité avec la fréquence. */
function resolveFormat(
  format: string | null,
  sessionsPerWeek: number
): { format: string; warning: string | null } {
  const wanted = format && FORMAT_LABEL[format] ? format : defaultFormat(sessionsPerWeek);

  if (wanted === 'ppl' && sessionsPerWeek < 3) {
    return {
      format: 'full-body',
      warning: `Le découpage ${FORMAT_LABEL.ppl} demande au moins 3 séances par semaine : Full body appliqué.`,
    };
  }
  if (wanted === 'upper-lower' && sessionsPerWeek < 2) {
    return {
      format: 'full-body',
      warning: `Le découpage ${FORMAT_LABEL['upper-lower']} demande au moins 2 séances par semaine : Full body appliqué.`,
    };
  }
  if (wanted === 'split' && sessionsPerWeek < 4) {
    return {
      format: 'upper-lower',
      warning: `Le split par muscle demande au moins 4 séances par semaine : Haut / Bas du corps appliqué.`,
    };
  }
  return { format: wanted, warning: null };
}

/** Modèles de séances d'un découpage, dans l'ordre, pour un nombre de séances donné. */
function templatesFor(format: string, sessionsPerWeek: number): readonly SessionTemplate[] {
  const base = format === 'maison' ? FULL_BODY : format === 'ppl' ? PPL : format === 'split' ? MUSCLE_SPLIT : format === 'upper-lower' ? UPPER_LOWER : FULL_BODY;
  const cycle = base.map((template) =>
    format === 'maison' ? { ...template, nom: template.nom.replace('Full body', 'Maison') } : template
  );
  return Array.from({ length: sessionsPerWeek }, (_, index) => cycle[index % cycle.length]);
}

// --- Sélection des exercices ----------------------------------------------

/** Contexte partagé par la sélection : catalogue utilisable + état du programme. */
interface PickContext {
  pool: readonly CatalogExercise[];
  allowed: ReadonlySet<string>;
  objective: string;
  /** Exercices déjà placés dans la séance en cours. */
  usedInSession: ReadonlySet<number>;
  /** Nombre de séances de la semaine où l'exercice apparaît (variété). */
  usedInWeek: ReadonlyMap<number, number>;
  /** Familles de mouvement déjà travaillées dans la séance (toutes catégories). */
  usedSessionFamilies: ReadonlySet<string>;
  recentIds: ReadonlySet<number>;
  rng: () => number;
}

/** Pénalités de « qualité de fiche » : le dataset contient des doublons mal nommés. */
function blemishPenalty(exercise: CatalogExercise): number {
  let penalty = 0;
  const name = exercise.nom.toLowerCase();
  if (name.includes('(male)') || name.includes('(female)')) penalty += 6;
  if (/v\.?\s?2/.test(name)) penalty += 4;
  if (name.includes('behind the neck')) penalty += 3;
  // Nom technique de fiche (artefact du dataset, ex. « dumbbell rear delt row_shoulder »).
  if (name.includes('_')) penalty += 3;
  // Un nom court correspond en général à la variante canonique du mouvement.
  penalty += Math.min(1, exercise.nom.length * 0.015);
  return penalty;
}

/** Préférence de matériel selon l'objectif (force/masse : poids libres d'abord). */
function equipmentScore(exercise: CatalogExercise, objective: string): number {
  const equipment = exercise.equipment ?? 'body weight';
  let score = 0;
  if (FREE_WEIGHTS.includes(equipment)) score += 1.2;
  if (GUIDED_EQUIPMENT.includes(equipment)) score += 0.5;
  if (equipment === 'body weight') score += 0.35;
  if (equipment === 'band' || equipment === 'resistance band') score += 0.2;
  if (objective === 'sante') score *= 0.3;
  return score;
}

/** Pénalités anatomiques : évite d'aller chercher le bas du dos ou les fléchisseurs. */
function anatomicalPenalty(exercise: CatalogExercise, muscle: string): number {
  const raw = rawPrimary(exercise);
  if (muscle === 'dos' && (raw === 'lower back' || raw === 'spine')) return 5;
  if (muscle === 'abdos' && raw === 'hip flexors') return 5;
  if (muscle === 'dos' && (raw === 'trapezius' || raw === 'traps')) return 2;
  if (muscle === 'dos' && raw === 'levator scapulae') return 3;
  return 0;
}

/**
 * Score d'un candidat pour le groupe `muscle`.
 * `position` 0 = mouvement principal (polyarticulaire privilégié, c'est lui qui
 * porte la séance) ; au-delà = compléments (isolation privilégiée). Le tirage
 * aléatoire ne sert qu'à départager les ex aequo : « Régénérer » change la graine.
 */
/**
 * Groupes où le premier exercice doit être polyarticulaire (c'est lui qui porte la
 * séance). Ailleurs (biceps, triceps, mollets, abdos, avant-bras), le premier
 * mouvement est plutôt de l'isolation : c'est l'usage en salle.
 */
const COMPOUND_FIRST: ReadonlySet<string> = new Set([
  'pectoraux',
  'dos',
  'epaules',
  'quadriceps',
  'ischios',
  'fessiers',
]);

function scoreCandidate(
  exercise: CatalogExercise,
  muscle: string,
  position: number,
  context: PickContext,
  asFallback: boolean,
  usedPatterns: ReadonlySet<string>,
  /** Motifs à privilégier (angle imposé par la trame). */
  prefer?: readonly string[]
): number {
  const compound = isCompound(exercise);
  let value = 0;
  if (COMPOUND_FIRST.has(muscle)) value += compound ? 6 : -1;
  else value += compound ? 0 : 2;
  if (position > 0) value += compound ? -2 : 5;
  if (asFallback) value -= 3;
  value += movementScore(exercise, muscle);
  value -= junkPenalty(exercise);
  // Déjà utilisé dans ce groupe (3 développés couchés) : plus gênant que dans la séance.
  const patterns = movementPatterns(exercise, muscle);
  // Angle demandé par la trame (ex. deltoïdes postérieurs un jour « Pull »).
  if (prefer && prefer.some((pattern) => patterns.includes(pattern))) value += 6;
  if (patterns.some((pattern) => usedPatterns.has(pattern))) value -= 8;
  // Même famille de mouvement déjà travaillée ailleurs dans la séance : on préfère
  // un autre angle (ex. un tirage horizontal après un tirage vertical).
  const family = movementFamily(exercise, muscle);
  if (family !== null && context.usedSessionFamilies.has(family)) value -= 4;
  // Mouvement non reconnu (exercice pris via ses muscles secondaires) : on préfère
  // un mouvement identifié quand il y en a un.
  if (family === null) value -= 1.5;
  value -= blemishPenalty(exercise);
  value -= anatomicalPenalty(exercise, muscle);
  value += equipmentScore(exercise, context.objective);
  value -= (context.usedInWeek.get(exercise.id) ?? 0) * 3;
  if (context.recentIds.has(exercise.id)) value -= 2.5;
  value += context.rng() * 0.8;
  return value;
}

/**
 * Choisit `count` exercices pour un groupe musculaire donné, sans doublon avec le
 * reste de la séance. Priorité aux fiches dont le muscle **principal** est le
 * groupe visé ; on complète avec des exercices secondaires si le matériel ne
 * laisse pas le choix (ex. biceps au poids du corps).
 */
function pickForMuscle(
  muscle: string,
  count: number,
  context: PickContext,
  options: PickOptions = {}
): CatalogExercise[] {
  const candidates: Array<{ exercise: CatalogExercise; fallback: boolean }> = [];

  for (const exercise of context.pool) {
    if (context.usedInSession.has(exercise.id)) continue;
    if (!hasAvailableEquipment(exercise, context.allowed)) continue;
    const primary = primaryMuscle(exercise);
    if (primary === muscle) {
      candidates.push({ exercise, fallback: false });
    } else if (secondaryMuscles(exercise).includes(muscle)) {
      candidates.push({ exercise, fallback: true });
    }
  }

  /**
   * `strictFamilies` : on refuse un second exercice de la même famille de mouvement
   * (deux presses au banc, un tirage vertical puis des tractions…). Désactivé en
   * second recours, quand le matériel ne laisse vraiment pas le choix.
   */
  const attempt = (strictFamilies: boolean): CatalogExercise[] => {
    const picked: CatalogExercise[] = [];
    const taken = new Set<number>(context.usedInSession);
    const usedPatterns = new Set<string>(options.patterns ?? []);
    const usedFamilies = new Set<string>(options.families ?? []);

    for (let position = 0; position < count; position += 1) {
      let best: CatalogExercise | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const candidate of candidates) {
        if (taken.has(candidate.exercise.id)) continue;
        if (options.strictOnly && candidate.fallback) continue;
        const family = movementFamily(candidate.exercise, muscle);
        if (strictFamilies && family !== null && usedFamilies.has(family)) continue;
        const score = scoreCandidate(
          candidate.exercise,
          muscle,
          options.complement ? position + 1 : position,
          context,
          candidate.fallback,
          usedPatterns,
          options.prefer
        );
        if (score > bestScore) {
          bestScore = score;
          best = candidate.exercise;
        }
      }
      if (!best) break;
      picked.push(best);
      taken.add(best.id);
      for (const pattern of movementPatterns(best, muscle)) usedPatterns.add(pattern);
      const family = movementFamily(best, muscle);
      if (family !== null) usedFamilies.add(family);
    }

    return picked;
  };

  const strict = attempt(true);
  return strict.length > 0 ? strict : attempt(false);
}

// --- Durée de séance -------------------------------------------------------

/** Exercices planifiés pour un groupe musculaire, dans l'ordre de travail. */
interface PlannedGroup {
  muscle: string;
  items: PlannedExercise[];
}

/** Nombre d'exercices minimum d'une séance générée (jamais une séance à 1 exo). */
const MIN_ITEMS = 2;
/** Nombre d'exercices maximum par groupe musculaire. */
const MAX_ITEMS_PER_GROUP = 3;

function estimateMinutes(items: readonly PlannedExercise[]): number {
  const seconds = items.reduce((total, planned) => {
    const work = isCompound(planned.exercise) ? POLY_WORK_SECONDS : MONO_WORK_SECONDS;
    return total + planned.series * (work + planned.restTime);
  }, 0);
  return Math.round(WARMUP_MINUTES + seconds / 60);
}

function estimateGroups(groups: readonly PlannedGroup[]): number {
  return estimateMinutes(groups.flatMap((group) => group.items));
}

/**
 * Ajuste la séance à la durée visée : on retire d'abord les exercices les moins
 * prioritaires (la fin de la séance : abdos, mollets, avant-bras…), puis on
 * réduit les séries sans descendre sous `MIN_SERIES`.
 */
function trimToDuration(groups: readonly PlannedGroup[], targetMinutes: number): PlannedGroup[] {
  const list = groups.map((group) => ({ muscle: group.muscle, items: [...group.items] }));
  let guard = 0;

  while (estimateGroups(list) > targetMinutes + 2 && guard < 60) {
    const total = list.reduce((sum, group) => sum + group.items.length, 0);
    if (total <= MIN_ITEMS) break;
    const last = list[list.length - 1];
    last.items.pop();
    if (last.items.length === 0) list.pop();
    guard += 1;
  }

  while (estimateGroups(list) > targetMinutes + 2 && guard < 200) {
    let changed = false;
    for (let group = list.length - 1; group >= 0 && !changed; group -= 1) {
      const items = list[group].items;
      for (let index = items.length - 1; index >= 0; index -= 1) {
        if (items[index].series > MIN_SERIES) {
          items[index] = { ...items[index], series: items[index].series - 1 };
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
    guard += 1;
  }

  return list;
}

/** Prépare un exercice planifié (reps et repos selon l'objectif et `is_poly`). */
function plannedExercise(
  exercise: CatalogExercise,
  series: number,
  rules: ObjectiveRules
): PlannedExercise {
  const isPoly = isCompound(exercise);
  const [repsMin, repsMax] = isPoly ? rules.polyReps : rules.monoReps;
  return { exercise, series, repsMin, repsMax, restTime: restTimeFor(isPoly, rules.restDelta) };
}

/** Répartition des séries d'un muscle entre ses exercices (les premiers en ont plus). */
function splitSeries(total: number, exercises: number): number[] {
  const base = Math.floor(total / exercises);
  const remainder = total % exercises;
  return Array.from({ length: exercises }, (_, index) =>
    Math.max(MIN_SERIES, Math.min(MAX_SERIES, base + (index < remainder ? 1 : 0)))
  );
}

// --- Génération ------------------------------------------------------------

/** 3 à 4 séries par exercice : la maille du découpage en exercices. */
function exerciseCountFor(sets: number): number {
  if (sets >= 10) return 3;
  if (sets >= 6) return 2;
  return 1;
}

/**
 * Construit un programme complet à partir du profil.
 * Fonction pure : aucun accès base, aucune notion de date.
 */
export function generateProgram(input: GenerateProgramInput): GeneratedProgram {
  const profile = input.profile;
  const objective = profile.objectif && OBJECTIVE_RULES[profile.objectif] ? profile.objectif : DEFAULT_OBJECTIVE;
  const objectiveRules = OBJECTIVE_RULES[objective];
  const level = profile.niveau && LEVEL_FACTOR[profile.niveau] ? profile.niveau : DEFAULT_LEVEL;
  const levelFactor = LEVEL_FACTOR[level];
  const sessionsPerWeek = Math.min(MAX_SESSIONS, Math.max(1, profile.sessionsPerWeek ?? 3));
  const targetMinutes = Math.min(120, Math.max(20, profile.dureeSeance ?? DEFAULT_DURATION));

  const warnings: string[] = [];
  const rationale: string[] = [];

  if ((profile.sessionsPerWeek ?? 3) > MAX_SESSIONS) {
    warnings.push(
      `Tu as indiqué ${profile.sessionsPerWeek} séances par semaine : le programme est plafonné à ${MAX_SESSIONS}, la récupération fait partie de la progression.`
    );
  }

  const { format, warning: formatWarning } = resolveFormat(profile.format, sessionsPerWeek);
  if (formatWarning) warnings.push(formatWarning);

  // 1. Catalogue utilisable : écarte cardio, matériel absent et mouvements à risque.
  const allowed = allowedEquipment(profile.materiel, format);
  // Tractions et dips demandent de quoi se suspendre : il faut une barre déclarée
  // (« barre de traction », ou la salle qui en est équipée).
  const hasBar = profile.materiel.includes('traction') || profile.materiel.includes('salle');
  const recentIds = new Set(input.recentExerciseIds ?? []);
  const excludedByZone = new Map<string, number>();
  const pool = input.catalog.filter((exercise) => {
    if (isCardio(exercise)) return false;
    if (isNonStrength(exercise)) return false;
    if (!hasAvailableEquipment(exercise, allowed)) return false;
    if (!hasBar && needsPullUpBar(exercise)) return false;
    const zone = zoneViolation(exercise, profile.zonesDouloureuses);
    if (zone) {
      excludedByZone.set(zone, (excludedByZone.get(zone) ?? 0) + 1);
      return false;
    }
    return primaryMuscle(exercise) !== null;
  });

  if (allowed.size <= 1) {
    warnings.push(
      'Aucun matériel déclaré : le programme est construit au poids du corps (les tractions, dips et pompes remplacent la fonte).'
    );
  }
  if (profile.zonesDouloureuses.length > 0) {
    const details = [...excludedByZone.entries()]
      .map(([zone, count]) => `${count} pour « ${zoneLabel(zone)} »`)
      .join(', ');
    warnings.push(
      `Mouvements écartés par prudence${details ? ` (${details})` : ''} — ce n'est pas un avis médical, en cas de douleur consulte un professionnel de santé.`
    );
  }

  // 2. Séances : trame de découpage × gabarit d'objectif / niveau.
  const rng = createRandom(input.seed);
  const templates = templatesFor(format, sessionsPerWeek);
  const usedInWeek = new Map<number, number>();
  const weekly = new Map<string, number>();
  const sessions: PlannedSession[] = [];
  /** Groupes de la trame pour lesquels le catalogue ne propose **aucun** exercice. */
  const unreachable = new Set<string>();

  for (const template of templates) {
    const usedInSession = new Set<number>();
    const usedSessionFamilies = new Set<string>();
    const context: PickContext = {
      pool,
      allowed,
      objective,
      usedInSession,
      usedInWeek,
      recentIds,
      rng,
      usedSessionFamilies,
    };
    const groups: PlannedGroup[] = [];

    // a. Un exercice (ou deux) par groupe musculaire de la trame.
    for (const slot of template.slots) {
      const targetSets = Math.max(
        MIN_SERIES,
        Math.round(slot.sets * objectiveRules.setsFactor * levelFactor)
      );
      const picked = pickForMuscle(slot.muscle, exerciseCountFor(targetSets), context, {
        prefer: slot.prefer,
      });
      if (picked.length === 0) {
        unreachable.add(slot.muscle);
        continue;
      }

      const seriesList = splitSeries(targetSets, picked.length);
      const items = picked.map((exercise, index) =>
        plannedExercise(exercise, seriesList[index], objectiveRules)
      );
      for (const item of items) {
        usedInSession.add(item.exercise.id);
        const family = movementFamily(item.exercise, slot.muscle);
        if (family !== null) usedSessionFamilies.add(family);
      }
      groups.push({ muscle: slot.muscle, items });
    }

    // b. Ajustement à la durée visée (on retire la fin, puis des séries).
    const fitted = trimToDuration(groups, targetMinutes);

    // c. Séance trop courte : on ajoute des exercices plutôt que d'empiler des séries.
    // On complète dans l'ordre de la trame (le muscle qui porte la séance d'abord),
    // avec **un seul** complément par groupe : le volume doit rester celui du découpage.
    const grew = new Set<string>();
    let guard = 0;
    while (estimateGroups(fitted) < targetMinutes - 8 && guard < 40) {
      const group = fitted.find(
        (candidate) =>
          candidate.items.length < MAX_ITEMS_PER_GROUP && !grew.has(candidate.muscle)
      );
      if (!group) break;
      grew.add(group.muscle);
      const avoid = {
        patterns: new Set(
          group.items.flatMap((item) => movementPatterns(item.exercise, group.muscle))
        ),
        families: new Set(
          group.items.flatMap((item) => {
            const family = movementFamily(item.exercise, group.muscle);
            return family === null ? [] : [family];
          })
        ),
      };
      const [extra] = pickForMuscle(group.muscle, 1, context, {
        ...avoid,
        complement: true,
        strictOnly: true,
      });
      if (!extra) break;
      group.items.push(plannedExercise(extra, MIN_SERIES + 1, objectiveRules));
      usedInSession.add(extra.id);
      const extraFamily = movementFamily(extra, group.muscle);
      if (extraFamily !== null) usedSessionFamilies.add(extraFamily);
      guard += 1;
    }

    if (fitted.length === 0) continue;
    const exercises = fitted.flatMap((group) => group.items);

    sessions.push({
      nom: template.nom,
      muscles: fitted.map((group) => group.muscle),
      exercises,
      estimatedMinutes: estimateMinutes(exercises),
    });

    for (const item of exercises) {
      const muscle = primaryMuscle(item.exercise);
      if (muscle) weekly.set(muscle, (weekly.get(muscle) ?? 0) + item.series);
      // La variété se joue sur la semaine entière : un exercice déjà placé ailleurs
      // est pénalisé à la séance suivante.
      usedInWeek.set(item.exercise.id, (usedInWeek.get(item.exercise.id) ?? 0) + 1);
    }
  }

  // 3. Groupes de la trame qu'aucun exercice du catalogue ne peut couvrir avec ce matériel.
  if (unreachable.size > 0) {
    warnings.push(
      `Aucun exercice accessible pour : ${[...unreachable].map((key) => muscleLabel(key)).join(', ')}. Ces muscles seront travaillés indirectement par les autres mouvements — ajouter du matériel (élastique, haltères) débloque le reste.`
    );
  }

  // 4. Récapitulatif lisible.
  rationale.push(
    `Objectif ${objectiveRules.label.toLowerCase()} : ${objectiveRules.polyReps[0]}–${objectiveRules.polyReps[1]} reps sur les mouvements polyarticulaires, ${objectiveRules.monoReps[0]}–${objectiveRules.monoReps[1]} sur l'isolation.`
  );
  rationale.push(
    `${sessionsPerWeek} séances par semaine, découpage ${FORMAT_LABEL[format]}, environ ${targetMinutes} min par séance.`
  );
  rationale.push(
    'Le volume est calé sur cette durée : si une séance débordait, les exercices de fin de séance (abdos, mollets, avant-bras) sont retirés en premier ; s’il restait du temps, des exercices complémentaires sont ajoutés.'
  );
  rationale.push(
    `Niveau ${LEVEL_LABEL[level]} : ${Math.round(levelFactor * 100)} % du volume de référence, ${MIN_SERIES} à ${MAX_SERIES} séries par exercice.`
  );
  if (profile.materiel.length > 0) {
    rationale.push(`Matériel pris en compte : ${profile.materiel.length} type(s) déclaré(s).`);
  }
  rationale.push(
    'Charges de départ reprises de ta dernière séance sur chaque exercice : ajuste le poids dès que tu atteins le haut de la fourchette de reps.'
  );

  const weeklySets = [...weekly.entries()]
    .map(([muscle, sets]) => ({ muscle, label: muscleLabel(muscle), sets }))
    .sort((a, b) => b.sets - a.sets);

  return {
    nomGroupe: `${FORMAT_GROUP_NAME[format]} — généré`,
    format,
    sessions,
    weeklySets,
    rationale,
    warnings,
  };
}

/** Repos conseillé (secondes) : règle du CDC par `is_poly`, décalée par l'objectif. */
function restTimeFor(isPoly: boolean, restDelta: number): number {
  const base = isPoly ? 150 : 75;
  return Math.min(300, Math.max(45, base + restDelta));
}

/** Libellé français d'une zone sensible, pour les messages. */
function zoneLabel(zone: string): string {
  const labels: Record<string, string> = {
    nuque: 'nuque / cou',
    epaules: 'épaules',
    coudes: 'coudes',
    poignets: 'poignets / mains',
    dos: 'dos',
    lombaires: 'lombaires / bas du dos',
    hanches: 'hanches',
    genoux: 'genoux',
    chevilles: 'chevilles / pieds',
  };
  return labels[zone] ?? zone;
}

/** Nom affichable d'un exercice (réexporté pour l'UI) : toujours en anglais. */
export { displayName as exerciseDisplayName };

/** Résumé « 4 × 8–10 reps · repos 2 min 30 » d'un exercice planifié. */
export function describePlannedExercise(planned: PlannedExercise): string {
  const minutes = Math.floor(planned.restTime / 60);
  const seconds = planned.restTime % 60;
  const rest =
    minutes === 0 ? `${seconds} s` : seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds}`;
  return `${planned.series} × ${planned.repsMin}–${planned.repsMax} reps · repos ${rest}`;
}
