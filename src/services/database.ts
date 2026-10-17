import * as SQLite from 'expo-sqlite';

import seedData from '../data/exercises.seed.json';

export const DATABASE_NAME = 'appsportlocal.db';

/** Incrémenter à chaque évolution du schéma et ajouter la migration correspondante. */
const DATABASE_VERSION = 7;

export interface Exercise {
  id: number;
  /** Nom anglais (source : dataset hasaneyldrm/exercises-dataset). */
  nom: string;
  /** Nom français (traduction best-effort, générée — voir src/data/exercises.seed.json). */
  nom_fr: string | null;
  muscle_group: string;
  /** Muscle principal visé (dataset `target`). */
  target: string | null;
  /** Muscles secondaires, encodés en JSON (ex. '["triceps","shoulders"]'). */
  secondary_muscles: string | null;
  /** 1 = polyarticulaire, 0 = monoarticulaire. Classification heuristique. */
  is_poly: number;
  /** Partie du corps (dataset `category` : chest, back, upper legs…). */
  category: string | null;
  equipment: string | null;
  /** Nom de fichier de la vignette locale (clé de `exerciseImages`). */
  image: string | null;
  /** Instructions détaillées en français (dataset `instructions.fr`). */
  instructions_fr: string | null;
}

export type NewExercise = Omit<Exercise, 'id'>;

/** Un groupe/split de séances (ex. « PPL », « Maison », « Upper/Lower »). */
export interface SessionGroup {
  id: number;
  account_id: number | null;
  nom: string;
  ordre: number | null;
}

/** Une séance du programme (table PROGRAMS). */
export interface Program {
  id: number;
  account_id: number | null;
  nom_seance: string;
  ordre: number | null;
  /** Groupe/split auquel la séance appartient (null = sans groupe). */
  group_id: number | null;
}

/** Séance + nombre d'exercices, pour l'écran de liste. */
export interface ProgramSummary extends Program {
  exercise_count: number;
}

/** Exercice rattaché à une séance (table WORKOUT_EXOS). */
export interface WorkoutExo {
  id: number;
  program_id: number | null;
  exercise_id: number | null;
  series: number | null;
  /** Reps minimum (point de départ de la double progression). */
  reps_min: number | null;
  /** Reps maximum (au-delà, on monte le poids et on redescend au min). */
  reps_max: number | null;
  /** Repos après la série, en secondes. */
  rest_time: number | null;
  /** Poids cible « de base », en kg. */
  target_weight: number | null;
  /** Poids par série (dégressif), encodé en JSON (ex. '[100,90,80]'). null = poids uniforme. */
  set_weights: string | null;
}

/** Exercice de séance joint à sa fiche catalogue (pour l'affichage / l'édition). */
export interface ProgramExercise extends WorkoutExo {
  nom: string;
  nom_fr: string | null;
  muscle_group: string;
  target: string | null;
  secondary_muscles: string | null;
  is_poly: number;
  category: string | null;
  equipment: string | null;
  image: string | null;
  instructions_fr: string | null;
}

/** Reconstruit une fiche `Exercise` depuis une ligne jointe de séance. */
export function programExerciseToExercise(row: ProgramExercise): Exercise {
  return {
    id: row.exercise_id ?? 0,
    nom: row.nom,
    nom_fr: row.nom_fr,
    muscle_group: row.muscle_group,
    target: row.target,
    secondary_muscles: row.secondary_muscles,
    is_poly: row.is_poly,
    category: row.category,
    equipment: row.equipment,
    image: row.image,
    instructions_fr: row.instructions_fr,
  };
}

