import { useEffect, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  clamp,
  DURATION_RANGE,
  formatDurationInput,
  formatRest,
  parseDurationInput,
} from '../domain/workoutRules';
import { useThemedStyles, useTheme, type Theme } from '../theme';
import { radius, spacing, text } from '../theme/tokens';

interface Props {
  /** Durée en secondes. */
  value: number;
  onChange: (seconds: number) => void;
  /** Libellé au-dessus du champ (absent en séance, où la ligne porte déjà le n° de série). */
  label?: string;
  /** Aide sous le champ : `true` affiche la durée lisible (ex. « 10 min »). */
  hint?: boolean | string;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  /** false = lecture seule (ex. pendant que le chrono mesure la série). */
  editable?: boolean;
}

/**
 * Champ de durée d'effort (mm:ss), utilisé par les exercices d'endurance dans
 * l'éditeur de séance et pendant la séance. La valeur est toujours stockée en
 * secondes ; la saisie accepte « 10:30 » ou un nombre seul, lu comme des minutes.
 */
export default function DurationField({
  value,
  onChange,
  label,
  hint,
  placeholder = '10:00',
  style,
  inputStyle,
  accessibilityLabel,
  editable = true,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const [draft, setDraft] = useState(() => (value > 0 ? formatDurationInput(value) : ''));

  useEffect(() => {
    setDraft(value > 0 ? formatDurationInput(value) : '');
  }, [value]);

  const commit = () => {
    const parsed = parseDurationInput(draft);
    const next = parsed === null ? value : clamp(parsed, DURATION_RANGE);
    onChange(next);
    setDraft(next > 0 ? formatDurationInput(next) : '');
  };

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, inputStyle]}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="numbers-and-punctuation"
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        selectTextOnFocus
        editable={editable}
        returnKeyType="done"
        accessibilityLabel={accessibilityLabel ?? label}
      />
      {hint === true ? (
        <Text style={styles.hint}>{formatRest(value)}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {},
    label: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginBottom: spacing.xs,
    },
    input: {
      minHeight: 56,
      textAlign: 'center',
      ...text.subtitle,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radius.control,
      paddingHorizontal: spacing.sm,
      fontVariant: ['tabular-nums'],
    },
    hint: {
      ...text.micro,
      color: theme.colors.action,
      marginTop: spacing.xs,
    },
  });
