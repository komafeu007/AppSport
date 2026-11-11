import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { MAX_FONT_SCALE, spacing, text } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface Props {
  children: string;
  /** Mention mono à droite : « 009 entrées », « unité : reps ». */
  hint?: string;
  /** Contenu à droite (bouton, lien) ; remplace `hint`. */
  right?: ReactNode;
  /** Retire le filet sous le titre. */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

/**
 * Titre de section de la DA « Terminal » : Chakra Petch en capitales à gauche,
 * mention mono à droite, souligné d'un filet sur toute la largeur.
 */
export default function SectionTitle({ children, hint, right, plain = false, style, onPress }: Props) {
  const styles = useThemedStyles(createStyles);

  const title = onPress ? (
    <PressableScale onPress={onPress} accessibilityRole="button" scaleTo={0.98} style={styles.titleWrap}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title} accessibilityRole="header">{children}</Text>
    </PressableScale>
  ) : (
    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, styles.titleWrap]} accessibilityRole="header">{children}</Text>
  );

  return (
    <View style={[styles.row, plain ? null : styles.ruled, style]}>
      {title}
      {right ?? (hint ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.hint}>{hint}</Text> : null)}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
    },
    ruled: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderStrong,
    },
    titleWrap: {
      flexShrink: 1,
    },
    title: {
      ...text.sectionTitle,
      color: theme.colors.text,
    },
    hint: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginBottom: 3,
    },
  });
