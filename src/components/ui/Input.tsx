import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { neutrals } from '../../theme/colors';
import { radius, spacing } from '../../theme/tokens';

interface Props extends TextInputProps {
  /** Agrandit le texte (champ mis en avant, ex. poids total). */
  emphasis?: boolean;
  style?: StyleProp<TextStyle>;
}

/** Champ de saisie standard de l'app (fond `surfaceAlt`, rayon `control`). */
export default function Input({ emphasis = false, style, ...rest }: Props) {
  return (
    <TextInput
      placeholderTextColor={neutrals.textMuted}
      {...rest}
      style={[styles.input, emphasis && styles.emphasis, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: neutrals.surfaceAlt,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: neutrals.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: neutrals.text,
    fontSize: 15,
  },
  emphasis: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
});
