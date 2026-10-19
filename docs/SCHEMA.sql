CREATE TABLE IF NOT EXISTS ACCOUNTS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom TEXT NOT NULL,
    age INTEGER,
    poids REAL,
    taille REAL,
    objectif TEXT,             -- objectif principal (masse, seche, force, forme, sante)
    niveau TEXT,               -- niveau d'expérience (debutant, intermediaire, avance) — v10
    douleurs_zones TEXT,       -- zones sensibles, tableau JSON de clés
    douleurs_note TEXT,        -- précision libre sur les douleurs
    sessions_per_week INTEGER, -- nb d'entraînements par semaine visé
    materiel TEXT,             -- matériel dispo, tableau JSON de clés
    format_seance TEXT,        -- format de séance choisi (clé)
    duree_seance INTEGER       -- durée visée d'une séance, en minutes
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

CREATE TABLE IF NOT EXISTS SESSION_GROUPS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    nom TEXT NOT NULL,              -- nom du groupe/split (ex. « PPL », « Maison », « Upper/Lower »)
    ordre INTEGER,
    bloc_debut TEXT,                -- date ISO du début du bloc d'entraînement (programme généré) — v10
    bloc_semaines INTEGER,          -- durée du bloc en semaines (8 par défaut) — v10
    FOREIGN KEY(account_id) REFERENCES ACCOUNTS(id)
);

CREATE TABLE IF NOT EXISTS PROGRAMS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    nom_seance TEXT NOT NULL,
    ordre INTEGER,
    group_id INTEGER,               -- groupe/split d'appartenance (null = sans groupe)
    FOREIGN KEY(account_id) REFERENCES ACCOUNTS(id),
    FOREIGN KEY(group_id) REFERENCES SESSION_GROUPS(id)
);

CREATE TABLE IF NOT EXISTS WORKOUT_EXOS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER,
    exercise_id INTEGER,
    series INTEGER,
    reps_min INTEGER,       -- reps minimum (début de la double progression)
    reps_max INTEGER,       -- reps maximum : au-delà, on monte le poids et on repart au min
    duration_sec INTEGER,   -- durée d'effort par série (endurance, cardio) — v11
    rest_time INTEGER, -- en secondes
    target_weight REAL,     -- poids de base (kg)
    set_weights TEXT,       -- poids par série en JSON (dégressif), ex. '[100,90,80]' ; null = uniforme
    superset_group INTEGER, -- 2+ exos consécutifs du même groupe = superset (repos après le dernier)
    FOREIGN KEY(program_id) REFERENCES PROGRAMS(id),
    FOREIGN KEY(exercise_id) REFERENCES EXERCISES(id)
);

CREATE TABLE IF NOT EXISTS LOGS_SESSION (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    program_id INTEGER,           -- séance (PROGRAMS) réellement effectuée
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
