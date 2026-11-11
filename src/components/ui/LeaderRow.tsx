import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { MAX_FONT_SCALE, spacing, text } from '../../theme/tokens';
import DashedLine from './DashedLine';

interface Props {
  label: string;
  value: string;
}

/**
 * Ligne de fiche technique « EXERCICES ……… 06 » : libellé mono gris, points de
 * conduite, valeur mono crème alignée à droite.
 */
export default function LeaderRow({ label, value }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label} numberOfLines={1}>{label}</Text>
      <DashedLine variant="dotted" style={styles.leader} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 24,
    },
    label: {
      ...text.caption,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textMuted,
    },
    leader: {
      flex: 1,
      minWidth: spacing.lg,
    },
    value: {
      ...text.monoValue,
      fontSize: 14,
      color: theme.colors.text,
    },
  });
