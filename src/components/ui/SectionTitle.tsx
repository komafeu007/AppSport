import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, neutrals } from '../../theme/colors';
import { spacing, text } from '../../theme/tokens';

interface Props {
  children: string;
  /** Précision discrète à côté du titre (ex. « retiré de l'accueil »). */
  hint?: string;
  /** Élément aligné à droite (compteur, boutons). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Titre de section (majuscules, accent) — même style dans tous les écrans. */
export default function SectionTitle({ children, hint, right, style }: Props) {
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  left: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...text.overline,
    color: colors.accent,
    flexShrink: 1,
  },
  hint: {
    ...text.caption,
    color: neutrals.textMuted,
    fontStyle: 'italic',
  },
});
