import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, neutrals } from '../../theme/colors';
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
 * États pleine page (chargement / erreur / vide) : mêmes marges, mêmes textes et
 * même apparition en fondu dans tous les écrans.
 */
export default function StateView({ kind, title, message, action, style }: Props) {
  const heading = title ?? (kind === 'error' ? 'Erreur' : kind === 'empty' ? 'Rien à afficher' : null);

  return (
    <Appear style={[styles.center, style]}>
      {kind === 'loading' ? <ActivityIndicator color={colors.accent} size="large" /> : null}
      {heading ? (
        <Text style={[styles.title, kind === 'error' && styles.titleError]}>{heading}</Text>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </Appear>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  title: {
    ...text.title,
    color: neutrals.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  titleError: {
    color: colors.alert,
  },
  message: {
    ...text.meta,
    color: neutrals.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
