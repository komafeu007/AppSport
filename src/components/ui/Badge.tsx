import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius, spacing, text } from '../../theme/tokens';

interface Props {
  label: string;
  tone?: 'accent' | 'secondary';
}

/** Étiquette compacte (Poly / Mono, compteurs…) en majuscules. */
export default function Badge({ label, tone = 'accent' }: Props) {
  return (
    <View style={[styles.badge, tone === 'accent' ? styles.accent : styles.secondary]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  accent: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  label: {
    ...text.overline,
    fontSize: 11,
    color: colors.background,
  },
});
