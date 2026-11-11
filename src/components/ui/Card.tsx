import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { MAX_FONT_SCALE, fontFamily, spacing } from '../../theme/tokens';
import PressableScale from './PressableScale';

export type CardTone = 'default' | 'accent' | 'danger' | 'marker' | 'success';

interface Props {
  children: ReactNode;
  tone?: CardTone;
  /**
   * Repères de visée « + » orange aux quatre coins (carte de la prochaine
   * séance). Réservés à la carte principale de l'écran.
   */
  crosshair?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Carte de la DA « Terminal » : surface carbone, angles vifs, filet de 1 px.
 * Toujours **une seule carte par écran** (l'objet principal). `marker` porte un
 * bandeau jaune en haut (records), `accent` un filet orange.
 */
export default function Card({
  children,
  tone = 'default',
  crosshair = false,
  onPress,
  onLongPress,
  disabled = false,
  accessibilityLabel,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const cardStyle = [styles.card, styles[tone], crosshair ? styles.withMarks : null, style];

  const marks = crosshair ? (
    <>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.mark, styles.markTL]}>+</Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.mark, styles.markTR]}>+</Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.mark, styles.markBL]}>+</Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.mark, styles.markBR]}>+</Text>
    </>
  ) : null;

  if (!onPress && !onLongPress) {
    return (
      <View style={cardStyle}>
        {marks}
        {children}
      </View>
    );
  }

  return (
    <PressableScale
      style={cardStyle}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      scaleTo={0.99}
    >
      {marks}
      {children}
    </PressableScale>
  );
}

const MARK = 14;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      padding: spacing.lg,
    },
    withMarks: { overflow: 'visible' },
    default: {},
    accent: { borderColor: theme.colors.action },
    danger: { borderColor: theme.colors.danger },
    marker: { borderColor: theme.colors.marker, borderTopWidth: 8 },
    success: { borderColor: theme.colors.success },
    mark: {
      position: 'absolute',
      width: MARK,
      height: MARK,
      textAlign: 'center',
      fontFamily: fontFamily.mono,
      fontSize: 16,
      lineHeight: MARK,
      color: theme.colors.action,
      // Le symbole reste décoratif : pas lu par le lecteur d'écran.
      includeFontPadding: false,
    },
    markTL: { top: -MARK / 2 - 1, left: -MARK / 2 - 1 },
    markTR: { top: -MARK / 2 - 1, right: -MARK / 2 - 1 },
    markBL: { bottom: -MARK / 2 - 1, left: -MARK / 2 - 1 },
    markBR: { bottom: -MARK / 2 - 1, right: -MARK / 2 - 1 },
  });
