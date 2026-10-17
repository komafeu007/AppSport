import type { Exercise } from '../services/database';

const ACCENTS: Record<string, string> = {
  à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', î: 'i', ï: 'i',
  ô: 'o', ö: 'o', ù: 'u', û: 'u', ü: 'u', ç: 'c', œ: 'oe',
};

/** Minuscules + suppression des accents, pour comparer FR/EN. */
export function normalize(value: string): string {
  return value.toLowerCase().replace(/[àâäéèêëîïôöùûüçœ]/g, (c) => ACCENTS[c] ?? c);
}

/** Requêtes FR -> termes EN du dataset (les muscles sont stockés en anglais). */
const MUSCLE_ALIASES: Record<string, string[]> = {
  pec: ['pectorals'],
  pecs: ['pectorals'],
  pectoraux: ['pectorals'],
  poitrine: ['pectorals', 'chest'],
  epaule: ['delts', 'shoulders'],
  epaules: ['delts', 'shoulders'],
  dos: ['back', 'lats', 'latissimus'],
  jambe: ['quads', 'hamstrings', 'glutes'],
  jambes: ['quads', 'hamstrings', 'glutes'],
  cuisse: ['quads'],
  cuisses: ['quads'],
  ischio: ['hamstrings'],
  ischios: ['hamstrings'],
  fessier: ['glutes'],
  fessiers: ['glutes'],
  mollet: ['calves'],
  mollets: ['calves'],
  abdo: ['abs', 'waist'],
  abdos: ['abs', 'waist'],
  bras: ['upper arms'],
  avantbras: ['forearms'],
  trapeze: ['traps'],
  trapezes: ['traps'],
  cou: ['neck'],
  cardio: ['cardiovascular system', 'cardio'],
};

/** Mots de mouvement : si le terme cherché est immédiatement suivi de l'un d'eux, c'est un match "central". */
const MOVEMENT_WORDS = new Set([
  'press', 'squat', 'deadlift', 'curl', 'row', 'raise', 'extension', 'fly', 'flye',
  'pulldown', 'pull', 'push', 'lunge', 'dip', 'crunch', 'plank', 'thrust', 'bridge',
  'shrug', 'kickback', 'pushdown', 'pullover', 'crossover', 'clean', 'snatch', 'jerk',
  'march', 'walk', 'run', 'jump', 'swing', 'twist', 'rotation', 'stretch', 'climber',
]);

/** Mouvements classiques : bonus pour faire remonter les exercices "principaux". */
const CLASSIC_PHRASES = [
  'bench press', 'incline bench press', 'decline bench press',
  'full squat', 'front squat', 'back squat', 'hack squat',
  'deadlift', 'romanian deadlift', 'stiff leg deadlift',
  'pull-up', 'chin-up', 'push-up', 'dip', 'overhead press', 'military press',
  'shoulder press', 'lateral raise', 'front raise', 'rear delt',
  'barbell row', 'dumbbell row', 'seated row', 'lat pulldown', 'upright row',
  'biceps curl', 'hammer curl', 'preacher curl', 'triceps extension', 'triceps pushdown',
  'leg press', 'leg extension', 'leg curl', 'calf raise', 'lunge', 'shrug',
  'plank', 'crunch', 'hip thrust', 'glute bridge', 'face pull', 'good morning',
  'pullover', 'pushdown', 'push down',
];

function classicBonus(name: string | null | undefined, terms: string[]): number {
  if (!name) return 0;
  const n = normalize(name);
  return CLASSIC_PHRASES.some(
    (phrase) => n.includes(phrase) && terms.some((term) => term.length > 0 && phrase.includes(term))
  )
    ? 5
    : 0;
}

export function queryTerms(query: string): string[] {
  const base = normalize(query.trim());
  if (!base) return [];
  return [base, ...(MUSCLE_ALIASES[base] ?? []).map(normalize)];
}

/**
 * Score de pertinence d'un terme dans un texte (0 = pas de match).
 * Plus le score est élevé, plus le match est "central".
 */
export function matchScore(text: string | null | undefined, terms: string[]): number {
  if (!text) return 0;
  const t = normalize(text);
  let best = 0;

  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i];
    if (!term) continue;
    const idx = t.indexOf(term);
    if (idx < 0) continue;

    let s = 1; // sous-chaîne
    if (t === term) s = 5; // nom identique
    else if (idx === 0) s = 4; // commence par le terme
    else if (/[\s\-/()]/.test(t[idx - 1] ?? '')) s = 3; // début de mot

    // bonus si le mot suivant est un mouvement (ex. "bench press" avant "bench front squat")
    const after = t
      .slice(idx + term.length)
      .replace(/^[\s\-/()]+/, '')
      .split(/[\s\-/()]+/)[0];
    if (after && MOVEMENT_WORDS.has(after)) s += 1.2;

    // léger bonus : match plus tôt dans le nom et nom plus court
    s += Math.max(0, (30 - Math.min(idx, 30)) / 200);
    s += Math.max(0, (40 - Math.min(t.length, 40)) / 200);

    // un alias (i > 0) pèse un peu moins que le terme saisi
    if (i > 0) s *= 0.9;

    if (s > best) best = s;
  }
  return best;
}

export function parseSecondaryMuscles(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export interface ExerciseSection {
  title: string;
  data: Exercise[];
}

interface Ranked {
  exercise: Exercise;
  score: number;
}

function sortByRelevance(a: Ranked, b: Ranked): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.exercise.nom.length !== b.exercise.nom.length) {
    return a.exercise.nom.length - b.exercise.nom.length;
  }
  return a.exercise.nom.localeCompare(b.exercise.nom);
}

/**
 * Regroupe les exercices en sections de pertinence *Principal* / *Secondaire*.
 * Sans recherche, renvoie une seule section avec tout le catalogue.
 */
export function buildExerciseSections(exercises: Exercise[], searchTerm: string): ExerciseSection[] {
  const terms = queryTerms(searchTerm);
  if (terms.length === 0) {
    return [{ title: '', data: exercises }];
  }

  const primary: Ranked[] = [];
  const secondary: Ranked[] = [];

  for (const ex of exercises) {
    const baseName = Math.max(matchScore(ex.nom, terms), matchScore(ex.nom_fr, terms));
    const nameScore = baseName > 0 ? baseName + classicBonus(ex.nom, terms) : 0;
    const targetScore = matchScore(ex.target, terms);
    const categoryScore = matchScore(ex.category, terms);
    // nom > muscle cible > partie du corps
    const primaryScore = Math.max(nameScore * 3, targetScore * 2, categoryScore);

    const secondaryScore = Math.max(
      0,
      ...parseSecondaryMuscles(ex.secondary_muscles).map((m) => matchScore(m, terms))
    );

    if (primaryScore > 0) primary.push({ exercise: ex, score: primaryScore });
    else if (secondaryScore > 0) secondary.push({ exercise: ex, score: secondaryScore });
  }

  primary.sort(sortByRelevance);
  secondary.sort(sortByRelevance);

  const result: ExerciseSection[] = [];
  if (primary.length > 0) {
    result.push({
      title: secondary.length > 0 ? 'Principal' : '',
      data: primary.map((r) => r.exercise),
    });
  }
  if (secondary.length > 0) {
    result.push({ title: 'Secondaire', data: secondary.map((r) => r.exercise) });
  }
  return result;
}
