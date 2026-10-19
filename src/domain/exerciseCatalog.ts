/**
 * Référentiel reliant le **profil** (matériel, zones sensibles) aux valeurs du
 * dataset d'exercices, plus les filtres utilisés par le générateur de programme.
 *
 * Rien ici n'est une séance : uniquement des tables de correspondance relues à la
 * main et des prédicats. Le choix des exercices est fait par
 * `programGenerator.ts` sur le catalogue réel (1 324 fiches).
 */

import { muscleKey, parseSecondaryMuscles } from './muscles';

/** Fiche minimale du catalogue (structurellement compatible avec `Exercise`). */
export interface CatalogExercise {
  id: number;
  nom: string;
  nom_fr: string | null;
  muscle_group: string;
  target: string | null;
  secondary_muscles: string | null;
  is_poly: number;
  category: string | null;
  equipment: string | null;
  /** Nom de fichier de la vignette locale (facultatif : sert à l'aperçu). */
  image?: string | null;
}

/** Matériel autorisé **toujours** (aucune installation requise). */
const ALWAYS_AVAILABLE = 'body weight';

/** Matériel utilisable à la maison même sans salle (petit, transportable). */
const HOME_AVAILABLE: readonly string[] = ['body weight', 'band', 'resistance band'];

/** Valeurs `equipment` du dataset correspondant à chaque clé de `EQUIPMENTS`. */
const EQUIPMENT_BY_KEY: Record<string, readonly string[]> = {
  salle: [
    'barbell',
    'olympic barbell',
    'ez barbell',
    'trap bar',
    'dumbbell',
    'cable',
    'leverage machine',
    'smith machine',
    'hammer',
    'kettlebell',
    'medicine ball',
    'stability ball',
    'bosu ball',
    'sled machine',
    'rope',
    'roller',
    'wheel roller',
    'tire',
    'assisted',
    'weighted',
  ],
  halteres: ['dumbbell'],
  barre: ['barbell', 'olympic barbell', 'ez barbell', 'trap bar'],
  // Barre de traction : tractions (poids du corps) + machines d'assistance.
  traction: ['assisted'],
  // Poids du corps : déjà toujours autorisé, rien à ajouter.
  'poids-corps': [],
  kettlebell: ['kettlebell'],
  elastiques: ['band', 'resistance band'],
  machines: ['leverage machine', 'cable', 'smith machine', 'hammer', 'assisted'],
};

/** Machines de cardio du dataset, écartées des séances de musculation. */
const CARDIO_EQUIPMENT: readonly string[] = [
  'skierg machine',
  'elliptical machine',
  'stationary bike',
  'stepmill machine',
  'upper body ergometer',
];

/**
 * Matériel retenu pour un profil.
 * - Le poids du corps reste toujours possible (repli universel).
 * - Le format « maison » restreint aux petits matériels, même si la salle est cochée.
 * - Aucun matériel déclaré → poids du corps uniquement (le générateur le signale).
 */
export function allowedEquipment(materiel: readonly string[], format: string | null): Set<string> {
  if (format === 'maison') {
    const home = new Set<string>(HOME_AVAILABLE);
    if (materiel.includes('elastiques')) {
      home.add('band');
      home.add('resistance band');
    }
    return home;
  }

  const allowed = new Set<string>([ALWAYS_AVAILABLE]);
  for (const key of materiel) {
    for (const value of EQUIPMENT_BY_KEY[key] ?? []) {
      allowed.add(value);
    }
  }
  return allowed;
}

/** true si l'exercice se fait avec le matériel retenu (équipement absent = poids du corps). */
export function hasAvailableEquipment(
  exercise: CatalogExercise,
  allowed: ReadonlySet<string>
): boolean {
  const equipment = exercise.equipment ?? ALWAYS_AVAILABLE;
  return allowed.has(equipment);
}

/** true pour les exercices de cardio / machines d'endurance. */
export function isCardio(exercise: CatalogExercise): boolean {
  if (exercise.category === 'cardio') return true;
  return exercise.equipment !== null && CARDIO_EQUIPMENT.includes(exercise.equipment);
}

/**
 * true pour un exercice qui se mesure **au temps** et non en répétitions :
 * course, vélo, rameur, corde à sauter, machines d'endurance…
 *
 * Le générateur écarte déjà ces fiches des programmes de musculation. Ajoutées
 * à la main, elles sont chronométrées : on saisit une durée (mm:ss) par série,
 * sans fourchette de reps ni charge.
 */
export function isEndurance(exercise: CatalogExercise): boolean {
  return isCardio(exercise);
}