/**
 * Schéma identique à docs/SCHEMA.sql (source de vérité).
 * Toute évolution doit être reportée dans ce fichier ET dans docs/SCHEMA.sql.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ACCOUNTS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom TEXT NOT NULL,
    age INTEGER,
    poids REAL,
    taille REAL,
    objectif TEXT
);

CREATE TABLE IF NOT EXISTS EXERCISES (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    nom_fr TEXT,
    muscle_group TEXT NOT NULL,
    target TEXT,
    secondary_muscles TEXT,
    is_poly INTEGER NOT NULL,
    category TEXT,
    equipment TEXT,
    image TEXT,
    instructions_fr TEXT
);

CREATE TABLE IF NOT EXISTS SESSION_GROUPS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    nom TEXT NOT NULL,
    ordre INTEGER,
    FOREIGN KEY(account_id) REFERENCES ACCOUNTS(id)
);

CREATE TABLE IF NOT EXISTS PROGRAMS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    nom_seance TEXT NOT NULL,
    ordre INTEGER,
    group_id INTEGER,
    FOREIGN KEY(account_id) REFERENCES ACCOUNTS(id),
    FOREIGN KEY(group_id) REFERENCES SESSION_GROUPS(id)
);

CREATE TABLE IF NOT EXISTS WORKOUT_EXOS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER,
    exercise_id INTEGER,
    series INTEGER,
    reps_min INTEGER,
    reps_max INTEGER,
    rest_time INTEGER,
    target_weight REAL,
    set_weights TEXT,
    FOREIGN KEY(program_id) REFERENCES PROGRAMS(id),
    FOREIGN KEY(exercise_id) REFERENCES EXERCISES(id)
);

CREATE TABLE IF NOT EXISTS LOGS_SESSION (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    program_id INTEGER,
    date TEXT NOT NULL,
    duration_sec INTEGER,
    total_volume REAL,
    avg_hr INTEGER,
    FOREIGN KEY(account_id) REFERENCES ACCOUNTS(id)
);

CREATE TABLE IF NOT EXISTS LOGS_SETS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    exercise_id INTEGER,
    set_num INTEGER,
    weight REAL,
    reps INTEGER,
    completed INTEGER,
    FOREIGN KEY(session_id) REFERENCES LOGS_SESSION(id),
    FOREIGN KEY(exercise_id) REFERENCES EXERCISES(id)
);
`;

/**
 * Catalogue complet importé depuis le dataset hasaneyldrm/exercises-dataset
 * (1 324 exercices). `is_poly` et `nom_fr` sont dérivés automatiquement.
 */
export const SEED_EXERCISES = seedData as NewExercise[];

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Ouvre (une seule fois) la base locale. À utiliser hors arbre React ;
 * dans les composants, préférer `useSQLiteContext()` fourni par `SQLiteProvider`.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return databasePromise;
}

/**
 * Crée les tables et injecte le catalogue d'exercices si nécessaire.
 * Conçue pour être passée à `<SQLiteProvider onInit={migrateDbIfNeeded}>`.
 */
export async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version >= DATABASE_VERSION) {
    return;
  }

  if (version >= 1 && version < 3) {
    // Schémas EXERCISES antérieurs (v1/v2) -> on reconstruit la table enrichie.
    await db.execAsync('PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS EXERCISES;');
  }

  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await db.execAsync(SCHEMA_SQL);
  await seedExercises(db);
  await ensureWorkoutExosColumns(db);
  await ensureProgramsColumns(db);
  await ensureLogsSessionColumns(db);

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

/** Ajoute `LOGS_SESSION.program_id` (v7 : séance enregistrée -> programme lancé). */
async function ensureLogsSessionColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(LOGS_SESSION)');
  if (columns.length === 0) return;

  const names = new Set(columns.map((column) => column.name));
  if (!names.has('program_id')) {
    await db.execAsync('ALTER TABLE LOGS_SESSION ADD COLUMN program_id INTEGER');
  }
}

/** Ajoute `PROGRAMS.group_id` (v6 : rangement des séances par groupe/split). */
async function ensureProgramsColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(PROGRAMS)');
  if (columns.length === 0) return;

  const names = new Set(columns.map((column) => column.name));
  if (!names.has('group_id')) {
    await db.execAsync('ALTER TABLE PROGRAMS ADD COLUMN group_id INTEGER');
  }
}

