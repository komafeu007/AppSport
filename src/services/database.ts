import * as SQLite from 'expo-sqlite';

import seedData from '../data/exercises.seed.json';
import { joinKeyList } from '../domain/profile';

export const DATABASE_NAME = 'appsportlocal.db';

/** Incrémenter à chaque évolution du schéma et ajouter la migration correspondante. */
const DATABASE_VERSION = 12;

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
  /** Date ISO du début du bloc d'entraînement (groupes générés ; null = manuel). */
  bloc_debut: string | null;
  /** Durée du bloc en semaines (8 par défaut ; null = pas de cycle). */
  bloc_semaines: number | null;
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
  /** Durée d'effort par série (exercices d'endurance), en secondes ; null sinon. */
  duration_sec: number | null;
  /** Repos après la série, en secondes. */
  rest_time: number | null;
  /** Poids cible « de base », en kg. */
  target_weight: number | null;
  /** Poids par série (dégressif), encodé en JSON (ex. '[100,90,80]'). null = poids uniforme. */
  set_weights: string | null;
  /**
   * Superset : les exercices consécutifs partageant la même valeur forment un
   * bloc (pas de repos entre eux, repos seulement après le dernier). null = seul.
   */
  superset_group: number | null;
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
    objectif TEXT,
    niveau TEXT,               -- niveau d'expérience (debutant, intermediaire, avance) — v10
    points_forts TEXT,         -- points forts à limiter, tableau JSON de clés — v12
    points_faibles TEXT,       -- points faibles à prioriser, tableau JSON de clés — v12
    douleurs_zones TEXT,       -- zones sensibles, tableau JSON de clés
    douleurs_note TEXT,        -- précision libre sur les douleurs
    sessions_per_week INTEGER, -- nb d'entraînements par semaine visé
    materiel TEXT,             -- matériel dispo, tableau JSON de clés
    format_seance TEXT,        -- format de séance choisi (clé)
    duree_seance INTEGER       -- durée visée d'une séance, en minutes
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
    bloc_debut TEXT,           -- début du bloc d'entraînement (programme généré) — v10
    bloc_semaines INTEGER,     -- durée du bloc en semaines (8 par défaut) — v10
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
    duration_sec INTEGER,   -- durée d'effort par série (endurance) — v11
    rest_time INTEGER,
    target_weight REAL,
    set_weights TEXT,
    superset_group INTEGER, -- 2+ exos consécutifs du même groupe = superset (repos après le dernier)
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
    duration_sec INTEGER,   -- durée d'effort réalisée (endurance) — v11
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
  await ensureAccountsColumns(db);
  await ensureWorkoutExosColumns(db);
  await ensureProgramsColumns(db);
  await ensureSessionGroupsColumns(db);
  await ensureLogsSessionColumns(db);
  await ensureLogsSetsColumns(db);

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

/**
 * Ajoute `LOGS_SETS.duration_sec` (v11) : durée d'effort réalisée sur les
 * exercices d'endurance, chronométrés au lieu d'être comptés en répétitions.
 * Idempotent : ne fait rien sur une base neuve (colonne déjà présente).
 */
async function ensureLogsSetsColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(LOGS_SETS)');
  if (columns.length === 0) return;

  const names = new Set(columns.map((column) => column.name));
  if (!names.has('duration_sec')) {
    await db.execAsync('ALTER TABLE LOGS_SETS ADD COLUMN duration_sec INTEGER');
  }
}

/**
 * Colonnes de profil de `ACCOUNTS` (v8 : onboarding / multi-comptes,
 * v10 : `niveau`, utilisé par le générateur de programme,
 * v12 : `points_forts` / `points_faibles`, priorités musculaires du générateur).
 * Idempotent : ne fait rien sur une base neuve (colonnes déjà présentes).
 */
