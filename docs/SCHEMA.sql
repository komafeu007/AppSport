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
    nom TEXT NOT NULL,              -- nom anglais (dataset hasaneyldrm/exercises-dataset)
    nom_fr TEXT,                    -- nom français (traduction best-effort)
    muscle_group TEXT NOT NULL,
    target TEXT,                    -- muscle principal visé
    secondary_muscles TEXT,         -- tableau JSON de muscles secondaires
    is_poly INTEGER NOT NULL,       -- 1 pour polyarticulaire, 0 pour monoarticulaire
    category TEXT,                  -- partie du corps (chest, back, upper legs…)
    equipment TEXT,
    image TEXT,                     -- nom de fichier de la vignette (assets/exercises/)
    instructions_fr TEXT            -- instructions détaillées en français
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
    rest_time INTEGER, -- en secondes
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