/**
 * Migrations additives de WORKOUT_EXOS (v3 -> v5) :
 * - v4 : bornes de reps `reps_min`/`reps_max` (double progression).
 * - v5 : `set_weights` (poids par série, dégressif), stocké en JSON.
 * Idempotent : ne fait rien sur une base neuve (colonnes déjà présentes).
 */
async function ensureWorkoutExosColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(WORKOUT_EXOS)');
  if (columns.length === 0) return; // table absente (créée par SCHEMA_SQL sinon)

  const names = new Set(columns.map((column) => column.name));

  if (!names.has('reps_min')) {
    await db.execAsync('ALTER TABLE WORKOUT_EXOS ADD COLUMN reps_min INTEGER');
  }
  if (!names.has('reps_max')) {
    await db.execAsync('ALTER TABLE WORKOUT_EXOS ADD COLUMN reps_max INTEGER');
  }
  if (!names.has('set_weights')) {
    await db.execAsync('ALTER TABLE WORKOUT_EXOS ADD COLUMN set_weights TEXT');
  }

  // Reprend l'ancienne valeur unique `reps` (v3) comme borne unique, si présente.
  if (names.has('reps')) {
    await db.execAsync(
      `UPDATE WORKOUT_EXOS
          SET reps_min = COALESCE(reps_min, reps),
              reps_max = COALESCE(reps_max, reps)
        WHERE reps IS NOT NULL`
    );
    try {
      await db.execAsync('ALTER TABLE WORKOUT_EXOS DROP COLUMN reps');
    } catch {
      // SQLite ancien : on laisse la colonne héritée, désormais inutilisée.
    }
  }
}

/** Ouvre la base et applique les migrations. Point d'entrée impératif du service. */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDatabase();
  await migrateDbIfNeeded(db);
  return db;
}

async function seedExercises(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM EXERCISES');
  if ((row?.count ?? 0) > 0) {
    return;
  }

  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      `INSERT INTO EXERCISES
         (nom, nom_fr, muscle_group, target, secondary_muscles, is_poly, category, equipment, image, instructions_fr)
       VALUES ($nom, $nom_fr, $muscle_group, $target, $secondary_muscles, $is_poly, $category, $equipment, $image, $instructions_fr)`
    );
    try {
      for (const exercise of SEED_EXERCISES) {
        await statement.executeAsync({
          $nom: exercise.nom,
          $nom_fr: exercise.nom_fr,
          $muscle_group: exercise.muscle_group,
          $target: exercise.target,
          $secondary_muscles: exercise.secondary_muscles,
          $is_poly: exercise.is_poly,
          $category: exercise.category,
          $equipment: exercise.equipment,
          $image: exercise.image,
          $instructions_fr: exercise.instructions_fr,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

export function getAllExercises(db: SQLite.SQLiteDatabase): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>('SELECT * FROM EXERCISES ORDER BY category, nom');
}

export function getExercisesByMuscleGroup(
  db: SQLite.SQLiteDatabase,
  muscleGroup: string
): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(
    'SELECT * FROM EXERCISES WHERE muscle_group = ? ORDER BY nom',
    muscleGroup
  );
}

export function searchExercises(db: SQLite.SQLiteDatabase, query: string): Promise<Exercise[]> {
  const term = `%${query}%`;
  return db.getAllAsync<Exercise>(
    'SELECT * FROM EXERCISES WHERE nom LIKE ? OR nom_fr LIKE ? ORDER BY nom LIMIT 100',
    term,
    term
  );
}

export function getExerciseById(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>('SELECT * FROM EXERCISES WHERE id = ?', id);
}

export interface DatabaseInfo {
  sqliteVersion: string;
  schemaVersion: number;
  exerciseCount: number;
}

/** Diagnostic affiché dans l'app pour vérifier que la base est opérationnelle. */
export async function getDatabaseInfo(db: SQLite.SQLiteDatabase): Promise<DatabaseInfo> {
  const versionRow = await db.getFirstAsync<{ 'sqlite_version()': string }>(
    'SELECT sqlite_version()'
  );
  const userRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM EXERCISES'
  );
  return {
    sqliteVersion: versionRow?.['sqlite_version()'] ?? '?',
    schemaVersion: userRow?.user_version ?? 0,
    exerciseCount: countRow?.count ?? 0,
  };
}

export async function insertExercise(
  db: SQLite.SQLiteDatabase,
  exercise: NewExercise
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO EXERCISES
       (nom, nom_fr, muscle_group, target, secondary_muscles, is_poly, category, equipment, image, instructions_fr)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    exercise.nom,
    exercise.nom_fr,
    exercise.muscle_group,
    exercise.target,
    exercise.secondary_muscles,
    exercise.is_poly,
    exercise.category,
    exercise.equipment,
    exercise.image,
    exercise.instructions_fr
  );
  return result.lastInsertRowId;
}

