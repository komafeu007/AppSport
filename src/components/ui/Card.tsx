import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, neutrals } from '../../theme/colors';
import { radius, spacing } from '../../theme/tokens';
import PressableScale from './PressableScale';

export type CardTone = 'default' | 'accent' | 'danger';

interface Props {
  children: ReactNode;
  /** Bordure colorée : `accent` (carte principale), `danger` (alerte). */
  tone?: CardTone;
  /** Rendu cliquable (effet d'appui + accessibilité). */
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Surface de base de l'app : fond `surface`, bordure fine, rayon `card`. */
export default function Card({
  children,
  tone = 'default',
  onPress,
  onLongPress,
  disabled = false,
  accessibilityLabel,
  style,
}: Props) {
  const cardStyle = [styles.card, tones[tone], style];

  if (!onPress && !onLongPress) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <PressableScale
      style={cardStyle}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: neutrals.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: neutrals.border,
    padding: spacing.lg,
  },
});

const tones = StyleSheet.create({
  default: { borderColor: neutrals.border },
  accent: { borderColor: colors.accent },
  danger: { borderColor: colors.alert },
});
