import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_BAR_WEIGHT, DEFAULT_PLATES } from '../domain/plates';

/**
 * Préférences légères de l'app, stockées en clé/valeur (base séparée de l'app).
 * Pas de schéma à faire évoluer pour ces petits réglages.
 */
const ACTIVE_ACCOUNT_KEY = 'appsportlocal.activeAccountId';
const ACTIVE_GROUP_KEY = 'appsportlocal.activeGroupId';
const HIDDEN_GROUPS_KEY = 'appsportlocal.hiddenGroupIds';

// --- Compte actif -----------------------------------------------------------

/** Compte (profil) actuellement choisi (null = aucun : on montre le choix du compte). */
export async function getActiveAccountId(): Promise<number | null> {
  try {
    const raw = await Storage.getItem(ACTIVE_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setActiveAccountId(id: number | null): Promise<void> {
  if (id === null) {
    await Storage.removeItem(ACTIVE_ACCOUNT_KEY);
  } else {
    await Storage.setItem(ACTIVE_ACCOUNT_KEY, String(id));
  }
}

// --- Groupe actif & groupes masqués (par compte) ----------------------------
// Les données sont séparées par compte : ces préférences sont donc préfixées
// par l'id du compte, pour ne pas mélanger deux profils sur le même appareil.

/** Groupe/split actif choisi sur l'écran Main (null = non choisi). */
export async function getActiveGroupId(accountId: number): Promise<number | null> {
  try {
    const raw = await Storage.getItem(`${ACTIVE_GROUP_KEY}.${accountId}`);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setActiveGroupId(accountId: number, id: number | null): Promise<void> {
  const key = `${ACTIVE_GROUP_KEY}.${accountId}`;
  if (id === null) {
    await Storage.removeItem(key);
  } else {
    await Storage.setItem(key, String(id));
  }
}

/**
 * Groupes retirés de la **page principale** (accueil) : ils ne participent plus à
 * la « séance suivante » et n'apparaissent plus dans le choix du groupe.
 * Ils restent entiers dans l'onglet Séance : rien n'est supprimé de la base.
 */
export async function getHiddenGroupIds(accountId: number): Promise<number[]> {
  try {
    const raw = await Storage.getItem(`${HIDDEN_GROUPS_KEY}.${accountId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === 'number');
  } catch {
    return [];
  }
}

export async function setGroupHidden(
  accountId: number,
  id: number,
  hidden: boolean
): Promise<void> {
  const current = new Set(await getHiddenGroupIds(accountId));
  if (hidden) {
    current.add(id);
  } else {
    current.delete(id);
  }
  await Storage.setItem(`${HIDDEN_GROUPS_KEY}.${accountId}`, JSON.stringify([...current]));
}

// --- Séance en cours (reprise après avoir quitté l'écran) -------------------
// Quitter l'écran d'une séance ne la perd plus : l'avancement est mis de côté
// ici pour pouvoir la reprendre là où on l'a laissée (bulle en bas de l'écran).
// Une seule séance en cours par compte.

/** Une série d'une séance en cours, telle qu'elle doit être reprise. */
export interface WorkoutDraftSet {
  weight: number;
  reps: number;
  /** Durée d'effort réalisée (endurance), en secondes. Absent sur un ancien brouillon. */
  duration_sec?: number;
  completed: boolean;
}

export interface WorkoutDraftExercise {
  workout_exo_id: number;
  sets: WorkoutDraftSet[];
}

/** Séance mise de côté : avancement des séries + chrono déjà écoulé. */
export interface WorkoutDraft {
  program_id: number;
  /** Nom de la séance (affiché dans la bulle de reprise). */
  nom: string;
  /** Secondes déjà passées à s'entraîner : le chrono reprend, il ne repart pas de zéro. */
  elapsed_sec: number;
  exercises: WorkoutDraftExercise[];
}

const WORKOUT_DRAFT_KEY = 'appsportlocal.workoutDraft';

/** Vérifie la forme d'un brouillon relu (le stockage peut dater d'une version antérieure). */
function isWorkoutDraft(value: unknown): value is WorkoutDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  if (typeof draft.program_id !== 'number') return false;
  if (typeof draft.nom !== 'string') return false;
  if (typeof draft.elapsed_sec !== 'number') return false;
  if (!Array.isArray(draft.exercises)) return false;
  return draft.exercises.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const exercise = entry as Record<string, unknown>;
    return typeof exercise.workout_exo_id === 'number' && Array.isArray(exercise.sets);
  });
}

/** Séance en cours du compte (null = aucune). */
export async function getWorkoutDraft(accountId: number): Promise<WorkoutDraft | null> {
  try {
    const raw = await Storage.getItem(`${WORKOUT_DRAFT_KEY}.${accountId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isWorkoutDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setWorkoutDraft(accountId: number, draft: WorkoutDraft): Promise<void> {
  await Storage.setItem(`${WORKOUT_DRAFT_KEY}.${accountId}`, JSON.stringify(draft));
}

export async function clearWorkoutDraft(accountId: number): Promise<void> {
  await Storage.removeItem(`${WORKOUT_DRAFT_KEY}.${accountId}`);
}

// --- Barre & disques (calculateur de chargement) ----------------------------

const BAR_WEIGHT_KEY = 'appsportlocal.barWeight';
const CUSTOM_BARS_KEY = 'appsportlocal.customBars';
const ENABLED_PLATES_KEY = 'appsportlocal.enabledPlates';
const CUSTOM_PLATES_KEY = 'appsportlocal.customPlates';

async function readNumber(key: string, fallback: number): Promise<number> {
  try {
    const raw = await Storage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function readNumberList(key: string, fallback: readonly number[]): Promise<number[]> {
  try {
    const raw = await Storage.getItem(key);
    if (!raw) return [...fallback];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...fallback];
    return parsed.filter((value): value is number => typeof value === 'number' && value > 0);
  } catch {
    return [...fallback];
  }
}

async function writeNumberList(key: string, values: number[]): Promise<void> {
  await Storage.setItem(key, JSON.stringify(values));
}

/** Poids de la barre utilisée pour le calcul du chargement (kg). */
export function getBarWeight(): Promise<number> {
  return readNumber(BAR_WEIGHT_KEY, DEFAULT_BAR_WEIGHT);
}

export async function setBarWeight(value: number): Promise<void> {
  await Storage.setItem(BAR_WEIGHT_KEY, String(value));
}

/** Barres personnalisées ajoutées par l'utilisateur (kg). */
export function getCustomBars(): Promise<number[]> {
  return readNumberList(CUSTOM_BARS_KEY, []);
}

export async function setCustomBars(values: number[]): Promise<void> {
  await writeNumberList(CUSTOM_BARS_KEY, values);
}

/** Disques disponibles (cochés) utilisés par le calcul, par défaut la liste standard. */
export function getEnabledPlates(): Promise<number[]> {
  return readNumberList(ENABLED_PLATES_KEY, DEFAULT_PLATES);
}

export async function setEnabledPlates(values: number[]): Promise<void> {
  await writeNumberList(ENABLED_PLATES_KEY, values);
}

/** Disques personnalisés ajoutés par l'utilisateur (kg). */
export function getCustomPlates(): Promise<number[]> {
  return readNumberList(CUSTOM_PLATES_KEY, []);
}

export async function setCustomPlates(values: number[]): Promise<void> {
  await writeNumberList(CUSTOM_PLATES_KEY, values);
}

/**
 * Efface **toutes** les préférences locales : compte actif, groupes actifs/masqués,
 * séance en cours, barres et disques personnalisés. Appelé par « Réinitialiser
 * toutes les données », en complément du vidage de la base (voir `resetAppData`).
 */
export async function clearAllPreferences(): Promise<void> {
  await Storage.clear();
}
