import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { spacing, text } from '../../theme/tokens';
import Appear from './Appear';

interface Props {
  title: string;
  subtitle?: string;
  /** Élément aligné à droite du titre (action, compteur). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * En-tête d'écran (§6.2 « titre-1 ») : titre en Big Shoulders, aligné sur la
 * marge de 20 px, sous-titre discret en dessous.
 */
export default function ScreenHeader({ title, subtitle, right, style }: Props) {
  const styles = useThemedStyles(createStyles);

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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
      color: theme.colors.text,
      flexShrink: 1,
    },
    subtitle: {
      ...text.meta,
      color: theme.colors.textMuted,
      marginTop: spacing.xs,
    },
  });
