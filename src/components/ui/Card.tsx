import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { radius, spacing } from '../../theme/tokens';
import PressableScale from './PressableScale';

export type CardTone = 'default' | 'accent' | 'danger' | 'marker' | 'success';

interface Props {
  children: ReactNode;
  /** Bordure colorée : `accent` (élément principal), `marker` (record), `danger`. */
  tone?: CardTone;
  /** Rendu cliquable (effet d'appui + accessibilité). */
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Surface de base de l'app (§8.4) : fond surface, filet de 1 px, rayon 8,
 * **aucune ombre** (l'élévation se lit à la couleur de surface, §7.6).
 */
export default function Card({
  children,
  tone = 'default',
  onPress,
  onLongPress,
  disabled = false,
  accessibilityLabel,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const cardStyle = [styles.card, styles[tone], style];

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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: spacing.lg,
    },
    default: {},
    accent: { borderColor: theme.colors.action, borderWidth: 2 },
    danger: { borderColor: theme.colors.danger, borderWidth: 2 },
    marker: { borderColor: theme.colors.marker, borderWidth: 2 },
    success: { borderColor: theme.colors.success, borderWidth: 2 },
  });
