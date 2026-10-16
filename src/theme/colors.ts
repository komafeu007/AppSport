/**
 * Palette officielle — Design System (voir docs/CDC.md).
 * Dark mode à haut contraste.
 */
export const colors = {
  /** Fond principal */
  background: '#121218',
  /** Accent / Validation (Néon Green) */
  accent: '#00E676',
  /** Secondaire / Liens (Electric Blue) */
  secondary: '#00B0FF',
  /** Alerte / Timer (Intense Orange) */
  alert: '#FF3D00',
} as const;

/**
 * Nuances neutres dérivées du fond, pour surfaces, textes et bordures.
 * Le CDC ne définit que les 4 couleurs officielles ci-dessus.
 */
export const neutrals = {
  surface: '#1C1C24',
  surfaceAlt: '#26262F',
  border: '#33333D',
  text: '#F5F5F7',
  textMuted: '#A0A0AC',
} as const;

export const theme = { colors, neutrals } as const;

export type Theme = typeof theme;
