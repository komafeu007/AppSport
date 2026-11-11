import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { MAX_FONT_SCALE, fontFamily, radius, spacing, text } from '../../theme/tokens';

export type BadgeTone = 'neutral' | 'outline' | 'action' | 'marker' | 'success' | 'danger';

interface Props {
  label: string;
  tone?: BadgeTone;
  /** Placement dans le parent (ex. `alignSelf: 'center'` dans une ligne). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Étiquette compacte de la DA « Terminal » : angles vifs, mono en capitales.
 * Au trait (`neutral`, `outline`) pour une nature, en aplat pour un statut
 * (`success` = validé, `marker` = record, `action` = prochaine séance).
 */
export default function Badge({ label, tone = 'neutral', style }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.badge, styles[tone], style]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.label, styles[`label_${tone}`]]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      borderRadius: radius.xs,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 1,
      alignSelf: 'flex-start',
    },
    // Étiquette au trait (« ANNULÉ ») : filet gris, encre secondaire.
    neutral: { borderColor: theme.colors.borderStrong },
    // Étiquette au trait kaki (« POLY », « MONO ») : nature d'un exercice.
    outline: { borderColor: theme.colors.success },
    action: { backgroundColor: theme.colors.action },
    marker: { backgroundColor: theme.colors.marker },
    success: { backgroundColor: theme.colors.success },
    danger: { backgroundColor: theme.colors.danger },
    label: {
      ...text.caption,
      fontFamily: fontFamily.monoBold,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 1,
      textAlign: 'center',
    },
    label_neutral: { color: theme.colors.textMuted },
    label_outline: { color: theme.colors.success },
    label_action: { color: theme.colors.onAction },
    label_marker: { color: theme.colors.onMarker },
    label_success: { color: theme.colors.onSuccess },
    label_danger: { color: theme.colors.onDanger },
  });
