import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import { chartSeries, palette, zones } from './colors';

/**
 * Thème de l'app — direction artistique « Terminal » (docs/DA_Arny_Terminal.md).
 *
 * Aucun écran ne doit importer une
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
  /** Surface d'un contrôle sélectionné (puce, filtre) — crème. */
  selectedSurface: string;
  /** Encre posée sur la surface de sélection. */
  onSelected: string;
  /** Filets et bordures décoratives (1 px). */
  border: string;
  /**
   * Bordure d'un **contrôle** (champ, bouton d'icône) : 3:1 minimum contre le
   * fond, pour qu'il se distingue sans dépendre de sa couleur de surface.
   */
  borderStrong: string;
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
  /** Marqueur : record, ce qui se passe maintenant (jaune record). */
  marker: string;
  /** Encre posée sur le marqueur (graphite). */
  onMarker: string;
  /** Erreur, suppression, alerte. */
  danger: string;
  /** Texte posé sur l'erreur. */
  onDanger: string;
  /** Succès, statut validé (kaki). */
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
  /** Teintes d'un graphique catégoriel (une couleur par série). */
  chartSeries: readonly string[];
  /** Filet qui entoure la barre de zones. */
  zoneBorder: string;
  /** Ombre unique de l'app : réservée aux feuilles modales (§7.6). */
  shadow: ViewStyle;
}

/**
 * Thème unique : la DA « Terminal » est sombre par construction (fond graphite,
 * encre crème). Le réglage clair/sombre du téléphone n'a plus d'effet.
 */
export const darkTheme: Theme = {
  mode: 'dark',
  isDark: true,
  colors: {
    background: palette.graphite,
    surface: palette.carbone,
    surfaceAlt: palette.acier,
    selectedSurface: palette.creme,
    onSelected: palette.graphite,
    border: palette.filet,
    borderStrong: palette.filetControle,
    text: palette.creme,
    textMuted: palette.cendre,
    action: palette.orange,
    actionPressed: palette.orangeAppui,
    onAction: palette.graphite,
    marker: palette.jauneRecord,
    onMarker: palette.graphite,
    danger: palette.rouge,
    onDanger: palette.graphite,
    success: palette.kaki,
    onSuccess: palette.graphite,
    overlay: 'rgba(0, 0, 0, 0.72)',
  },
  zones,
  chartSeries,
  zoneBorder: palette.filet,
  shadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
};

const ThemeContext = createContext<Theme>(darkTheme);

/** Fournit le thème (unique, sombre) à l'app. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={darkTheme}>{children}</ThemeContext.Provider>;
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
