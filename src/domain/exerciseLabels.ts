/**
 * Vocabulaire français du catalogue d'exercices.
 *
 * Le dataset (hasaneyldrm/exercises-dataset) fournit `target`, `category`,
 * `equipment`, `muscle_group` et `secondary_muscles` en anglais et très
 * granulaires. Les **noms d'exercices restent en anglais** (langue d'usage en
 * musculation) : seuls ces repères descriptifs sont traduits pour l'affichage.
 */

/** Terme brut du dataset (anglais, minuscules) → libellé français. */
const TERMS: Record<string, string> = {
  // ——— Muscles (target / muscle_group / secondary_muscles) ———
  abdominals: 'Abdominaux',
  abs: 'Abdominaux',
  'lower abs': 'Abdos inférieurs',
  core: 'Sangle abdominale',
  obliques: 'Obliques',
  'hip flexors': 'Fléchisseurs de hanche',
  abductors: 'Abducteurs',
  adductors: 'Adducteurs',
  groin: 'Aine',
  'inner thighs': 'Face interne des cuisses',
  biceps: 'Biceps',
  brachialis: 'Brachial',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  'grip muscles': 'Muscles de préhension',
  'wrist flexors': 'Fléchisseurs du poignet',
  'wrist extensors': 'Extenseurs du poignet',
  wrists: 'Poignets',
  hands: 'Mains',
  feet: 'Pieds',
  chest: 'Pectoraux',
  'upper chest': 'Pectoraux supérieurs',
  pectorals: 'Pectoraux',
  'serratus anterior': 'Dentelé antérieur',
  back: 'Dos',
  'upper back': 'Haut du dos',
  'lower back': 'Lombaires',
  lats: 'Grand dorsal',
  'latissimus dorsi': 'Grand dorsal',
  rhomboids: 'Rhomboïdes',
  trapezius: 'Trapèzes',
  traps: 'Trapèzes',
  'levator scapulae': 'Élévateur de la scapula',
  spine: 'Colonne vertébrale',
  deltoids: 'Deltoïdes',
  delts: 'Deltoïdes',
  'rear deltoids': 'Deltoïdes postérieurs',
  shoulders: 'Épaules',
  'rotator cuff': 'Coiffe des rotateurs',
  neck: 'Cou',
  'sternocleidomastoid': 'Sternocléidomastoïdien',
  quadriceps: 'Quadriceps',
  quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  glutes: 'Fessiers',
  calves: 'Mollets',
  soleus: 'Soléaire',
  shins: 'Tibias',
  ankles: 'Chevilles',
  'ankle stabilizers': 'Stabilisateurs de cheville',
  cardio: 'Cardio',
  'cardiovascular system': 'Système cardiovasculaire',

  // ——— Parties du corps (category) ———
  waist: 'Taille',
  'upper arms': 'Bras',
  'lower arms': 'Avant-bras',
  'upper legs': 'Jambes',
  'lower legs': 'Mollets',

  // ——— Matériel (equipment) ———
  'body weight': 'Poids du corps',
  barbell: 'Barre',
  'ez barbell': 'Barre EZ',
  'olympic barbell': 'Barre olympique',
  'trap bar': 'Barre hexagonale',
  dumbbell: 'Haltères',
  kettlebell: 'Kettlebell',
  cable: 'Poulie',
  rope: 'Corde',
  band: 'Élastique',
  'resistance band': 'Bande de résistance',
  'smith machine': 'Machine Smith',
  'leverage machine': 'Machine à levier',
  'sled machine': 'Traîneau',
  'assisted': 'Assisté',
  weighted: 'Lesté',
  'bosu ball': 'Bosu',
  'medicine ball': 'Médecine-ball',
  'stability ball': 'Ballon de stabilité',
  roller: 'Rouleau',
  'wheel roller': 'Roue abdominale',
  hammer: 'Masse',
  tire: 'Pneu',
  'stationary bike': 'Vélo d’appartement',
  'elliptical machine': 'Vélo elliptique',
  'stepmill machine': 'Escalier (StepMill)',
  'skierg machine': 'SkiErg',
  'upper body ergometer': 'Ergomètre haut du corps',
};

/** Libellé français d'un terme brut du dataset (renvoie le terme si inconnu). */
export function exerciseTermLabel(raw: string | null | undefined): string {
  if (!raw) return '';
  return TERMS[raw.trim().toLowerCase()] ?? raw;
}

/** Traduit une liste de termes (muscles secondaires), sans doublon. */
export function exerciseTermLabels(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const value of raw) {
    const label = exerciseTermLabel(value);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}