// --- Séances (PROGRAMS + WORKOUT_EXOS) ------------------------------------

/** Séances triées de la plus récente à la plus ancienne, avec le nombre d'exercices. */
export function getPrograms(db: SQLite.SQLiteDatabase): Promise<ProgramSummary[]> {
  return db.getAllAsync<ProgramSummary>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM WORKOUT_EXOS we WHERE we.program_id = p.id) AS exercise_count
       FROM PROGRAMS p
      ORDER BY p.id DESC`
  );
}

export function getProgram(db: SQLite.SQLiteDatabase, id: number): Promise<Program | null> {
  return db.getFirstAsync<Program>('SELECT * FROM PROGRAMS WHERE id = ?', id);
}

/** Exercices d'une séance, joints à leur fiche catalogue, dans l'ordre d'ajout. */
export function getProgramExercises(
  db: SQLite.SQLiteDatabase,
  programId: number
): Promise<ProgramExercise[]> {
  return db.getAllAsync<ProgramExercise>(
    `SELECT we.id, we.program_id, we.exercise_id, we.series, we.reps_min, we.reps_max,
            we.rest_time, we.target_weight, we.set_weights,
            e.nom, e.nom_fr, e.muscle_group, e.target, e.secondary_muscles, e.is_poly,
            e.category, e.equipment, e.image, e.instructions_fr
       FROM WORKOUT_EXOS we
       JOIN EXERCISES e ON e.id = we.exercise_id
      WHERE we.program_id = ?
      ORDER BY we.id`,
    programId
  );
}

export interface SaveProgramExercise {
  exercise_id: number;
  series: number;
  reps_min: number;
  reps_max: number;
  rest_time: number;
  target_weight: number;
  /** Poids par série (dégressif) ; null = poids uniforme (target_weight). */
  set_weights: number[] | null;
}

export interface SaveProgramInput {
  /** Absent = création ; sinon mise à jour de la séance existante. */
  id?: number;
  nom_seance: string;
  /** Groupe/split d'appartenance (null = sans groupe). */
  group_id: number | null;
  exercises: SaveProgramExercise[];
}

/**
 * Crée ou remplace une séance et ses exercices dans une seule transaction.
 * En mise à jour, les exercices existants sont remplacés par la nouvelle liste.
 * Renvoie l'id de la séance.
 */
export async function saveProgram(
  db: SQLite.SQLiteDatabase,
  input: SaveProgramInput
): Promise<number> {
  let programId = input.id;

  await db.withTransactionAsync(async () => {
    if (programId == null) {
      const result = await db.runAsync(
        'INSERT INTO PROGRAMS (account_id, nom_seance, ordre, group_id) VALUES (?, ?, ?, ?)',
        null,
        input.nom_seance,
        null,
        input.group_id
      );
      programId = result.lastInsertRowId;
    } else {
      await db.runAsync(
        'UPDATE PROGRAMS SET nom_seance = ?, group_id = ? WHERE id = ?',
        input.nom_seance,
        input.group_id,
        programId
      );
      await db.runAsync('DELETE FROM WORKOUT_EXOS WHERE program_id = ?', programId);
    }

    if (input.exercises.length === 0) return;

    const programIdValue = programId as number;
    const statement = await db.prepareAsync(
      `INSERT INTO WORKOUT_EXOS
         (program_id, exercise_id, series, reps_min, reps_max, rest_time, target_weight, set_weights)
       VALUES ($program_id, $exercise_id, $series, $reps_min, $reps_max, $rest_time, $target_weight, $set_weights)`
    );
    try {
      for (const ex of input.exercises) {
        await statement.executeAsync({
          $program_id: programIdValue,
          $exercise_id: ex.exercise_id,
          $series: ex.series,
          $reps_min: ex.reps_min,
          $reps_max: ex.reps_max,
          $rest_time: ex.rest_time,
          $target_weight: ex.target_weight,
          $set_weights: ex.set_weights ? JSON.stringify(ex.set_weights) : null,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });

  return programId as number;
}

/** Supprime une séance et ses exercices. */
export async function deleteProgram(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM WORKOUT_EXOS WHERE program_id = ?', id);
    await db.runAsync('DELETE FROM PROGRAMS WHERE id = ?', id);
  });
}

/**
 * Prochaine séance d'un groupe : celle qui suit la dernière séance enregistrée
 * (bouclage en fin de cycle). Renvoie la première si aucune séance faite.
 */
export async function getNextProgramInGroup(
  db: SQLite.SQLiteDatabase,
  groupId: number
): Promise<ProgramSummary | null> {
  const programs = await db.getAllAsync<ProgramSummary>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM WORKOUT_EXOS we WHERE we.program_id = p.id) AS exercise_count
       FROM PROGRAMS p
      WHERE p.group_id = ?
      ORDER BY p.id`,
    groupId
  );
  if (programs.length === 0) return null;

  const last = await db.getFirstAsync<{ program_id: number }>(
    `SELECT ls.program_id
       FROM LOGS_SESSION ls
       JOIN PROGRAMS p ON p.id = ls.program_id
      WHERE p.group_id = ?
      ORDER BY ls.id DESC
      LIMIT 1`,
    groupId
  );

  if (last?.program_id == null) return programs[0];
  const index = programs.findIndex((program) => program.id === last.program_id);
  if (index < 0) return programs[0];
  return programs[(index + 1) % programs.length];
}

