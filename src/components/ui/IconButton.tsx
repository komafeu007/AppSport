import { StyleSheet, Text } from 'react-native';

import { colors, neutrals } from '../../theme/colors';
import { radius } from '../../theme/tokens';
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

/** Bouton rond compact pour les actions de ligne (supprimer, valider, menu). */
export default function IconButton({
  glyph,
  onPress,
  tone = 'neutral',
  active = false,
  size = 32,
  accessibilityLabel,
}: Props) {
  const toneColor = tones[tone];

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.9}
      style={[
        styles.button,
        { width: size, height: size, borderRadius: radius.sm + 2 },
        active && { backgroundColor: toneColor, borderColor: toneColor },
      ]}
    >
      <Text
        style={[styles.glyph, { color: active ? colors.background : toneColor }]}
      >
        {glyph}
      </Text>
    </PressableScale>
  );
}

const tones = {
  neutral: neutrals.text,
  danger: colors.alert,
  accent: colors.accent,
} as const;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neutrals.border,
    backgroundColor: neutrals.surfaceAlt,
  },
  glyph: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
});
