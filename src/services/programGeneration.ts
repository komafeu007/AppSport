/**
 * Génération de programme côté application : lit le profil, le catalogue et
 * l'historique en base, appelle le **générateur pur** (`src/domain/programGenerator.ts`)
 * puis écrit le résultat sous forme de groupe de séances + séances.
 *
 * Un programme généré ouvre un **bloc** de 8 semaines : `SESSION_GROUPS.bloc_debut`
 * + `bloc_semaines` permettent de proposer un changement au bout du cycle — et ce
 * changement reste à valider par l'utilisateur depuis l'aperçu.
 */

import type * as SQLite from 'expo-sqlite';

import { DEFAULT_NIVEAU, parseKeyList } from '../domain/profile';
import {
  generateProgram,
  rerollPlannedExercise,
  type GeneratedProgram,
  type GeneratorProfile,
  type PlannedExercise,
  type PlannedSession,
} from '../domain/programGenerator';
import {
  createSessionGroup,
  getAllExercises,
  getLastReferenceWeights,
  getRecentExerciseIds,
  countSessionsSince,
  saveProgram,
  type Account,
  type SessionGroup,
} from './database';
import { setActiveGroupId } from './preferences';

/** Durée d'un bloc d'entraînement généré, en semaines. */
export const BLOCK_WEEKS = 8;

/** Nombre de séances récentes consultées pour éviter de reproposer les mêmes exercices. */
const RECENT_SESSIONS = 6;

/** Nouvelle graine : chaque « Régénérer » change les variantes, pas la structure. */
export function newSeed(): number {
  return Math.floor(Date.now() % 2147483647);
}

/** Profil du générateur à partir d'une ligne `ACCOUNTS`. */
export function generatorProfileFromAccount(account: Account): GeneratorProfile {
  return {
    objectif: account.objectif,
    niveau: account.niveau ?? DEFAULT_NIVEAU,
    sessionsPerWeek: account.sessions_per_week,
    dureeSeance: account.duree_seance,
    format: account.format_seance,
    materiel: parseKeyList(account.materiel),
    zonesDouloureuses: parseKeyList(account.douleurs_zones),
  };
}

/** Longueur du bloc d'entraînement d'un groupe (null si le groupe n'est pas un bloc généré). */
export function blockWeeks(group: SessionGroup): number | null {
  if (!group.bloc_debut) return null;
  return group.bloc_semaines ?? BLOCK_WEEKS;
}

/**
 * Construit un programme pour un compte : catalogue complet + exercices récents
 * (variété) + profil. Ne touche pas à la base.
 */
export async function buildPlan(
  db: SQLite.SQLiteDatabase,
  account: Account,
  seed: number
): Promise<GeneratedProgram> {
  const [catalog, recentIds] = await Promise.all([
    getAllExercises(db),
    account.id ? getRecentExerciseIds(db, account.id, RECENT_SESSIONS) : Promise.resolve([]),
  ]);

  return generateProgram({
    profile: generatorProfileFromAccount(account),
    catalog,
    recentExerciseIds: recentIds,
    seed,
  });
}

/**
 * « Relancer » un exercice de l'aperçu (Module 2) : propose une autre variante du
 * même groupe musculaire, sans toucher au reste du programme. Le catalogue et
 * l'historique sont relus en base, comme à la génération. Renvoie `null` si le
 * catalogue n'offre pas d'autre option.
 */
export async function rerollExercise(
  db: SQLite.SQLiteDatabase,
  account: Account,
  plan: GeneratedProgram,
  sessionIndex: number,
  exerciseIndex: number
): Promise<PlannedExercise | null> {
  const session = plan.sessions[sessionIndex];
  if (!session) return null;

  const [catalog, recentIds] = await Promise.all([
    getAllExercises(db),
    account.id ? getRecentExerciseIds(db, account.id, RECENT_SESSIONS) : Promise.resolve([]),
  ]);

  return rerollPlannedExercise({
    profile: generatorProfileFromAccount(account),
    catalog,
    recentExerciseIds: recentIds,
    format: plan.format,
    sessionExercises: session.exercises,
    targetIndex: exerciseIndex,
    seed: newSeed(),
  });
}