// --- Groupes / splits de séances (SESSION_GROUPS) --------------------------

export function getSessionGroups(db: SQLite.SQLiteDatabase): Promise<SessionGroup[]> {
  return db.getAllAsync<SessionGroup>('SELECT * FROM SESSION_GROUPS ORDER BY ordre, id');
}

export async function createSessionGroup(
  db: SQLite.SQLiteDatabase,
  nom: string
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO SESSION_GROUPS (account_id, nom, ordre) VALUES (?, ?, ?)',
    null,
    nom,
    null
  );
  return result.lastInsertRowId;
}

export function renameSessionGroup(
  db: SQLite.SQLiteDatabase,
  id: number,
  nom: string
): Promise<unknown> {
  return db.runAsync('UPDATE SESSION_GROUPS SET nom = ? WHERE id = ?', nom, id);
}

/** Supprime un groupe ET toutes ses séances (avec leurs exercices). */
export async function deleteSessionGroup(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM WORKOUT_EXOS WHERE program_id IN (SELECT id FROM PROGRAMS WHERE group_id = ?)',
      id
    );
    await db.runAsync('DELETE FROM PROGRAMS WHERE group_id = ?', id);
    await db.runAsync('DELETE FROM SESSION_GROUPS WHERE id = ?', id);
  });
}

/** true si au moins une séance a déjà été enregistrée (journal LOGS_SESSION). */
export async function hasCompletedSessions(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM LOGS_SESSION'
  );
  return (row?.count ?? 0) > 0;
}

// --- Séance en cours (Live Workout) : journalisation ------------------------

export interface SaveWorkoutSet {
  exercise_id: number;
  set_num: number;
  weight: number;
  reps: number;
  completed: boolean;
}

/**
 * Poids du plan mis à jour (le poids « bouge » d'une séance à l'autre).
 * Le **nombre de séries n'est jamais enregistré** : on ne touche pas à `series`.
 */