async function ensureAccountsColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(ACCOUNTS)');
  if (columns.length === 0) return;

  const names = new Set(columns.map((column) => column.name));
  const additions: Array<[string, string]> = [
    ['douleurs_zones', 'TEXT'],
    ['douleurs_note', 'TEXT'],
    ['sessions_per_week', 'INTEGER'],
    ['materiel', 'TEXT'],
    ['format_seance', 'TEXT'],
    ['duree_seance', 'INTEGER'],
    ['niveau', 'TEXT'],
    ['points_forts', 'TEXT'],
    ['points_faibles', 'TEXT'],
  ];

  for (const [name, type] of additions) {
    if (!names.has(name)) {
      await db.execAsync(`ALTER TABLE ACCOUNTS ADD COLUMN ${name} ${type}`);
    }
  }
}

/**
 * Colonnes de bloc de `SESSION_GROUPS` (v10) : un groupe généré porte la date de
 * début de son bloc et sa durée, pour proposer un changement au bout du cycle.
 * Idempotent : ne fait rien sur une base neuve (colonnes déjà présentes).
 */
async function ensureSessionGroupsColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(SESSION_GROUPS)');
  if (columns.length === 0) return;

  const names = new Set(columns.map((column) => column.name));
  const additions: Array<[string, string]> = [
    ['bloc_debut', 'TEXT'],
    ['bloc_semaines', 'INTEGER'],
  ];

  for (const [name, type] of additions) {
    if (!names.has(name)) {
      await db.execAsync(`ALTER TABLE SESSION_GROUPS ADD COLUMN ${name} ${type}`);
    }
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
 * Migrations additives de WORKOUT_EXOS (v3 -> v11) :
 * - v4 : bornes de reps `reps_min`/`reps_max` (double progression).
 * - v5 : `set_weights` (poids par série, dégressif), stocké en JSON.
 * - v11 : `duration_sec` (durée cible d'un exercice d'endurance).
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
  if (!names.has('superset_group')) {
    await db.execAsync('ALTER TABLE WORKOUT_EXOS ADD COLUMN superset_group INTEGER');
  }
  if (!names.has('duration_sec')) {
    await db.execAsync('ALTER TABLE WORKOUT_EXOS ADD COLUMN duration_sec INTEGER');
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

// --- Comptes / profils (ACCOUNTS) ------------------------------------------

/** Profil d'entraînement (Module 1 - Onboarding). */
export interface Account {
  id: number;
  prenom: string;
  age: number | null;
  poids: number | null;
  taille: number | null;
  objectif: string | null;
  /** Niveau d'expérience (clé de `NIVEAUX`) : pilote le volume généré. */
  niveau: string | null;
  /** Points forts à limiter, encodés en JSON (clés de `MUSCLE_GROUPS`). */
  points_forts: string | null;
  /** Points faibles à prioriser, encodés en JSON (clés de `MUSCLE_GROUPS`). */
  points_faibles: string | null;
  /** Zones sensibles, encodées en JSON (clés de `HEALTH_ZONES`). */
  douleurs_zones: string | null;
  douleurs_note: string | null;
  sessions_per_week: number | null;
  /** Matériel disponible, encodé en JSON (clés de `EQUIPMENTS`). */
  materiel: string | null;
  format_seance: string | null;
  /** Durée visée d'une séance, en minutes. */
  duree_seance: number | null;
}

/** Champs de profil saisis dans le formulaire (listes en clés brutes). */
export interface AccountInput {
  prenom: string;
  age: number | null;
  poids: number | null;
  taille: number | null;
  objectif: string | null;
  niveau: string | null;
  points_forts: string[];
  points_faibles: string[];
  douleurs_zones: string[];
  douleurs_note: string | null;
  sessions_per_week: number | null;
  materiel: string[];
  format_seance: string | null;
  duree_seance: number | null;
}

export function getAccounts(db: SQLite.SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>('SELECT * FROM ACCOUNTS ORDER BY id');
}

export function getAccount(db: SQLite.SQLiteDatabase, id: number): Promise<Account | null> {
  return db.getFirstAsync<Account>('SELECT * FROM ACCOUNTS WHERE id = ?', id);
}

/**
 * Crée un profil et lui rattache les données orphelines (groupes / séances /
 * journaux créés avant les comptes, `account_id IS NULL`) : le premier compte
 * récupère l'historique existant, les suivants démarrent vides.
 */
export async function createAccount(
  db: SQLite.SQLiteDatabase,
  input: AccountInput
): Promise<number> {
  let accountId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO ACCOUNTS
         (prenom, age, poids, taille, objectif, niveau, points_forts, points_faibles,
          douleurs_zones, douleurs_note, sessions_per_week, materiel, format_seance, duree_seance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.prenom,
      input.age,
      input.poids,
      input.taille,
      input.objectif,
      input.niveau,
      joinKeyList(input.points_forts),
      joinKeyList(input.points_faibles),
      joinKeyList(input.douleurs_zones),
      input.douleurs_note,
      input.sessions_per_week,
      joinKeyList(input.materiel),
      input.format_seance,
      input.duree_seance
    );
    accountId = result.lastInsertRowId;

    // Adopte les données pré-comptes pour ne rien perdre.
    await db.runAsync(
      'UPDATE SESSION_GROUPS SET account_id = ? WHERE account_id IS NULL',
      accountId
    );
    await db.runAsync('UPDATE PROGRAMS SET account_id = ? WHERE account_id IS NULL', accountId);
    await db.runAsync('UPDATE LOGS_SESSION SET account_id = ? WHERE account_id IS NULL', accountId);
  });
  return accountId;
}

