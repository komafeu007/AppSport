import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { neutrals } from '../../theme/colors';
import { spacing, text } from '../../theme/tokens';
import Appear from './Appear';

interface Props {
  title: string;
  subtitle?: string;
  /** Élément aligné à droite du titre (action, compteur). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** En-tête d'écran (grand titre) partagé par les écrans sans barre native. */
export default function ScreenHeader({ title, subtitle, right, style }: Props) {
  return (
    <Appear style={[styles.header, style]}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {right}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Appear>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...text.screenTitle,
    color: neutrals.text,
  },
  subtitle: {
    ...text.meta,
    color: neutrals.textMuted,
    marginTop: spacing.xs,
  },
});
