import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { spacing } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface Props {
  children: ReactNode;
  /** Rendu cliquable (fond d'appui + accessibilité). */
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Dernière ligne d'une liste : pas de filet dessous. */
  last?: boolean;
  /** Liste déjà en retrait de 20 px : retire la marge interne (défaut : true). */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ligne de liste à plat (§8.5) : hauteur minimale 64, titre à gauche, valeur à
 * droite, séparée par un filet de 1 px qui commence à la marge de 20 px. C'est
 * le remplacement des cartes pour tout ce qui n'est pas l'action principale :
 * la DA n'autorise qu'une carte par écran (§8.4).
 */
export default function Row({
  children,
  onPress,
  onLongPress,
  disabled = false,
  accessibilityLabel,
  last = false,
  inset = true,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [pressed, setPressed] = useState(false);

  const body = (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.row, inset ? null : styles.rowBleed, pressed && onPress ? styles.pressed : null, style]}
    >
      {children}
    </PressableScale>
  );

  return (
    <View>
      {body}
      {last ? null : <View style={[styles.divider, inset ? null : styles.dividerBleed]} />}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    rowBleed: {
      paddingHorizontal: 0,
    },
    pressed: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    divider: {
      height: 1,
      marginLeft: spacing.xl,
      backgroundColor: theme.colors.border,
    },
    dividerBleed: {
      marginLeft: 0,
    },
  });