/**
 * Mouvements qui exigent une barre fixe (tractions) ou des barres parallèles.
 * `equipment` vaut « body weight » dans le dataset, ce qui laisserait croire
 * qu'ils sont possibles partout : on les conditionne au matériel déclaré.
 */
const BAR_PATTERNS: readonly string[] = [
  'pull up',
  'pull-up',
  'chin up',
  'chin-up',
  'hang',
  'muscle up',
  'rope climb',
  'l-sit',
];

export function needsPullUpBar(exercise: CatalogExercise): boolean {
  const name = exercise.nom.toLowerCase();
  return BAR_PATTERNS.some((pattern) => name.includes(pattern));
}

/**
 * true pour les entrées du dataset qui ne sont **pas** des exercices de
 * musculation : étirements, yoga, équilibre, haltérophilie de compétition.
 * Elles n'ont pas leur place dans un programme généré.
 */
const NON_STRENGTH_PATTERNS: readonly string[] = [
  'stretch',
  'balance board',
  'circle',
  'pose',
  'isometric',
  'snatch',
  'clean',
  'jerk',
  'good morning',
  'guillotine',
  'jump rope',
];

export function isNonStrength(exercise: CatalogExercise): boolean {
  const name = exercise.nom.toLowerCase();
  return NON_STRENGTH_PATTERNS.some((pattern) => name.includes(pattern));
}

/**
 * Mouvements « d'isolation » : `is_poly` du dataset vient d'une heuristique par
 * mots-clés et se trompe parfois (« standing calf raise » est marqué
 * polyarticulaire). On corrige ici, car `is_poly` pilote le repos, la fourchette
 * de reps et le rang de l'exercice dans la séance.
 */
const ISOLATION_PATTERNS: readonly string[] = [
  'curl',
  'raise',
  'extension',
  'fly',
  'pushdown',
  'push down',
  'kickback',
  'calf',
  'calves',
  'shrug',
  'crossover',
  'pec deck',
  'pullover',
  'pull-over',
  'wrist',
  'crunch',
  'plank',
  'abduction',
  'adduction',
  'face pull',
  'sit up',
  'sit-up',
];

/** true pour un mouvement réellement polyarticulaire (compound). */
export function isCompound(exercise: CatalogExercise): boolean {
  if (exercise.is_poly !== 1) return false;
  const name = exercise.nom.toLowerCase();
  return !ISOLATION_PATTERNS.some((pattern) => name.includes(pattern));
}

/**
 * Mouvements attendus pour chaque groupe musculaire, avec leur poids.
 * C'est la « connaissance métier » du générateur : sans cette table, il piocherait
 * des mouvements exotiques du dataset (barres « skier », « elevator »…) au lieu du
 * développé couché ou du tirage vertical.
 */
type PatternWeight = readonly [pattern: string, weight: number];

const MUSCLE_PATTERNS: Record<string, readonly PatternWeight[]> = {
  pectoraux: [
    ['bench press', 6],
    ['chest press', 5],
    // Écartés : le complément classique d'une presse (amplitude et tension différentes).
    ['fly', 4],
    ['pec deck', 4],
    ['crossover', 3],
    ['push up', 3],
    ['push-up', 3],
    ['dip', 3],
    ['incline', 2],
  ],
  dos: [
    ['pulldown', 6],
    ['pull up', 6],
    ['pull-up', 6],
    ['chin up', 5],
    ['chin-up', 5],
    ['row', 5],
    ['face pull', 3],
    ['pullover', 3],
    ['pull-over', 3],
    ['reverse fly', 2],
    ['shrug', 2],
  ],
  epaules: [
    ['shoulder press', 6],
    ['overhead press', 6],
    ['military press', 6],
    ['arnold press', 4],
    ['lateral raise', 5],
    ['rear delt', 4],
    ['reverse fly', 4],
    ['front raise', 3],
    ['face pull', 3],
    ['upright row', 2],
    ['raise', 2],
  ],
  biceps: [
    ['curl', 6],
    ['chin up', 4],
    ['chin-up', 4],
    ['pull up', 3],
    ['pull-up', 3],
  ],
  triceps: [
    ['pushdown', 6],
    ['push down', 6],
    ['dip', 4],
    ['close grip', 4],
    ['skull', 3],
    ['extension', 3],
    ['bench press', 3],
    ['kickback', 2],
  ],
  quadriceps: [
    ['squat', 6],
    ['leg press', 6],
    ['leg extension', 5],
    ['lunge', 4],
    ['step up', 3],
    ['split squat', 3],
  ],
  ischios: [
    ['leg curl', 6],
    ['romanian', 5],
    ['deadlift', 5],
    ['stiff leg', 4],
    ['glute ham', 4],
    ['good morning', 3],
    ['hip thrust', 2],
  ],
  fessiers: [
    ['hip thrust', 6],
    ['glute bridge', 5],
    ['kickback', 4],
    ['abduction', 4],
    ['lunge', 3],
    ['squat', 3],
    ['deadlift', 3],
    ['step up', 3],
  ],
  mollets: [
    ['calf raise', 6],
    ['calf press', 5],
    ['donkey calf', 4],
    ['calf', 4],
  ],
  abdos: [
    ['plank', 5],
    ['rollerout', 5],
    ['ab wheel', 5],
    ['crunch', 4],
    ['leg raise', 4],
    ['hanging', 3],
    ['sit up', 3],
    ['sit-up', 3],
    ['hollow', 3],
    ['russian twist', 3],
    ['side bend', 2],
  ],
  'avant-bras': [
    ['wrist curl', 6],
    ['reverse curl', 5],
    ['farmer', 5],
    ['grip', 3],
    ['curl', 2],
  ],
};

