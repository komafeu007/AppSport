import * as SQLite from 'expo-sqlite';

import seedData from '../data/exercises.seed.json';

export const DATABASE_NAME = 'appsportlocal.db';

/** Incrémenter à chaque évolution du schéma et ajouter la migration correspondante. */
const DATABASE_VERSION = 3;

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

CREATE TABLE IF NOT EXISTS PROGRAMS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    nom_seance TEXT NOT NULL,
    ordre INTEGER,
    FOREIGN KEY(account_id) REFERENCES ACCOUNTS(id)
);

CREATE TABLE IF NOT EXISTS WORKOUT_EXOS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER,
    exercise_id INTEGER,
    series INTEGER,
    reps INTEGER,
    rest_time INTEGER,
    target_weight REAL,
    FOREIGN KEY(program_id) REFERENCES PROGRAMS(id),
    FOREIGN KEY(exercise_id) REFERENCES EXERCISES(id)
);

CREATE TABLE IF NOT EXISTS LOGS_SESSION (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
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

  if (version >= 1) {
    // Schémas EXERCISES antérieurs (v1/v2) -> on reconstruit la table enrichie.
    await db.execAsync('PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS EXERCISES;');
  }

  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await db.execAsync(SCHEMA_SQL);
  await seedExercises(db);

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
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
