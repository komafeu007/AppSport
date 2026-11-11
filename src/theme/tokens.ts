import { Easing, type TextStyle } from 'react-native';

/**
 * Jetons de mise en page — direction artistique « Terminal »
 * (docs/DA_Arny_Terminal.md, maquette « Arny — Refonte design-selection »).
 *
 * Tout écran doit passer par ces valeurs au lieu de nombres en dur : grille
 * unique (base 4 px), trois familles de police et des durées d'animation
 * cohérentes.
 */

/** Familles chargées par `useFonts` (voir App.tsx) : la graisse est dans le nom. */
export const fontFamily = {
  /** Chakra Petch — titres (en capitales) et grands chiffres. */
  display: 'ChakraPetch_600SemiBold',
  displayHeavy: 'ChakraPetch_700Bold',
  /** IBM Plex Sans Condensed — noms d'exercices, texte courant. */
  text: 'IBMPlexSansCondensed_400Regular',
  textMedium: 'IBMPlexSansCondensed_500Medium',
  textSemiBold: 'IBMPlexSansCondensed_600SemiBold',
  textBold: 'IBMPlexSansCondensed_700Bold',
  /** IBM Plex Mono — libellés techniques, références, métadonnées, valeurs. */
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
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

/**
 * Rayons : la DA « Terminal » est **à angles vifs**. Les jetons sont gardés
 * pour que les écrans continuent de les nommer, mais valent 0 (hors `pill`,
 * réservé aux pastilles rondes : poignée de feuille, point d'état).
 */
export const radius = {
  none: 0,
  xs: 0,
  sm: 0,
  control: 0,
  button: 0,
  card: 0,
  sheet: 0,
  pill: 999,
} as const;

/** Cibles tactiles minimales (§7.3) : 48 px, 56 px pendant la séance. */
export const touch = {
  min: 48,
  session: 56,
} as const;

/**
 * Grossissement maximal des polices imposé par le réglage « taille de police »
 * du téléphone : au-delà, les colonnes serrées (séance, tuiles, étiquettes)
 * coupent les mots au milieu. Passé en `maxFontSizeMultiplier` aux textes.
 */
export const MAX_FONT_SCALE = 1.15;

/** Interlettrage des libellés mono en capitales (≈ 0,12 em). */
const MONO_TRACKING = 1.2;

/**
 * Échelle typographique. Trois voix :
 * - **Chakra Petch en capitales** pour les titres et les chiffres ;
 * - **Plex Sans Condensed** pour les noms et le texte courant ;
 * - **Plex Mono en capitales espacées** pour tout ce qui est technique
 *   (rubriques « // 01 — … », libellés de champ, métadonnées, unités).
 */
export const text = {
  /** Chiffres de l'écran de séance : charge, répétitions, chrono. */
  numXl: { fontFamily: fontFamily.displayHeavy, fontSize: 96, lineHeight: 96 },
  /** Chiffre clé d'un écran (durée de fin de séance…). */
  numL: { fontFamily: fontFamily.displayHeavy, fontSize: 48, lineHeight: 52 },
  /** Valeurs dans les tuiles et tableaux. */
  numM: { fontFamily: fontFamily.displayHeavy, fontSize: 30, lineHeight: 34 },
  /** Saisies chiffrées compactes : poids, reps et durée d'une ligne de série. */
  numS: { fontFamily: fontFamily.displayHeavy, fontSize: 20, lineHeight: 24 },
  /** Titre d'écran (« ACCUEIL », « SÉANCES »). */
  screenTitle: {
    fontFamily: fontFamily.displayHeavy,
    fontSize: 52,
    lineHeight: 54,
    textTransform: 'uppercase',
  },
  /** Titre de section (« JOURNAL », « EXERCICES »). */
  sectionTitle: {
    fontFamily: fontFamily.displayHeavy,
    fontSize: 26,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  /** Titre de bloc (nom de groupe, nom de séance dans une carte). */
  title: {
    fontFamily: fontFamily.displayHeavy,
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  /** Nom d'exercice, titre de ligne. */
  cardTitle: { fontFamily: fontFamily.textSemiBold, fontSize: 18, lineHeight: 22 },
  /** Sous-titre, valeur mise en avant. */
  subtitle: { fontFamily: fontFamily.textSemiBold, fontSize: 16, lineHeight: 22 },
  /** Texte courant. */
  body: { fontFamily: fontFamily.text, fontSize: 16, lineHeight: 22 },
  /** Texte courant appuyé. */
  bodyStrong: { fontFamily: fontFamily.textSemiBold, fontSize: 16, lineHeight: 22 },
  /** Libellé de bouton principal (Chakra en capitales). */
  button: {
    fontFamily: fontFamily.displayHeavy,
    fontSize: 18,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  /** Libellé de champ, puce, petit bouton : mono en capitales espacées. */
  label: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: MONO_TRACKING,
    textTransform: 'uppercase',
  },
  /** Texte secondaire, aides (phrase, casse normale). */
  meta: { fontFamily: fontFamily.text, fontSize: 14, lineHeight: 20 },
  /** Métadonnée technique : « 07.11 · 6 EXOS », axes, unités. */
  caption: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: MONO_TRACKING,
    textTransform: 'uppercase',
  },
  /** Rubrique d'écran : « // 01 — TABLEAU DE BORD » (en orange). */
  kicker: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: MONO_TRACKING,
    textTransform: 'uppercase',
  },
  /** Valeur mono appuyée (« 5 023 KG », « 6 915 KG »). */
  monoValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  /** Mention très discrète (aide sous un champ). Plancher à 12 px. */
  micro: { fontFamily: fontFamily.text, fontSize: 12, lineHeight: 16 },
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