export async function updateAccount(
  db: SQLite.SQLiteDatabase,
  id: number,
  input: AccountInput
): Promise<void> {
  await db.runAsync(
    `UPDATE ACCOUNTS
        SET prenom = ?, age = ?, poids = ?, taille = ?, objectif = ?, niveau = ?,
            points_forts = ?, points_faibles = ?,
            douleurs_zones = ?, douleurs_note = ?, sessions_per_week = ?,
            materiel = ?, format_seance = ?, duree_seance = ?
      WHERE id = ?`,
    input.prenom,
    input.age,
    input.poids,
    input.taille,
    input.objectif,
    input.niveau,
    joinKeyList(input.points_forts),
    joinKeyList(input.points_faibles),
    joinKeyList(input.douleurs_zones),
    input.douleurs_note,
    input.sessions_per_week,
    joinKeyList(input.materiel),
    input.format_seance,
    input.duree_seance,
    id
  );
}

/** Supprime un compte et toutes ses données (séances, exercices, journaux). */
export async function deleteAccount(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM LOGS_SETS WHERE session_id IN (SELECT id FROM LOGS_SESSION WHERE account_id = ?)',
      id
    );
    await db.runAsync('DELETE FROM LOGS_SESSION WHERE account_id = ?', id);
    await db.runAsync(
      'DELETE FROM WORKOUT_EXOS WHERE program_id IN (SELECT id FROM PROGRAMS WHERE account_id = ?)',
      id
    );
    await db.runAsync('DELETE FROM PROGRAMS WHERE account_id = ?', id);
    await db.runAsync('DELETE FROM SESSION_GROUPS WHERE account_id = ?', id);
    await db.runAsync('DELETE FROM ACCOUNTS WHERE id = ?', id);
  });
}

/**
 * Efface **toutes** les données de l'app : profils, groupes, séances, exercices
 * planifiés et journaux d'entraînement. Le catalogue `EXERCISES` est conservé :
 * ce n'est pas une donnée utilisateur, il est réinstallé au besoin par les
 * migrations. Utilisé par « Réinitialiser toutes les données » (écran Profils)
 * pour repartir d'une base vierge — notamment quand on teste l'app.
 */
export async function resetAppData(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      `DELETE FROM LOGS_SETS;
       DELETE FROM LOGS_SESSION;
       DELETE FROM WORKOUT_EXOS;
       DELETE FROM PROGRAMS;
       DELETE FROM SESSION_GROUPS;
       DELETE FROM ACCOUNTS;`
    );
  });
}

// --- Séances (PROGRAMS + WORKOUT_EXOS) ------------------------------------

