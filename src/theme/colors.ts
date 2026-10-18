/**
 * Palette officielle — direction artistique « Foulée » (docs/DA_Foulee_app_sport.md §5).
 *
 * Règle de la DA : **une couleur, un rôle**, et des jetons opaques (jamais de
 * dégradé ni de transparence pour fabriquer une teinte). Ce fichier ne contient
 * que les couleurs brutes ; les rôles (fond, surface, action, marqueur…) sont
 * exposés par `theme.ts` sous forme de thème clair / sombre.
 */

/** Couleurs de base du mode clair (§5.1). */
export const palette = {
  /** Bleu court — action principale, liens, onglet actif. */
  bleuCourt: '#2347D6',
  /** Bleu appui — état pressé du bleu court. */
  bleuAppui: '#1A38B0',
  /** Marine — texte principal, icônes, remplace le noir. */
  marine: '#0D1B4C',
  /** Jaune balise — marqueur : série en cours, record, ligne de départ. */
  jauneBalise: '#FFD60A',
  /** Dalle — fond d'écran. */
  dalle: '#EEF1F6',
  /** Blanc ligne — surface surélevée, champs. */
  blanc: '#FFFFFF',
  /** Craie — filets, rails vides, bordures de champs. */
  craie: '#D5DAE5',
  /** Ardoise — texte secondaire, axes de graphiques. */
  ardoise: '#5B6478',
  /** Rouge piste — erreur, suppression, alerte. */
  rougePiste: '#D1273B',
  /** Vert gazon — succès, objectif atteint. */
  vertGazon: '#187A41',
} as const;

/** Jetons du mode sombre (§14). */
export const darkPalette = {
  fond: '#0B1433',
  surface: '#141E45',
  surfaceHaute: '#1D2A5C',
  filet: '#2B3A75',
  texte: '#F2F5FF',
  texteSecondaire: '#A6B0D0',
  action: '#7C95FF',
  actionAppui: '#6A83F0',
  erreur: '#FF6B7D',
  succes: '#4FD18B',
  /** Le jaune balise ne change pas en mode sombre. */
  marqueur: palette.jauneBalise,
  /** Marine : jamais noir, sert aussi d'encre sur le jaune et l'action sombre. */
  encre: palette.marine,
} as const;

/** Rampe des zones d'effort, mode clair (§5.2) : Z1 → Z5. */
export const zonesLight = ['#C9D5F7', '#93A9EF', '#5B7BE6', '#2347D6', '#0D1B4C'] as const;

/** Rampe des zones d'effort, mode sombre (§5.2). */
export const zonesDark = ['#34478F', '#4F69C9', '#7C95FF', '#B3C2FF', '#F2F5FF'] as const;

/** Filet de la barre de zones : garde Z1 visible sur fond clair (§5.2). */
export const zonesBorderLight = '#A9B6D3';
export const zonesBorderDark = darkPalette.filet;
