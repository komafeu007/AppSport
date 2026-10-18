import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { radius, spacing, text, touch } from '../../theme/tokens';
import PressableScale from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Glyphe affiché avant le libellé (ex. « + »). */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bouton unique de l'app (§8.1) : « primary » (une seule action principale par
 * écran), « secondary » (contour bleu), « tertiary » (lien) et « danger »
 * (suppression, toujours confirmée). Hauteur 56 en séance, 48 sinon.
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [pressed, setPressed] = useState(false);

  const inactive = disabled || loading;
  const isPressed = pressed && !inactive && variant === 'primary';

  const labelColor = inactive
    ? theme.colors.textMuted
    : variant === 'primary'
      ? theme.colors.onAction
      : variant === 'danger'
        ? theme.colors.onDanger
        : theme.colors.action;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        styles[size],
        styles[variant],
        isPressed ? styles.pressed : null,
        inactive ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <>
          {leading}
          <Text style={[styles.label, styles[`label_${size}`], { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1.5,
      borderRadius: radius.button,
    },
    label: text.button,
    sm: { minHeight: 44, paddingHorizontal: spacing.xl },
    md: { minHeight: touch.min, paddingHorizontal: spacing.xxl },
    lg: { minHeight: touch.session, paddingHorizontal: spacing.xxl },
    label_sm: { fontSize: 14 },
    label_md: { fontSize: 16 },
    label_lg: { fontSize: 16 },
    primary: {
      borderWidth: 0,
      backgroundColor: theme.colors.action,
    },
    secondary: {
      borderColor: theme.colors.action,
    },
    tertiary: {
      borderWidth: 0,
      paddingHorizontal: spacing.sm,
    },
    danger: {
      borderWidth: 0,
      backgroundColor: theme.colors.danger,
    },
    pressed: {
      borderWidth: 0,
      backgroundColor: theme.colors.actionPressed,
    },
    disabled: {
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.border,
    },
  });
