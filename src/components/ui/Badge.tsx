import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { radius, spacing, text } from '../../theme/tokens';

export type BadgeTone = 'neutral' | 'action' | 'marker' | 'success' | 'danger';

interface Props {
  label: string;
  tone?: BadgeTone;
}

/**
 * Étiquette compacte (§7.5 « pastilles » : rayon 8). Casse de phrase, jamais de
 * capitales : la DA interdit les libellés en majuscules espacées.
 */
export default function Badge({ label, tone = 'neutral' }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.label, styles[`label_${tone}`]]}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    neutral: { backgroundColor: theme.colors.surfaceAlt },
    action: { backgroundColor: theme.colors.action },
    marker: { backgroundColor: theme.colors.marker },
    success: { backgroundColor: theme.colors.success },
    danger: { backgroundColor: theme.colors.danger },
    label: { ...text.caption, fontSize: 11, lineHeight: 15 },
    label_neutral: { color: theme.colors.textMuted },
    label_action: { color: theme.colors.onAction },
    label_marker: { color: theme.colors.onMarker },
    label_success: { color: theme.colors.onSuccess },
    label_danger: { color: theme.colors.onDanger },
  });
