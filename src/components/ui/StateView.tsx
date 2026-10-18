import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { spacing, text } from '../../theme/tokens';
import Appear from './Appear';

export type StateKind = 'loading' | 'error' | 'empty';

interface Props {
  kind: StateKind;
  title?: string;
  message?: string;
  /** Action proposée sous le message (bouton…). */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * États pleine page (§8.12) : chargement sans effet de balayage, erreur qui dit
 * ce qui s'est passé et quoi faire, état vide qui nomme ce qui manque.
 */
export default function StateView({ kind, title, message, action, style }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const heading = title ?? (kind === 'error' ? 'Erreur' : kind === 'empty' ? 'Rien à afficher' : null);

  return (
    <Appear style={[styles.center, style]}>
      {kind === 'loading' ? <ActivityIndicator color={theme.colors.action} size="large" /> : null}
      {heading ? (
        <Text style={[styles.title, kind === 'error' && styles.titleError]}>{heading}</Text>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </Appear>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxxl,
    },
    title: {
      ...text.title,
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    titleError: {
      color: theme.colors.danger,
    },
    message: {
      ...text.meta,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    action: {
      marginTop: spacing.lg,
      alignSelf: 'stretch',
    },
  });