export interface SaveWorkoutPlan {
  workout_exo_id: number;
  target_weight: number;
  set_weights: number[] | null;
}

export interface SaveWorkoutSessionInput {
  program_id: number;
  account_id?: number | null;
  /** Date ISO de fin de séance. */
  date: string;
  duration_sec: number;
  total_volume: number;
  sets: SaveWorkoutSet[];
  plans: SaveWorkoutPlan[];
}

/**
 * Enregistre une séance terminée dans une transaction :
 * - une ligne LOGS_SESSION (rattachée au programme) ;
 * - une ligne LOGS_SETS par série réalisée ;
 * - la mise à jour du **poids** de chaque exercice (jamais le nombre de séries).
 */
export async function saveWorkoutSession(
  db: SQLite.SQLiteDatabase,
  input: SaveWorkoutSessionInput
): Promise<number> {
  let sessionId = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO LOGS_SESSION (account_id, program_id, date, duration_sec, total_volume, avg_hr)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.account_id ?? null,
      input.program_id,
      input.date,
      input.duration_sec,
      input.total_volume,
      null
    );
    sessionId = result.lastInsertRowId;

    if (input.sets.length > 0) {
      const statement = await db.prepareAsync(
        `INSERT INTO LOGS_SETS (session_id, exercise_id, set_num, weight, reps, completed)
         VALUES ($session_id, $exercise_id, $set_num, $weight, $reps, $completed)`
      );
      try {
        for (const set of input.sets) {
          await statement.executeAsync({
            $session_id: sessionId,
            $exercise_id: set.exercise_id,
            $set_num: set.set_num,
            $weight: set.weight,
            $reps: set.reps,
            $completed: set.completed ? 1 : 0,
          });
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    for (const plan of input.plans) {
      await db.runAsync(
        'UPDATE WORKOUT_EXOS SET target_weight = ?, set_weights = ? WHERE id = ?',
        plan.target_weight,
        plan.set_weights ? JSON.stringify(plan.set_weights) : null,
        plan.workout_exo_id
      );
    }
  });

  return sessionId;
}

/**
 * Sauvegarde « inter-séance » du seul **poids** (sans journaliser) : appelée en
 * cours de séance pour que les poids se reportent même sans terminer.
 */
export async function saveWorkoutPlan(
  db: SQLite.SQLiteDatabase,
  plans: SaveWorkoutPlan[]
): Promise<void> {
  if (plans.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const plan of plans) {
      await db.runAsync(
        'UPDATE WORKOUT_EXOS SET target_weight = ?, set_weights = ? WHERE id = ?',
        plan.target_weight,
        plan.set_weights ? JSON.stringify(plan.set_weights) : null,
        plan.workout_exo_id
      );
    }
  });
}

export interface PreviousSet {
  set_num: number;
  weight: number;
  reps: number;
}

/**
 * Séries de la **dernière fois où cette séance** a été faite, pour servir de
 * référence. Tant que la séance n'a jamais été faite, la liste est vide : le
 * poids courant reste alors celui défini dans l'éditeur (le plan).
 */
export function getLastSetsForExercise(
  db: SQLite.SQLiteDatabase,
  programId: number,
  exerciseId: number
): Promise<PreviousSet[]> {
  return db.getAllAsync<PreviousSet>(
    `SELECT ls.set_num AS set_num, ls.weight AS weight, ls.reps AS reps
       FROM LOGS_SETS ls
       JOIN LOGS_SESSION s ON s.id = ls.session_id
      WHERE ls.exercise_id = ?
        AND s.program_id = ?
        AND ls.session_id = (
          SELECT ls2.session_id
            FROM LOGS_SETS ls2
            JOIN LOGS_SESSION s2 ON s2.id = ls2.session_id
           WHERE ls2.exercise_id = ? AND s2.program_id = ?
           ORDER BY ls2.session_id DESC
           LIMIT 1
        )
      ORDER BY ls.set_num`,
    exerciseId,
    programId,
    exerciseId,
    programId
  );
}
