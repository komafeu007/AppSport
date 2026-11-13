import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { scale, MAX_FONT_SCALE, fontFamily, radius, spacing, text } from '../../theme/tokens';

interface Props extends TextInputProps {
  /** Agrandit le texte (champ mis en avant, ex. poids total). */
  emphasis?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Champ de saisie standard (§8.2) : hauteur 56, rayon 12, fond surface, filet
 * de 1 px. Au focus, le filet passe à 2 px en bleu (couleur d'action).
 */
export default function Input({ emphasis = false, style, onFocus, onBlur, ...rest }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);

  return (
    <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
      placeholderTextColor={theme.colors.textMuted}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      {...rest}
      style={[styles.input, focused && styles.focused, emphasis && styles.emphasis, style]}
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Champ « terminal » : bloc acier à angles vifs, souligné d'un filet qui
    // passe à 2 px orange au focus.
    input: {
      minHeight: scale(52),
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: radius.control,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderStrong,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      ...text.body,
      fontFamily: fontFamily.mono,
      color: theme.colors.text,
    },
    focused: {
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.action,
      paddingBottom: spacing.md - 1,
    },
    emphasis: {
      ...text.numM,
      textAlign: 'center',
      color: theme.colors.text,
    },
  });