/** Enregistre un programme généré : nouveau groupe (avec son bloc) + ses séances. */
export async function savePlan(
  db: SQLite.SQLiteDatabase,
  accountId: number,
  plan: GeneratedProgram,
  /** Nom du groupe si l'utilisateur l'a retouché. */
  nomGroupe: string = plan.nomGroupe
): Promise<number> {
  const weights = await getLastReferenceWeights(db, accountId);
  const debut = new Date().toISOString();
  const groupId = await createSessionGroup(db, accountId, nomGroupe, {
    debut,
    semaines: BLOCK_WEEKS,
  });

  for (const session of plan.sessions) {
    await saveProgram(db, {
      account_id: accountId,
      nom_seance: session.nom,
      group_id: groupId,
      exercises: session.exercises.map((planned) => ({
        exercise_id: planned.exercise.id,
        series: planned.series,
        reps_min: planned.repsMin,
        reps_max: planned.repsMax,
        duration_sec: null,
        rest_time: planned.restTime,
        // Charge de départ reprise de la dernière séance sur cet exercice.
        target_weight: weights.get(planned.exercise.id) ?? 0,
        set_weights: null,
        superset_group: null,
      })),
    });
  }

  // Le nouveau programme devient le programme actif de l'accueil : l'app est
  // utilisable tout de suite après la génération.
  await setActiveGroupId(accountId, groupId);

  return groupId;
}
/** État d'avancement du bloc généré en cours. */
export interface BlockStatus {
  group: SessionGroup;
  /** Semaines prévues pour le bloc. */
  weeks: number;
  /** Semaines écoulées depuis le début du bloc (arrondi au jour). */
  elapsedWeeks: number;
  /** Séances faites depuis le début du bloc. */
  sessionsDone: number;
  /** Nombre de séances attendues d'ici la fin du bloc (fréquence × semaines). */
  sessionsPlanned: number | null;
  /** true quand le bloc arrive à son terme : on propose un nouveau programme. */
  due: boolean;
}

/** Bloc généré en cours (le plus récent), avec son avancement. */
export async function getBlockStatus(
  db: SQLite.SQLiteDatabase,
  account: Account
): Promise<BlockStatus | null> {
  const rows = await db.getAllAsync<SessionGroup>(
    `SELECT * FROM SESSION_GROUPS
      WHERE account_id = ? AND bloc_debut IS NOT NULL
      ORDER BY bloc_debut DESC, id DESC
      LIMIT 1`,
    account.id
  );
  const group = rows[0];
  const weeks = blockWeeks(group);
  if (!group || !group.bloc_debut || weeks === null) return null;

  const started = new Date(group.bloc_debut).getTime();
  const elapsedMs = Number.isNaN(started) ? 0 : Date.now() - started;
  const elapsedWeeks = Math.max(0, Math.floor(elapsedMs / (7 * 24 * 3600 * 1000)));
  const sessionsDone = await countSessionsSince(db, account.id, group.bloc_debut);

  return {
    group,
    weeks,
    elapsedWeeks,
    sessionsDone,
    sessionsPlanned: account.sessions_per_week ? account.sessions_per_week * weeks : null,
    due: elapsedWeeks >= weeks,
  };
}

/** Résumé chiffré d'une séance planifiée, pour l'aperçu. */
export function sessionSummary(session: PlannedSession): {
  exercises: number;
  sets: number;
  minutes: number;
} {
  return {
    exercises: session.exercises.length,
    sets: session.exercises.reduce((total, planned) => total + planned.series, 0),
    minutes: session.estimatedMinutes,
  };
}
