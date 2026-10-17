/**
 * Référentiel du profil (Module 1 - Onboarding) + helpers de stockage.
 * Les choix sont persistés en **clés** stables ; les libellés français ne servent
 * qu'à l'affichage, pour pouvoir les retoucher sans migrer la base.
 */

export interface ProfileOption {
  key: string;
  label: string;
}

/** Objectif principal. */
export const OBJECTIFS: readonly ProfileOption[] = [
  { key: 'masse', label: 'Prise de masse' },
  { key: 'seche', label: 'Perte de poids' },
  { key: 'force', label: 'Force' },
  { key: 'forme', label: 'Remise en forme' },
  { key: 'sante', label: 'Santé / mobilité' },
];

/**
 * Niveau d'expérience (choix unique) : pilote le **volume** généré (séries par
 * muscle, exercices par séance) et non les charges, qui sont reprises de l'historique.
 */
export const NIVEAUX: readonly ProfileOption[] = [
  { key: 'debutant', label: 'Débutant' },
  { key: 'intermediaire', label: 'Intermédiaire' },
  { key: 'avance', label: 'Avancé' },
];

/** Niveau retenu quand le profil n'en indique pas (profils créés avant la v10). */
export const DEFAULT_NIVEAU = 'debutant';

/** Matériel disponible (multi-sélection). */
export const EQUIPMENTS: readonly ProfileOption[] = [
  { key: 'salle', label: 'Salle de sport' },
  { key: 'halteres', label: 'Haltères' },
  { key: 'barre', label: 'Barre + disques' },
  { key: 'traction', label: 'Barre de traction' },
  { key: 'poids-corps', label: 'Poids du corps' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'elastiques', label: 'Élastiques' },
  { key: 'machines', label: 'Machines' },
];

/** Format de séance souhaité (choix unique). */
export const SESSION_FORMATS: readonly ProfileOption[] = [
  { key: 'ppl', label: 'Push / Pull / Legs' },
  { key: 'upper-lower', label: 'Haut / Bas du corps' },
  { key: 'full-body', label: 'Full body' },
  { key: 'split', label: 'Split par muscle' },
  { key: 'maison', label: 'Maison (poids du corps)' },
];

/** Zones sensibles / douloureuses (multi-sélection). */
export const HEALTH_ZONES: readonly ProfileOption[] = [
  { key: 'nuque', label: 'Nuque / cou' },
  { key: 'epaules', label: 'Épaules' },
  { key: 'coudes', label: 'Coudes' },
  { key: 'poignets', label: 'Poignets / mains' },
  { key: 'dos', label: 'Dos' },
  { key: 'lombaires', label: 'Lombaires / bas du dos' },
  { key: 'hanches', label: 'Hanches' },
  { key: 'genoux', label: 'Genoux' },
  { key: 'chevilles', label: 'Chevilles / pieds' },
];

/** Durées de séance proposées (minutes). */
export const SESSION_DURATIONS: readonly number[] = [30, 45, 60, 75, 90, 120];

/** Fréquences hebdomadaires proposées (séances / semaine). */
export const WEEKLY_FREQUENCIES: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/** Libellé d'une clé dans une liste d'options (retombe sur la clé brute si inconnue). */
export function optionLabel(
  options: readonly ProfileOption[],
  key: string | null | undefined
): string | null {
  if (!key) return null;
  return options.find((option) => option.key === key)?.label ?? key;
}

/** Lit une liste de clés stockée en JSON (ex. `materiel`, `douleurs_zones`). */
export function parseKeyList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

/** Sérialise une liste de clés (liste vide → `null`, pour rester lisible en base). */
export function joinKeyList(keys: readonly string[]): string | null {
  return keys.length > 0 ? JSON.stringify([...keys]) : null;
}