/** Motifs attendus présents dans le nom d'un exercice, pour un groupe donné. */
export function movementPatterns(exercise: CatalogExercise, muscle: string): string[] {
  const patterns = MUSCLE_PATTERNS[muscle];
  if (!patterns) return [];
  const name = exercise.nom.toLowerCase();
  return patterns.filter(([pattern]) => name.includes(pattern)).map(([pattern]) => pattern);
}

/**
 * Familles de mouvements : plusieurs motifs différents sollicitent en réalité le
 * **même angle et la même fatigue**. « Développé couché », « développé incliné »,
 * « presse à cuisses » pour les pectoraux d'un côté ; « tirage vertical » et
 * « tractions » de l'autre. Enchaîner les deux dans une séance pour un même
 * muscle, c'est refaire le même mouvement deux fois — et laisser le reste du
 * muscle de côté. On garde donc **un exercice par famille** dans un groupe.
 *
 * La table est indexée par motif (voir `MUSCLE_PATTERNS`) ; un motif absent est
 * sa propre famille, donc jamais en conflit avec un autre.
 */
const PATTERN_FAMILY: Record<string, string> = {
  // Poussée horizontale : toutes les presses au banc, quel que soit l'angle.
  'bench press': 'presse-couche',
  'chest press': 'presse-couche',
  incline: 'presse-couche',
  decline: 'presse-couche',
  // Écartés : tension et amplitude différentes d'une presse.
  fly: 'ecarte',
  crossover: 'ecarte',
  'pec deck': 'ecarte',
  // Poussée au poids du corps.
  'push up': 'pompes',
  'push-up': 'pompes',
  dip: 'dips',
  // Tractions verticales (grand dorsal) : tirage vertical, tractions, chin-ups.
  pulldown: 'traction-verticale',
  'pull up': 'traction-verticale',
  'pull-up': 'traction-verticale',
  'chin up': 'traction-verticale',
  'chin-up': 'traction-verticale',
  // Tirages horizontaux (dos épais, rhomboïdes).
  row: 'tirage-horizontal',
  pullover: 'pullover',
  'pull-over': 'pullover',
  'face pull': 'epaules-arriere',
  'reverse fly': 'epaules-arriere',
  'rear delt': 'epaules-arriere',
  shrug: 'trapezes',
  // Épaules.
  'shoulder press': 'presse-epaules',
  'overhead press': 'presse-epaules',
  'military press': 'presse-epaules',
  'arnold press': 'presse-epaules',
  'lateral raise': 'elevation-laterale',
  raise: 'elevation-laterale',
  'front raise': 'elevation-frontale',
  'upright row': 'tirage-vertical-buste',
  // Bras.
  curl: 'flexion-coude',
  'reverse curl': 'flexion-coude',
  pushdown: 'extension-coude',
  'push down': 'extension-coude',
  'close grip': 'extension-coude',
  skull: 'extension-coude',
  extension: 'extension-coude',
  kickback: 'extension-coude',
  // Jambes.
  squat: 'squat',
  'split squat': 'squat',
  'leg press': 'presse-jambes',
  lunge: 'fente',
  'step up': 'montee',
  'leg extension': 'extension-genou',
  'leg curl': 'flexion-genou',
  'glute ham': 'flexion-genou',
  romanian: 'charniere-hanche',
  deadlift: 'charniere-hanche',
  'stiff leg': 'charniere-hanche',
  'good morning': 'charniere-hanche',
  'hip thrust': 'poussee-hanche',
  'glute bridge': 'poussee-hanche',
  abduction: 'abduction',
  adduction: 'adduction',
  // Mollets : un seul mouvement, toutes les variantes se valent.
  'calf raise': 'mollets',
  'calf press': 'mollets',
  'donkey calf': 'mollets',
  calf: 'mollets',
  // Abdos.
  plank: 'gainage',
  rollerout: 'gainage',
  'ab wheel': 'gainage',
  crunch: 'flexion-tronc',
  'sit up': 'flexion-tronc',
  'sit-up': 'flexion-tronc',
  'leg raise': 'flexion-hanches',
  hanging: 'flexion-hanches',
  hollow: 'antiflexion',
  'russian twist': 'rotation',
  'side bend': 'rotation',
  // Avant-bras.
  'wrist curl': 'avant-bras',
  farmer: 'portage',
  grip: 'portage',
};

