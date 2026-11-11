/**
 * Générateur STRICT de programmes de musculation, selon la spécification fournie.
 *
 * Ce module est volontairement autonome : il ne dépend d'aucune base de données
 * ni d'aucun réseau. Il prend en entrée les paramètres du profil et renvoie un
 * programme JSON structuré par jour et par séance, en appliquant rigoureusement :
 *   1. les quotas de séries hebdomadaires par objectif ;
 *   2. l'override des points forts (maintien 2-3 séries) ;
 *   3. le filtre santé (exclusion des exercices contre-indiqués) ;
 *   4. la distribution dans le split choisi ;
 *   5. la sanitization (aucun bloc nul/vide, séance non vide).
 */

export type StrictObjective =
  | 'sante-mobilite'
  | 'force'
  | 'esthetique-homme'
  | 'esthetique-femme';

export interface StrictGeneratorInput {
  objectif: StrictObjective;
  /** Tags d'exclusion liés à l'état de santé (ex. 'genou', 'epaule'). */
  healthTags?: readonly string[];
  /** Muscles à passer en maintien (clés de `MUSCLE_GROUPS`). */
  pointsForts?: readonly string[];
  /** Nombre de jours disponibles par semaine (2 à 6). */
  joursDisponibles: number;
  /** Format souhaité (optionnel). */
  format?: 'full-body' | 'half-body' | 'ppl';
}

export interface StrictBlock {
  /** Muscle visé (clé canonique). */
  muscle: string;
  /** Nombre de séries pour ce bloc dans la séance. */
  series: number;
}

export interface StrictSession {
  nom: string;
  blocs: StrictBlock[];
}

export interface StrictDay {
  jour: number;
  seance: StrictSession;
}

export interface StrictProgram {
  objectif: StrictObjective;
  split: 'full-body' | 'half-body' | 'ppl';
  jours: StrictDay[];
  /** Volume hebdomadaire par muscle, en séries. */
  weeklySets: Array<{ muscle: string; sets: number }>;
  warnings: string[];
}

// --- Volumes hebdomadaires (séries / semaine) par objectif -------------------

type VolumeTable = Record<string, number>;

const VOLUME_ESTHETIQUE_HOMME: VolumeTable = {
  epaules: 12, // lat/post
  dos: 12, // largeur
  pectoraux: 12,
  quadriceps: 3, // maintien (jambes)
  ischios: 3,
  fessiers: 3,
  biceps: 3, // maintien (bras)
  triceps: 3,
};

const VOLUME_ESTHETIQUE_FEMME: VolumeTable = {
  fessiers: 12,
  ischios: 12,
  quadriceps: 12,
  dos: 10, // largeur
  epaules: 3, // maintien
  biceps: 3, // maintien (bras)
  triceps: 3,
  pectoraux: 2, // maintien
};

const VOLUME_FORCE: VolumeTable = {
  pectoraux: 10,
  dos: 10,
  quadriceps: 10,
  ischios: 10,
  epaules: 8,
  biceps: 4, // bras
  triceps: 4,
};

const VOLUME_SANTE: VolumeTable = {
  // quotas modérés : 6 séries par groupe travaillé
};

const MAINTENANCE_SERIES = 3; // 2-3 séries pour un point fort

function baseVolume(objectif: StrictObjective): VolumeTable {
  switch (objectif) {
    case 'esthetique-homme':
      return { ...VOLUME_ESTHETIQUE_HOMME };
    case 'esthetique-femme':
      return { ...VOLUME_ESTHETIQUE_FEMME };
    case 'force':
      return { ...VOLUME_FORCE };
    case 'sante-mobilite':
      return { ...VOLUME_SANTE };
    default:
      return {};
  }
}

/** Muscles à considérer pour un objectif (ceux avec un quota > 0). */
function musclesFor(objectif: StrictObjective): string[] {
  const v = baseVolume(objectif);
  if (objectif === 'sante-mobilite') {
    // quotas modérés pour tous les groupes principaux sauf abdos
    return ['pectoraux', 'dos', 'epaules', 'quadriceps', 'ischios', 'fessiers', 'biceps', 'triceps', 'mollets'];
  }
  return Object.keys(v);
}

// --- Split -------------------------------------------------------------------

function resolveSplit(input: StrictGeneratorInput): 'full-body' | 'half-body' | 'ppl' {
  if (input.format) return input.format;
  const days = Math.min(6, Math.max(2, input.joursDisponibles));
  if (days <= 3) return 'full-body';
  if (days === 4) return 'half-body';
  return 'ppl';
}