/** Séances triées de la plus récente à la plus ancienne, avec le nombre d'exercices. */
export function getPrograms(
  db: SQLite.SQLiteDatabase,
  accountId: number
): Promise<ProgramSummary[]> {
  return db.getAllAsync<ProgramSummary>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM WORKOUT_EXOS we WHERE we.program_id = p.id) AS exercise_count
       FROM PROGRAMS p
      WHERE p.account_id = ?
      ORDER BY p.id DESC`,
    accountId
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
            we.duration_sec, we.rest_time, we.target_weight, we.set_weights, we.superset_group,
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
  /** Durée d'effort par série (endurance), en secondes ; null pour la musculation. */
  duration_sec: number | null;
  rest_time: number;
  target_weight: number;
  /** Poids par série (dégressif) ; null = poids uniforme (target_weight). */
  set_weights: number[] | null;
  /** Superset : même valeur pour les exos consécutifs d'un même bloc ; null = seul. */
  superset_group: number | null;
}

export interface SaveProgramInput {
  /** Absent = création ; sinon mise à jour de la séance existante. */
  id?: number;
  /** Compte propriétaire (utilisé à la création). */
  account_id: number;
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
        input.account_id,
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
         (program_id, exercise_id, series, reps_min, reps_max, duration_sec, rest_time, target_weight, set_weights, superset_group)
       VALUES ($program_id, $exercise_id, $series, $reps_min, $reps_max, $duration_sec, $rest_time, $target_weight, $set_weights, $superset_group)`
    );
    try {
      for (const ex of input.exercises) {
        await statement.executeAsync({
          $program_id: programIdValue,
          $exercise_id: ex.exercise_id,
          $series: ex.series,
          $reps_min: ex.reps_min,
          $reps_max: ex.reps_max,
          $duration_sec: ex.duration_sec,
          $rest_time: ex.rest_time,
          $target_weight: ex.target_weight,
          $set_weights: ex.set_weights ? JSON.stringify(ex.set_weights) : null,
          $superset_group: ex.superset_group,
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

export function getSessionGroups(
  db: SQLite.SQLiteDatabase,
  accountId: number
): Promise<SessionGroup[]> {
  return db.getAllAsync<SessionGroup>(
    'SELECT * FROM SESSION_GROUPS WHERE account_id = ? ORDER BY ordre, id',
    accountId
  );
}

export async function createSessionGroup(
  db: SQLite.SQLiteDatabase,
  accountId: number,
  nom: string,
  /** Bloc d'entraînement (groupes générés) : date de début ISO + durée en semaines. */
  block: { debut: string; semaines: number } | null = null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO SESSION_GROUPS (account_id, nom, ordre, bloc_debut, bloc_semaines) VALUES (?, ?, ?, ?, ?)',
    accountId,
    nom,
    null,
    block?.debut ?? null,
    block?.semaines ?? null
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

/** true si au moins une séance a déjà été enregistrée pour ce compte (LOGS_SESSION). */
export async function hasCompletedSessions(
  db: SQLite.SQLiteDatabase,
  accountId: number
): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM LOGS_SESSION WHERE account_id = ?',
    accountId
  );
  return (row?.count ?? 0) > 0;
}

/** Séance journalisée, enrichie pour l'historique de l'accueil. */
export interface CompletedSession {
  id: number;
  program_id: number | null;
  nom_seance: string | null;
  date: string;
  duration_sec: number | null;
  total_volume: number;
  total_reps: number;
  /** Temps d'effort cumulé des séries chronométrées (endurance), en secondes. */
  total_effort_sec: number;
  exercise_count: number;
}

/** Toutes les séances terminées d'un compte, de la plus récente à la plus ancienne. */
export function getCompletedSessions(
  db: SQLite.SQLiteDatabase,
  accountId: number
): Promise<CompletedSession[]> {
  return db.getAllAsync<CompletedSession>(
    `SELECT ls.id, ls.program_id, p.nom_seance, ls.date, ls.duration_sec,
            COALESCE(ls.total_volume, 0) AS total_volume,
            (SELECT COALESCE(SUM(s.reps), 0)
               FROM LOGS_SETS s WHERE s.session_id = ls.id) AS total_reps,
            (SELECT COALESCE(SUM(s.duration_sec), 0)
               FROM LOGS_SETS s WHERE s.session_id = ls.id) AS total_effort_sec,
            (SELECT COUNT(DISTINCT s.exercise_id)
               FROM LOGS_SETS s WHERE s.session_id = ls.id) AS exercise_count
       FROM LOGS_SESSION ls
       LEFT JOIN PROGRAMS p ON p.id = ls.program_id
      WHERE ls.account_id = ?
      ORDER BY ls.id DESC`,
    accountId
  );
}

// --- Séance en cours (Live Workout) : journalisation ------------------------

export interface SaveWorkoutSet {
  exercise_id: number;
  set_num: number;
  weight: number;
  reps: number;
  /** Durée d'effort réalisée sur un exercice d'endurance, en secondes (0 sinon). */
  duration_sec: number;
  completed: boolean;
}

/**
 * Poids du plan mis à jour (le poids « bouge » d'une séance à l'autre).
 * Le **nombre de séries n'est jamais enregistré** : on ne touche pas à `series`.
 */
export interface SaveWorkoutPlan {
  workout_exo_id: number;
  /** Exercice concerné (permet de synchroniser toutes les séances du compte). */
  exercise_id: number;
  target_weight: number;
  set_weights: number[] | null;
}

/**
 * Écrit le poids d'un exercice dans **toutes les séances du compte** qui le
 * contiennent (« synchro des poids entre les entraînements ») : faire une séance
 * met à jour le poids de cet exercice dans les autres séances aussi.
 * Sans compte (cas limite), on retombe sur la seule ligne visée.
 */
async function applyPlanWeights(
  db: SQLite.SQLiteDatabase,
  accountId: number | null,
  plan: SaveWorkoutPlan
): Promise<void> {
  const weights = plan.set_weights ? JSON.stringify(plan.set_weights) : null;
  if (accountId != null) {
    await db.runAsync(
      `UPDATE WORKOUT_EXOS
          SET target_weight = ?, set_weights = ?
        WHERE exercise_id = ?
          AND program_id IN (SELECT id FROM PROGRAMS WHERE account_id = ?)`,
      plan.target_weight,
      weights,
      plan.exercise_id,
      accountId
    );
  } else {
    await db.runAsync(
      'UPDATE WORKOUT_EXOS SET target_weight = ?, set_weights = ? WHERE id = ?',
      plan.target_weight,
      weights,
      plan.workout_exo_id
    );
  }
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
        `INSERT INTO LOGS_SETS (session_id, exercise_id, set_num, weight, reps, duration_sec, completed)
         VALUES ($session_id, $exercise_id, $set_num, $weight, $reps, $duration_sec, $completed)`
      );
      try {
        for (const set of input.sets) {
          await statement.executeAsync({
            $session_id: sessionId,
            $exercise_id: set.exercise_id,
            $set_num: set.set_num,
            $weight: set.weight,
            $reps: set.reps,
            $duration_sec: set.duration_sec,
            $completed: set.completed ? 1 : 0,
          });
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    for (const plan of input.plans) {
      await applyPlanWeights(db, input.account_id ?? null, plan);
    }
  });

  return sessionId;
}

/**
 * Sauvegarde « inter-séance » du seul **poids** (sans journaliser) : appelée en
 * cours de séance pour que les poids se reportent même sans terminer, et les
 * synchronise entre toutes les séances du compte.
 */
export async function saveWorkoutPlan(
  db: SQLite.SQLiteDatabase,
  accountId: number | null,
  plans: SaveWorkoutPlan[]
): Promise<void> {
  if (plans.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const plan of plans) {
      await applyPlanWeights(db, accountId, plan);
    }
  });
}

