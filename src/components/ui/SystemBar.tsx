import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { MAX_FONT_SCALE, spacing, text } from '../../theme/tokens';

interface Props {
  /** Mention de gauche ; « ARN-SYS / v2.6 » par défaut. */
  left?: string;
  center?: string;
  right?: string;
  style?: StyleProp<ViewStyle>;
}

/** Signature de l'app, affichée à gauche de la barre système. */
export const SYSTEM_TAG = 'ARN-SYS / v2.6';

/**
 * Barre système en haut des écrans à onglets (« ARN-SYS / v2.6 · LUN 09.11.26 ·
 * SEM. 46 ») : trois mentions mono, soulignées d'un filet. Purement décorative,
 * elle situe l'écran dans le temps.
 */
export default function SystemBar({ left = SYSTEM_TAG, center, right, style }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.bar, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.cell} numberOfLines={1}>{left}</Text>
      {center ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.cell, styles.center]} numberOfLines={1}>{center}</Text> : null}
      {right ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.cell, styles.right]} numberOfLines={1}>{right}</Text> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderStrong,
    },
    cell: {
      ...text.caption,
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    center: { textAlign: 'center' },
    right: { textAlign: 'right' },
  });
