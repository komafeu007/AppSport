import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { radius, spacing, text } from '../../theme/tokens';

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
    <TextInput
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
    input: {
      minHeight: 56,
      backgroundColor: theme.colors.surface,
      borderRadius: radius.control,
      borderWidth: 1,
      // Bordure de contrôle (3:1) : un champ se voit sans dépendre du contraste
      // entre la surface blanche et la dalle.
      borderColor: theme.colors.borderStrong,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...text.body,
      color: theme.colors.text,
    },
    focused: {
      // La bordure s'épaissit **vers l'intérieur** : le texte ne bouge pas d'un
      // pixel au focus (pas de saut de mise en page).
      borderWidth: 2,
      borderColor: theme.colors.action,
      paddingHorizontal: spacing.md - 1,
      paddingVertical: spacing.md - 1,
    },
    emphasis: {
      ...text.numM,
      textAlign: 'center',
      color: theme.colors.text,
    },
  });