export interface PreviousSet {
  set_num: number;
  weight: number;
  reps: number;
  /** Durée d'effort réalisée (endurance), en secondes. */
  duration_sec: number | null;
}

/**
 * Séries de la **dernière fois où cet exercice a été fait**, toutes séances
 * confondues (« synchro entre les entraînements ») : sert de référence à côté des
 * poids, même si l'exercice apparaît dans un autre programme. Vide tant qu'il n'a
 * jamais été fait — le poids courant reste alors celui du plan.
 */
export function getLastSetsForExercise(
  db: SQLite.SQLiteDatabase,
  accountId: number,
  exerciseId: number
): Promise<PreviousSet[]> {
  return db.getAllAsync<PreviousSet>(
    `SELECT ls.set_num AS set_num, ls.weight AS weight, ls.reps AS reps,
            ls.duration_sec AS duration_sec
       FROM LOGS_SETS ls
       JOIN LOGS_SESSION s ON s.id = ls.session_id
      WHERE ls.exercise_id = ?
        AND s.account_id = ?
        AND ls.session_id = (
          SELECT s2.id
            FROM LOGS_SESSION s2
            JOIN LOGS_SETS ls2 ON ls2.session_id = s2.id
           WHERE ls2.exercise_id = ? AND s2.account_id = ?
           ORDER BY s2.id DESC
           LIMIT 1
        )
      ORDER BY ls.set_num`,
    exerciseId,
    accountId,
    exerciseId,
    accountId
  );
}