/**
 * Famille du mouvement dominant d'un exercice pour ce groupe musculaire.
 * `null` quand aucun motif n'est reconnu : l'exercice vient là en complément via
 * ses muscles secondaires, et n'entre en conflit avec rien.
 */
export function movementFamily(exercise: CatalogExercise, muscle: string): string | null {
  const patterns = MUSCLE_PATTERNS[muscle];
  if (!patterns) return null;
  const name = exercise.nom.toLowerCase();
  let dominant: string | null = null;
  let dominantWeight = 0;
  for (const [pattern, weight] of patterns) {
    if (weight <= dominantWeight || !name.includes(pattern)) continue;
    dominant = pattern;
    dominantWeight = weight;
  }
  if (!dominant) return null;
  return PATTERN_FAMILY[dominant] ?? dominant;
}

/**
 * Familles de mouvement d'un exercice, **indépendamment du groupe musculaire** :
 * union de toutes les familles dont un motif apparaît dans le nom. Sert à
 * repérer les variantes d'un même mouvement pour la substitution (ex. « push-up »
 * ≈ « diamond push-up », même si le dataset classe la seconde sur les triceps).
 */
export function movementFamilies(exercise: CatalogExercise): string[] {
  const name = exercise.nom.toLowerCase();
  const families = new Set<string>();
  for (const [pattern, family] of Object.entries(PATTERN_FAMILY)) {
    if (name.includes(pattern)) families.add(family);
  }
  return [...families];
}

/** Bonus de « bon mouvement » : le meilleur motif reconnu pour ce groupe. */
export function movementScore(exercise: CatalogExercise, muscle: string): number {
  const patterns = MUSCLE_PATTERNS[muscle];
  if (!patterns) return 0;
  const name = exercise.nom.toLowerCase();
  let best = 0;
  for (const [pattern, weight] of patterns) {
    if (name.includes(pattern)) best = Math.max(best, weight);
  }
  return best;
}

/** Entrées du dataset qui ne sont pas des mouvements de musculation exploitables. */
const JUNK_PATTERNS: readonly string[] = [
  'boxing',
  'hook',
  'elevator',
  'breeding',
  'skier',
  'bird dog',
  'devil',
  'muscle up',
  'iron cross',
  'slide',
  // Figures de gymnastique : du travail de skill, pas un exercice de musculation.
  'back lever',
  'front lever',
  'planche',
  'human flag',
  // Entrée du dataset sans mouvement réel (le nom est le muscle lui-même).
  'quads',
];

/** Mouvements à éviter sans les interdire : impacts, équilibre, mouvements de gym avancés. */
const DISCOURAGED_PATTERNS: readonly string[] = [
  'balance',
  'jump',
  'plyo',
  'sissy',
  'wall',
  'walking',
  // Mouvements très techniques : hors sujet pour un programme général.
  'overhead squat',
  'zercher',
  'jefferson',
  'pistol',
];

/** Pénalité de qualité : noms manifestement hors-sujet ou discutable. */
export function junkPenalty(exercise: CatalogExercise): number {
  const name = exercise.nom.toLowerCase();
  if (JUNK_PATTERNS.some((pattern) => name.includes(pattern))) return 5;
  if (DISCOURAGED_PATTERNS.some((pattern) => name.includes(pattern))) return 2;
  return 0;
}

/** Une restriction liée à une zone sensible : motifs de nom et/ou groupes écartés. */
interface ZoneGuard {
  /** Clé de `HEALTH_ZONES`. */
  key: string;
  /** Motifs (minuscules, anglais) interdits dans le nom de l'exercice. */
  forbidden: readonly string[];
}

