import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { useReduceMotion } from '../../theme/motion';
import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { radius, spacing, text } from '../../theme/tokens';
import Appear from './Appear';
import Icon from './Icon';

export type StateKind = 'loading' | 'error' | 'empty';

interface Props {
  kind: StateKind;
  title?: string;
  message?: string;
  /** Action proposée sous le message (bouton…). */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Marge du schéma : indépendante du thème, donc hors de `createStyles`. */
const markStyles = StyleSheet.create({
  mark: { marginBottom: spacing.xs },
});

/**
 * Schéma de terrain vide (§8.12) : un seul trait marine (la ligne médiane) sur
 * un tracé de craie. C'est le langage « marquage au sol » de la DA — aucune
 * illustration décorative, aucun emoji.
 */
function PitchMark() {
  const theme = useTheme();
  return (
    <Svg
      width={120}
      height={76}
      viewBox="0 0 120 76"
      style={markStyles.mark}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect
        x={1}
        y={1}
        width={118}
        height={74}
        rx={radius.xs}
        stroke={theme.colors.border}
        strokeWidth={2}
        fill="none"
      />
      <Line x1={60} y1={1} x2={60} y2={75} stroke={theme.colors.text} strokeWidth={2} />
      <Circle
        cx={60}
        cy={38}
        r={13}
        stroke={theme.colors.border}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

/**
 * États pleine page (§8.12) : chargement en blocs de craie **statiques** (pas de
 * balayage ni de spinner), erreur avec icône et texte, état vide qui nomme ce
 * qui manque au-dessus d'un schéma de terrain.
 */
export default function StateView({ kind, title, message, action, style }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReduceMotion();

  /*
   * Chargement : les blocs respirent (opacité 0,55 → 1). C'est le seul mouvement
   * de l'écran et il dit « ça travaille » ; avec « Réduire les animations », il
   * reste fixe mais la barre de progression annonce déjà l'attente.
   */
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (kind !== 'loading' || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [kind, pulse, reduceMotion]);
  // Pas de titre générique : quand l'appelant n'en donne pas, son message dit
  // déjà ce qui manque (« Aucun résultat pour « … » »).
  const heading = title ?? (kind === 'error' ? 'Erreur' : null);

  return (
    <Appear style={[styles.center, style]}>
      {kind === 'loading' ? (
        <Animated.View
          style={[styles.skeleton, { opacity: pulse }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Chargement"
        >
          <View style={[styles.skeletonBar, styles.skeletonTitle]} />
          <View style={styles.skeletonBar} />
          <View style={[styles.skeletonBar, styles.skeletonShort]} />
        </Animated.View>
      ) : null}
      {kind === 'error' ? <Icon name="alert" size={36} color={theme.colors.danger} /> : null}
      {kind === 'empty' ? <PitchMark /> : null}
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
    skeleton: {
      width: 240,
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    skeletonBar: {
      height: 12,
      borderRadius: radius.pill,
      backgroundColor: theme.colors.border,
    },
    skeletonTitle: {
      width: 140,
      height: 16,
    },
    skeletonShort: {
      width: '75%',
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