/** Identifiants des exercices faits lors des `sessions` dernières séances (variété du générateur). */
export function getRecentExerciseIds(
  db: SQLite.SQLiteDatabase,
  accountId: number,
  sessions: number
): Promise<number[]> {
  return db
    .getAllAsync<{ exercise_id: number }>(
      `SELECT DISTINCT ls.exercise_id AS exercise_id
         FROM LOGS_SETS ls
        WHERE ls.session_id IN (
              SELECT id FROM LOGS_SESSION
               WHERE account_id = ?
               ORDER BY id DESC
               LIMIT ?
              )`,
      accountId,
      sessions
    )
    .then((rows) => rows.map((row) => row.exercise_id));
}

/**
 * Poids de référence par exercice : celui de la **première série** de la dernière
 * séance où l'exercice a été fait. Sert à préremplir les charges d'un programme
 * généré avec les charges réellement utilisées.
 *
 * Écrit sans fonction de fenêtrage (indisponible sur les vieux SQLite Android) :
 * sous-requêtes corrélées, sur des volumes de journal très faibles.
 */
export async function getLastReferenceWeights(
  db: SQLite.SQLiteDatabase,
  accountId: number
): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ exercise_id: number; weight: number | null }>(
    `SELECT ls.exercise_id AS exercise_id, ls.weight AS weight
       FROM LOGS_SETS ls
       JOIN LOGS_SESSION s ON s.id = ls.session_id
      WHERE s.account_id = ?
        AND s.id = (
              SELECT MAX(s2.id)
                FROM LOGS_SESSION s2
                JOIN LOGS_SETS ls2 ON ls2.session_id = s2.id
               WHERE ls2.exercise_id = ls.exercise_id AND s2.account_id = ?
            )
        AND ls.set_num = (
              SELECT MIN(ls3.set_num)
                FROM LOGS_SETS ls3
               WHERE ls3.session_id = s.id AND ls3.exercise_id = ls.exercise_id
            )`,
    accountId,
    accountId
  );

  const weights = new Map<number, number>();
  for (const row of rows) {
    if (row.exercise_id != null && row.weight != null) weights.set(row.exercise_id, row.weight);
  }
  return weights;
}

/** Nombre de séances journalisées depuis une date ISO (progression d'un bloc). */
export async function countSessionsSince(
  db: SQLite.SQLiteDatabase,
  accountId: number,
  isoDate: string
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM LOGS_SESSION WHERE account_id = ? AND date >= ?',
    accountId,
    isoDate
  );
  return row?.count ?? 0;
}

// --- Récapitulatif de fin de séance (Module 4 - Stats) ----------------------

/** En-tête d'une séance journalisée, joint au nom du programme lancé. */
export interface SessionSummary {
  id: number;
  account_id: number | null;
  program_id: number | null;
  nom_seance: string | null;
  date: string;
  duration_sec: number | null;
  total_volume: number | null;
}

/** Une série journalisée, jointe à sa fiche catalogue (pour le détail/répartition). */
export interface SessionSetDetail {
  exercise_id: number;
  set_num: number;
  weight: number;
  reps: number;
  /** Durée d'effort réalisée (endurance), en secondes ; null pour la musculation. */
  duration_sec: number | null;
  completed: number;
  nom: string;
  nom_fr: string | null;
  muscle_group: string;
  target: string | null;
  secondary_muscles: string | null;
  is_poly: number;
  image: string | null;
}