/**
 * Garde-fous **de prudence** (et non un avis médical) : pour chaque zone sensible,
 * les mouvements classiquement déconseillés. Volontairement conservateurs — mieux
 * vaut une séance un peu plus pauvre qu'une blessure — et faciles à ajuster.
 */
const ZONE_GUARDS: readonly ZoneGuard[] = [
  // Charge directe du rachis cervical / trapèzes supérieurs.
  { key: 'nuque', forbidden: ['shrug', 'neck', 'upright row'] },
  // Épaule : élévations au-dessus de la tête et rotations sous charge.
  {
    key: 'epaules',
    forbidden: [
      'overhead press',
      'shoulder press',
      'military press',
      'arnold press',
      'push press',
      'lateral raise',
      'front raise',
      'upright row',
      'handstand',
      'bench dip',
      'behind the neck',
    ],
  },
  // Coude : extension/flexion lourde et prise serrée.
  {
    key: 'coudes',
    forbidden: ['skull', 'french press', 'triceps extension', 'close-grip', 'preacher', 'dip'],
  },
  // Poignet : flexion/extension directe et positions en extension forcée.
  {
    key: 'poignets',
    forbidden: ['wrist curl', 'wrist extension', 'reverse curl', 'front squat', 'clean', 'snatch'],
  },
  // Dos : mouvements de chargement du rachis en porte-à-faux.
  {
    key: 'dos',
    forbidden: ['deadlift', 'good morning', 'bent over', 't-bar', 'hyperextension', 'back extension', 'clean', 'snatch'],
  },
  // Lombaires : idem + flexion lourde du tronc.
  {
    key: 'lombaires',
    forbidden: [
      'deadlift',
      'good morning',
      'bent over',
      'hyperextension',
      'back extension',
      'romanian',
      'stiff leg',
      'clean',
      'snatch',
      'sit-up',
      'sit up',
      'leg raise',
      'wheel roller',
    ],
  },
  // Hanches : poussées de hanche et amplitudes extrêmes.
  {
    key: 'hanches',
    forbidden: ['hip thrust', 'glute bridge', 'hip abduction', 'hip adduction', 'split squat', 'lunge', 'good morning'],
  },
  // Genoux : flexion profonde chargée et impacts.
  {
    key: 'genoux',
    forbidden: ['squat', 'lunge', 'leg extension', 'step up', 'sissy', 'hack', 'pistol', 'jump', 'sprint'],
  },
  // Chevilles : appuis dynamiques et extensions répétées.
  {
    key: 'chevilles',
    forbidden: ['calf raise', 'jump', 'run', 'walk', 'step', 'box'],
  },
];

/**
 * Motif de la zone sensible qui écarte cet exercice, ou null s'il est autorisé.
 * Renvoie le libellé de la zone pour pouvoir l'expliquer dans le récapitulatif.
 */
export function zoneViolation(
  exercise: CatalogExercise,
  zones: readonly string[]
): string | null {
  if (zones.length === 0) return null;
  const name = exercise.nom.toLowerCase();
  for (const zone of zones) {
    const guard = ZONE_GUARDS.find((item) => item.key === zone);
    if (!guard) continue;
    if (guard.forbidden.some((pattern) => name.includes(pattern))) {
      return guard.key;
    }
  }
  return null;
}

/** Groupe musculaire canonique principal d'un exercice. */
export function primaryMuscle(exercise: CatalogExercise): string | null {
  return muscleKey(exercise.target) ?? muscleKey(exercise.muscle_group);
}

/** Groupes musculaires secondaires canoniques d'un exercice. */
export function secondaryMuscles(exercise: CatalogExercise): string[] {
  const keys = parseSecondaryMuscles(exercise.secondary_muscles)
    .map((raw) => muscleKey(raw))
    .filter((key): key is string => key !== null);
  const primary = primaryMuscle(exercise);
  return [...new Set(keys.filter((key) => key !== primary))];
}

/** Muscles bruts du dataset (non canonisés) : sert aux pénalités de qualité. */
export function rawPrimary(exercise: CatalogExercise): string {
  return (exercise.target ?? exercise.muscle_group ?? '').trim().toLowerCase();
}

/** Nom affiché dans l'app : les noms d'exercices restent en anglais (langue d'usage). */
export function displayName(exercise: CatalogExercise): string {
  return exercise.nom.trim() || exercise.nom_fr?.trim() || exercise.nom;
}
