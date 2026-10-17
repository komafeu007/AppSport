import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/tokens';
import PressableScale from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Icône/glyphe affiché avant le libellé (ex. « ＋ »). */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bouton unique de l'app : « primary » (validation, gros boutons du CDC),
 * « secondary » (action neutre), « danger » (arrêt/suppression) et « ghost »
 * (lien discret).
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leading,
  style,
}: Props) {
  const spinnerColor =
    variant === 'primary' || variant === 'danger' ? colors.background : colors.secondary;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={[styles.base, sizes[size], variants[variant], (disabled || loading) && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {leading}
          <Text style={[styles.label, labelSizes[size], labelVariants[variant]]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});

const sizes = StyleSheet.create({
  sm: { paddingVertical: spacing.sm, paddingHorizontal: 14, borderRadius: radius.control },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.control },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, borderRadius: radius.button },
});

const labelSizes = StyleSheet.create({
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 16 },
});

const variants = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  secondary: { borderWidth: 1, borderColor: colors.secondary },
  danger: { backgroundColor: colors.alert },
  ghost: {},
});

const labelVariants = StyleSheet.create({
  primary: { color: colors.background },
  secondary: { color: colors.secondary },
  danger: { color: colors.background },
  ghost: { color: colors.secondary },
});
