import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, type ViewStyle } from 'react-native';

import {
  darkPalette,
  palette,
  zonesBorderDark,
  zonesBorderLight,
  zonesDark,
  zonesLight,
} from './colors';

/**
 * Thème de l'app — direction artistique « Foulée » (docs/DA_Foulee_app_sport.md).
 *
 * Le mode suit le réglage du système (§14). Aucun écran ne doit importer une
 * couleur brute : tout passe par `useTheme()` (couleurs de rôle) et
 * `useThemedStyles()` (feuille de style recalculée au changement de thème).
 */

export type ThemeMode = 'light' | 'dark';

/**
 * Couleurs **de rôle** : chaque nom dit à quoi la couleur sert, jamais d'où elle
 * vient. « Une couleur, un rôle » (§5.4).
 */
export interface ThemeColors {
  /** Fond d'écran. */
  background: string;
  /** Surface surélevée : carte, champ, feuille modale. */
  surface: string;
  /** Surface secondaire : puce au repos, tuile d'image, bouton neutre. */
  surfaceAlt: string;
  /** Surface d'un contrôle sélectionné (puce, filtre) — marine en clair. */
  selectedSurface: string;
  /** Encre posée sur la surface de sélection. */
  onSelected: string;
  /** Filets et bordures (1 px). */
  border: string;
  /** Texte principal. */
  text: string;
  /** Texte secondaire, mentions. */
  textMuted: string;
  /** Action principale : boutons, liens, onglet actif. */
  action: string;
  /** Action à l'état pressé. */
  actionPressed: string;
  /** Texte et icônes posés sur l'action. */
  onAction: string;
  /** Marqueur : série en cours, record, ligne de départ (jaune balise). */
  marker: string;
  /** Encre posée sur le marqueur (toujours marine). */
  onMarker: string;
  /** Erreur, suppression, alerte. */
  danger: string;
  /** Texte posé sur l'erreur. */
  onDanger: string;
  /** Succès, objectif atteint. */
  success: string;
  /** Encre posée sur le succès. */
  onSuccess: string;
  /** Voile derrière les feuilles modales. */
  overlay: string;
}

export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  /** Rampe des zones d'effort, Z1 → Z5. */
  zones: readonly string[];
  /** Filet qui entoure la barre de zones. */
  zoneBorder: string;
  /** Ombre unique de l'app : réservée aux feuilles modales (§7.6). */
  shadow: ViewStyle;
}

export const lightTheme: Theme = {
  mode: 'light',
  isDark: false,
  colors: {
    background: palette.dalle,
    surface: palette.blanc,
    surfaceAlt: palette.craie,
    selectedSurface: palette.marine,
    onSelected: palette.blanc,
    border: palette.craie,
    text: palette.marine,
    textMuted: palette.ardoise,
    action: palette.bleuCourt,
    actionPressed: palette.bleuAppui,
    onAction: palette.blanc,
    marker: palette.jauneBalise,
    onMarker: palette.marine,
    danger: palette.rougePiste,
    onDanger: palette.blanc,
    success: palette.vertGazon,
    onSuccess: palette.blanc,
    overlay: 'rgba(13, 27, 76, 0.4)',
  },
  zones: zonesLight,
  zoneBorder: zonesBorderLight,
  shadow: {
    shadowColor: palette.marine,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
};

export const darkTheme: Theme = {
  mode: 'dark',
  isDark: true,
  colors: {
    background: darkPalette.fond,
    surface: darkPalette.surface,
    surfaceAlt: darkPalette.surfaceHaute,
    selectedSurface: darkPalette.action,
    onSelected: darkPalette.encre,
    border: darkPalette.filet,
    text: darkPalette.texte,
    textMuted: darkPalette.texteSecondaire,
    action: darkPalette.action,
    actionPressed: darkPalette.actionAppui,
    onAction: darkPalette.encre,
    marker: darkPalette.marqueur,
    onMarker: darkPalette.encre,
    danger: darkPalette.erreur,
    onDanger: darkPalette.encre,
    success: darkPalette.succes,
    onSuccess: darkPalette.encre,
    overlay: 'rgba(4, 9, 26, 0.6)',
  },
  zones: zonesDark,
  zoneBorder: zonesBorderDark,
  shadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
};

const ThemeContext = createContext<Theme>(lightTheme);

/** Applique le thème clair ou sombre selon le réglage du téléphone. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Thème actif : couleurs de rôle, rampes et ombre. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Feuille de style dépendante du thème. `factory` doit être déclarée au niveau
 * du module (`const createStyles = (t: Theme) => StyleSheet.create({...})`)
 * pour que le calcul ne soit refait qu'au changement de thème.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

/**
 * Raccourci pour les composants qui n'ont besoin que des couleurs.
 * `useTheme().colors` reste préférable quand le mode compte aussi.
 */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