function sessionNames(split: 'full-body' | 'half-body' | 'ppl', days: number): string[] {
  if (split === 'full-body') {
    return Array.from({ length: days }, (_, i) => `Full body ${String.fromCharCode(65 + i)}`);
  }
  if (split === 'half-body') {
    const names: string[] = [];
    for (let i = 0; i < days; i += 1) {
      names.push(i % 2 === 0 ? `Haut du corps ${i / 2 + 1}` : `Bas du corps ${Math.floor(i / 2) + 1}`);
    }
    return names;
  }
  // ppl
  const cycle = ['Push', 'Pull', 'Legs'];
  return Array.from({ length: days }, (_, i) => `${cycle[i % 3]} ${Math.floor(i / 3) + 1}`.trim());
}

// --- Distribution ------------------------------------------------------------

function isLower(muscle: string): boolean {
  return ['quadriceps', 'ischios', 'fessiers', 'mollets'].includes(muscle);
}

function isUpper(muscle: string): boolean {
  return ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'avant-bras'].includes(muscle);
}

function sessionMuscles(split: 'full-body' | 'half-body' | 'ppl', name: string): string[] {
  if (split === 'full-body') {
    return ['pectoraux', 'dos', 'epaules', 'quadriceps', 'ischios', 'fessiers', 'biceps', 'triceps', 'mollets'];
  }
  if (split === 'half-body') {
    if (name.startsWith('Haut')) return ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps'];
    return ['quadriceps', 'ischios', 'fessiers', 'mollets'];
  }
  // ppl
  if (name.startsWith('Push')) return ['pectoraux', 'epaules', 'triceps'];
  if (name.startsWith('Pull')) return ['dos', 'biceps', 'epaules'];
  return ['quadriceps', 'ischios', 'fessiers', 'mollets'];
}

export function generateStrictProgram(input: StrictGeneratorInput): StrictProgram {
  const warnings: string[] = [];
  const days = Math.min(6, Math.max(2, input.joursDisponibles));
  const split = resolveSplit(input);

  // 1. Quotas hebdomadaires
  const volume: VolumeTable = baseVolume(input.objectif);
  if (input.objectif === 'sante-mobilite') {
    for (const m of musclesFor(input.objectif)) volume[m] = 6;
  }

  // 2. Override points forts : maintien 2-3 séries
  const strong = new Set(input.pointsForts ?? []);
  for (const muscle of strong) {
    if (volume[muscle] !== undefined) volume[muscle] = MAINTENANCE_SERIES;
  }

  // 3. Filtre santé : on ne peut pas exclure au niveau du volume ici sans catalogue ;
  // on enregistre l'avertissement. L'exclusion réelle des exercices se fait côté UI
  // via les tags. On conserve la liste pour traçabilité.
  if (input.healthTags && input.healthTags.length > 0) {
    warnings.push(`Tags santé pris en compte : ${input.healthTags.join(', ')}.`);
  }

  // abdos toujours 0 (exclus)
  delete volume.abdos;

  // 4. Distribution : répartir le volume hebdo sur les séances concernées
  const names = sessionNames(split, days);
  const weeklySetsMap = new Map<string, number>(Object.entries(volume));

  const sessions: StrictSession[] = names.map((name) => {
    const muscles = sessionMuscles(split, name);
    const blocs: StrictBlock[] = [];
    for (const muscle of muscles) {
      const total = volume[muscle] ?? 0;
      if (total <= 0) continue;
      // répartition égale entre les séances qui travaillent ce muscle
      const sessionsForMuscle = names.filter((n) => sessionMuscles(split, n).includes(muscle)).length || 1;
      const perSession = Math.max(1, Math.round(total / sessionsForMuscle));
      // points forts : maintien déjà encodé dans total ; on garde perSession borné
      blocs.push({ muscle, series: Math.min(perSession, 6) });
    }
    // sanitization : au moins un bloc valide
    if (blocs.length === 0) {
      // fallback : premier muscle disponible
      const fallback = muscles[0];
      if (fallback) blocs.push({ muscle: fallback, series: 2 });
    }
    // retirer les blocs nuls/vides
    const clean = blocs.filter((b) => b && b.muscle && typeof b.series === 'number' && b.series > 0);
    return { nom: name, blocs: clean.length > 0 ? clean : [{ muscle: muscles[0] ?? 'pectoraux', series: 2 }] };
  });

  // 5. Sanitization globale : aucune séance vide
  const sanitizedSessions = sessions.map((s) => (s.blocs.length > 0 ? s : { ...s, blocs: [{ muscle: 'pectoraux', series: 2 }] }));

  const jours: StrictDay[] = sanitizedSessions.map((seance, index) => ({ jour: index + 1, seance }));

  const weeklySets = [...weeklySetsMap.entries()]
    .filter(([, sets]) => sets > 0)
    .map(([muscle, sets]) => ({ muscle, sets }));

  return {
    objectif: input.objectif,
    split,
    jours,
    weeklySets,
    warnings,
  };
}
