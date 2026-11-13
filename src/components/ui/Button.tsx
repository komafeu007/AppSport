import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { scale, MAX_FONT_SCALE, spacing, text, touch } from '../../theme/tokens';
import Icon from './Icon';
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
  leading?: ReactNode;
  /**
   * Code de commande affiché à droite en mono : `code="GO"` → « [ GO ] ».
   * Le libellé passe alors à gauche, comme les boutons de la maquette.
   */
  code?: string;
  /** Flèche → à droite du libellé (bouton qui ouvre la suite d'un parcours). */
  arrow?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bouton de la DA « Terminal » : angles vifs, Chakra Petch en capitales.
 * - `primary` : aplat orange, encre graphite (une seule action par écran) ;
 * - `secondary` : contour crème, libellé crème ;
 * - `tertiary` : libellé orange seul ;
 * - `danger` : aplat rouge.
 * En `sm`, le libellé passe en mono (« + SÉANCE »).
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leading,
  code,
  arrow = false,
  style,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [pressed, setPressed] = useState(false);

  const inactive = disabled || loading;
  const isPressed = pressed && !inactive;

  const labelColor = inactive
    ? theme.colors.textMuted
    : variant === 'primary'
      ? theme.colors.onAction
      : variant === 'danger'
        ? theme.colors.onDanger
        : variant === 'tertiary'
          ? theme.colors.action
          : theme.colors.text;

  const spread = Boolean(code) || arrow;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        styles[size],
        styles[variant],
        spread ? styles.spread : null,
        isPressed ? styles[`pressed_${variant}`] : null,
        inactive ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <>
          <View style={styles.main}>
            {leading}
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[styles.label, styles[`label_${size}`], { color: labelColor }]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
          {code || arrow ? (
            <View style={styles.trail}>
              {code ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.code, { color: labelColor }]}>{`[ ${code} ]`}</Text>
              ) : null}
              {arrow ? <Icon name="arrowRight" size={scale(20)} color={labelColor} /> : null}
            </View>
          ) : null}
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
      borderWidth: 1,
      borderColor: 'transparent',
    },
    spread: {
      justifyContent: 'space-between',
    },
    main: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 1,
    },
    trail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    label: text.button,
    code: {
      ...text.label,
      letterSpacing: 1.6,
    },
    sm: { minHeight: Platform.OS === 'android' ? touch.min : 44, paddingHorizontal: spacing.lg },
    md: { minHeight: touch.session, paddingHorizontal: spacing.lg },
    lg: { minHeight: scale(60), paddingHorizontal: spacing.lg },
    label_sm: text.label,
    label_md: text.button,
    label_lg: { ...text.button, fontSize: scale(20), lineHeight: scale(24) },
    primary: {
      backgroundColor: theme.colors.action,
      borderColor: theme.colors.action,
    },
    secondary: {
      borderColor: theme.colors.text,
    },
    tertiary: {
      paddingHorizontal: spacing.sm,
    },
    danger: {
      backgroundColor: theme.colors.danger,
      borderColor: theme.colors.danger,
    },
    pressed_primary: {
      backgroundColor: theme.colors.actionPressed,
      borderColor: theme.colors.actionPressed,
    },
    pressed_secondary: { backgroundColor: theme.colors.surfaceAlt },
    pressed_tertiary: { backgroundColor: theme.colors.surfaceAlt },
    pressed_danger: { opacity: 0.85 },
    disabled: {
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.border,
    },
  });
