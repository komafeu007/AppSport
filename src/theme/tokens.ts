import type { TextStyle } from 'react-native';

/**
 * Jetons de mise en page de l'app (voir docs/CDC.md : dark mode à haut contraste).
 * Tout écran doit passer par ces valeurs au lieu de nombres en dur, pour que les
 * espacements, rayons et tailles de texte restent cohérents d'un écran à l'autre.
 */

/** Échelle d'espacement (padding / margin / gap). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

/** Rayons : `control` pour les champs/boutons, `card` pour les surfaces, `sheet` pour les feuilles. */
export const radius = {
  sm: 8,
  control: 12,
  button: 14,
  card: 16,
  sheet: 22,
  pill: 999,
} as const;

/** Échelle typographique. Les tailles vont par paires (grand titre → légende). */
export const text = {
  screenTitle: { fontSize: 28, fontWeight: '800' },
  cardTitle: { fontSize: 22, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15 },
  bodyStrong: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 13 },
  caption: { fontSize: 12 },
  /** Mentions très discrètes (aide sous un champ). */
  micro: { fontSize: 11 },
  overline: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

/** Durées d'animation (ms). */
export const duration = {
  fast: 140,
  base: 220,
  slow: 320,
} as const;

/** Réglage de ressort commun aux animations d'entrée et d'appui. */
export const spring = {
  damping: 18,
  stiffness: 210,
  mass: 0.9,
} as const;
