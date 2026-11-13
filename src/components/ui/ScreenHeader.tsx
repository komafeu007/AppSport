import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { scale, MAX_FONT_SCALE, spacing, text } from '../../theme/tokens';
import Appear from './Appear';

interface Props {
  title: string;
  /** Rubrique orange au-dessus du titre : « 01 — Tableau de bord » → « // 01 — TABLEAU DE BORD ». */
  kicker?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Titre plus petit (écrans poussés : éditeur, aperçu). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * En-tête d'écran de la DA « Terminal » : rubrique mono orange précédée de
 * « // », puis le titre en Chakra Petch capitales, très grand.
 */
export default function ScreenHeader({ title, kicker, subtitle, right, compact = false, style }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Appear style={[styles.header, style]}>
      {kicker ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.kicker}>{`// ${kicker}`}</Text> : null}
      <View style={styles.row}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, compact ? styles.titleCompact : null]}
          accessibilityRole="header"
          // Le titre (52 px) ne doit jamais déborder ni couper un mot : il se
          // réduit pour tenir sur sa ligne (deux lignes pour un titre compact,
          // souvent un nom de séance).
          numberOfLines={compact ? 2 : 1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {title}
        </Text>
        {right}
      </View>
      {subtitle ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subtitle}>{subtitle}</Text> : null}
    </Appear>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    kicker: {
      ...text.kicker,
      color: theme.colors.action,
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    title: {
      ...text.screenTitle,
      color: theme.colors.text,
      flexShrink: 1,
    },
    titleCompact: {
      fontSize: scale(40),
      lineHeight: scale(42),
    },
    subtitle: {
      ...text.meta,
      fontSize: scale(16),
      lineHeight: scale(22),
      color: theme.colors.textMuted,
      marginTop: spacing.sm,
    },
  });
