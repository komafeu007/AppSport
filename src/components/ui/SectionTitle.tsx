import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { spacing, text } from '../../theme/tokens';

interface Props {
  children: string;
  /** Précision discrète à côté du titre (ex. « retiré de l'accueil »). */
  hint?: string;
  /** Élément aligné à droite (compteur, boutons). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Titre de section (§6.2 « titre-2 ») : Big Shoulders, casse de phrase, encre
 * principale. Plus de majuscules espacées : la DA l'interdit (§3).
 */
export default function SectionTitle({ children, hint, right, style }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={styles.title}>{children}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    left: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    title: {
      ...text.sectionTitle,
      color: theme.colors.text,
      flexShrink: 1,
    },
    hint: {
      ...text.caption,
      color: theme.colors.textMuted,
    },
  });
