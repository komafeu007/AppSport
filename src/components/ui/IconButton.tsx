import { StyleSheet, Text } from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { fontFamily, radius } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface Props {
  /** Glyphe affiché (×, ⋯, ✓…). Pas d'icônes externes dans l'app. */
  glyph: string;
  onPress: () => void;
  /** `danger` = suppression, `accent` = validation. */
  tone?: 'neutral' | 'danger' | 'accent';
  /** Remplit le fond (état actif : coche, validation de séance). */
  active?: boolean;
  size?: number;
  accessibilityLabel: string;
}

/** Bouton compact pour les actions de ligne (supprimer, valider, menu). */
export default function IconButton({
  glyph,
  onPress,
  tone = 'neutral',
  active = false,
  size = 36,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const fillColor =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'accent'
        ? theme.colors.action
        : theme.colors.selectedSurface;

  const glyphColor = active
    ? tone === 'danger'
      ? theme.colors.onDanger
      : tone === 'accent'
        ? theme.colors.onAction
        : theme.colors.onSelected
    : tone === 'danger'
      ? theme.colors.danger
      : tone === 'accent'
        ? theme.colors.action
        : theme.colors.text;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.92}
      hitSlop={8}
      style={[
        styles.button,
        { width: size, height: size },
        active && { backgroundColor: fillColor, borderColor: fillColor },
      ]}
    >
      <Text style={[styles.glyph, { color: glyphColor }]}>{glyph}</Text>
    </PressableScale>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: radius.sm,
    },
    glyph: {
      fontFamily: fontFamily.textBold,
      fontSize: 18,
      lineHeight: 22,
    },
  });