export function getSessionSummary(
  db: SQLite.SQLiteDatabase,
  sessionId: number
): Promise<SessionSummary | null> {
  return db.getFirstAsync<SessionSummary>(
    `SELECT ls.id, ls.account_id, ls.program_id, p.nom_seance, ls.date, ls.duration_sec, ls.total_volume
       FROM LOGS_SESSION ls
       LEFT JOIN PROGRAMS p ON p.id = ls.program_id
      WHERE ls.id = ?`,
    sessionId
  );
}

/** Séries d'une séance, dans l'ordre de saisie, avec les infos de l'exercice. */
export function getSessionSets(
  db: SQLite.SQLiteDatabase,
  sessionId: number
): Promise<SessionSetDetail[]> {
  return db.getAllAsync<SessionSetDetail>(
    `SELECT ls.exercise_id, ls.set_num, ls.weight, ls.reps, ls.duration_sec, ls.completed,
            e.nom, e.nom_fr, e.muscle_group, e.target, e.secondary_muscles, e.is_poly, e.image
       FROM LOGS_SETS ls
       JOIN EXERCISES e ON e.id = ls.exercise_id
      WHERE ls.session_id = ?
      ORDER BY ls.id`,
    sessionId
  );
}

/** Point d'historique de volume (une séance enregistrée). */
export interface VolumePoint {
  id: number;
  date: string;
  total_volume: number;
}

/**
 * Volume des `limit` dernières séances d'un programme, du plus ancien au plus
 * récent (pour lire la progression de gauche à droite).
 */
export async function getVolumeHistory(
  db: SQLite.SQLiteDatabase,
  programId: number,
  limit = 12
): Promise<VolumePoint[]> {
  const rows = await db.getAllAsync<VolumePoint>(
    `SELECT id, date, COALESCE(total_volume, 0) AS total_volume
       FROM LOGS_SESSION
      WHERE program_id = ?
      ORDER BY id DESC
      LIMIT ?`,
    programId,
    limit
  );
  return rows.reverse();
}

/** Meilleure série réalisée sur un exercice (record absolu : poids puis reps). */
export interface ExerciseBestSet {
  exercise_id: number;
  weight: number;
  reps: number;
}

const BEST_SET_SQL = `SELECT exercise_id, weight, reps
   FROM (
     SELECT ls.exercise_id, ls.weight, ls.reps,
            ROW_NUMBER() OVER (
              PARTITION BY ls.exercise_id
              ORDER BY ls.weight DESC, ls.reps DESC
            ) AS rn
       FROM LOGS_SETS ls
       JOIN LOGS_SESSION s ON s.id = ls.session_id
      WHERE s.account_id = ?
        AND ls.reps > 0
        AND ls.weight > 0`;

/**
 * Meilleure série de chaque exercice lors des séances **antérieures** à
 * `beforeSessionId` (même compte). Sert à détecter les records dans le
 * récapitulatif : une série bat le record si elle est plus lourde, ou à poids
 * égal plus de reps (`beatsSet`).
 */
export function getExerciseBestSetsBefore(
  db: SQLite.SQLiteDatabase,
  accountId: number,
  beforeSessionId: number
): Promise<ExerciseBestSet[]> {
  return db.getAllAsync<ExerciseBestSet>(
    `${BEST_SET_SQL}
        AND ls.session_id < ?
   ) WHERE rn = 1`,
    accountId,
    beforeSessionId
  );
}

/**
 * Record absolu actuel de chaque exercice (toutes séances du compte), pour
 * l'afficher **pendant** l'entraînement (« record à battre »).
 */
export function getExerciseBestSets(
  db: SQLite.SQLiteDatabase,
  accountId: number
): Promise<ExerciseBestSet[]> {
  return db.getAllAsync<ExerciseBestSet>(
    `${BEST_SET_SQL}
   ) WHERE rn = 1`,
    accountId
  );
}
