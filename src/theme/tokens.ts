import { Easing, type TextStyle } from 'react-native';

/**
 * Jetons de mise en page — direction artistique « Foulée »
 * (docs/DA_Foulee_app_sport.md §6 typographie, §7 grille, §11 mouvement).
 *
 * Tout écran doit passer par ces valeurs au lieu de nombres en dur : c'est ce
 * qui garantit une grille unique (base 4 px), deux familles de police seulement
 * et des durées d'animation cohérentes.
 */

/** Familles chargées par `useFonts` (voir App.tsx) : la graisse est dans le nom. */
export const fontFamily = {
  /** Big Shoulders Display — chiffres et titres. */
  display: 'BigShouldersDisplay_700Bold',
  displayHeavy: 'BigShouldersDisplay_800ExtraBold',
  /** Public Sans — texte et interface. */
  text: 'PublicSans_400Regular',
  textMedium: 'PublicSans_500Medium',
  textSemiBold: 'PublicSans_600SemiBold',
  textBold: 'PublicSans_700Bold',
} as const;

/** Échelle d'espacement (base 4 px, §7.1). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Rayons : `control` pour les champs/boutons, `card` pour les surfaces (§7.5). */
export const radius = {
  xs: 4,
  sm: 8,
  control: 12,
  button: 12,
  card: 8,
  sheet: 20,
  pill: 999,
} as const;

/** Cibles tactiles minimales (§7.3) : 48 px, 56 px pendant la séance. */
export const touch = {
  min: 48,
  session: 56,
} as const;

/**
 * Échelle typographique (§6.2). Les tailles vont par paires (grand chiffre →
 * légende). Interlettrage à 0, casse de phrase : jamais de capitales.
 */
export const text = {
  /** Chiffres de l'écran de séance : charge, répétitions, chrono. */
  numXl: { fontFamily: fontFamily.displayHeavy, fontSize: 120, lineHeight: 104 },
  /** Chiffre clé d'un écran (durée de fin de séance…). */
  numL: { fontFamily: fontFamily.displayHeavy, fontSize: 64, lineHeight: 60 },
  /** Valeurs dans les listes et tableaux. */
  numM: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 32 },
  /** Titre d'écran. */
  screenTitle: { fontFamily: fontFamily.displayHeavy, fontSize: 36, lineHeight: 38 },
  /** Titre de section. */
  sectionTitle: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32 },
  /** Titre de bloc (Big Shoulders, plus compact). */
  title: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 28 },
  /** Nom d'exercice, titre de carte. */
  cardTitle: { fontFamily: fontFamily.textSemiBold, fontSize: 18, lineHeight: 24 },
  /** Sous-titre, valeur mise en avant. */
  subtitle: { fontFamily: fontFamily.textSemiBold, fontSize: 16, lineHeight: 22 },
  /** Texte courant. */
  body: { fontFamily: fontFamily.text, fontSize: 16, lineHeight: 24 },
  /** Texte courant appuyé. */
  bodyStrong: { fontFamily: fontFamily.textSemiBold, fontSize: 16, lineHeight: 24 },
  /** Libellé de bouton. */
  button: { fontFamily: fontFamily.textSemiBold, fontSize: 16, lineHeight: 20 },
  /** Libellé de champ, texte court appuyé. */
  label: { fontFamily: fontFamily.textSemiBold, fontSize: 14, lineHeight: 18 },
  /** Texte secondaire, aides. */
  meta: { fontFamily: fontFamily.text, fontSize: 14, lineHeight: 20 },
  /** Légende : axes, unités, mentions. Jamais une information essentielle. */
  caption: { fontFamily: fontFamily.textMedium, fontSize: 12, lineHeight: 16 },
  /** Mention très discrète (aide sous un champ). */
  micro: { fontFamily: fontFamily.text, fontSize: 11, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

/** Durées d'animation en ms (§11.2). */
export const duration = {
  /** Retour visuel sur un bouton pressé. */
  pressed: 100,
  /** Changement d'état, sélection, bascule. */
  fast: 160,
  /** Transitions d'écran, ligne de départ. */
  base: 240,
  /** Feuilles modales. */
  slow: 360,
} as const;

/** Courbes d'animation (§11.2). */
export const easing = {
  enter: Easing.bezier(0.2, 0, 0, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
} as const;

/** Réglage de ressort résiduel (remplissage des coches, glissement d'onglet). */
export const spring = {
  damping: 20,
  stiffness: 220,
  mass: 0.9,
} as const;
