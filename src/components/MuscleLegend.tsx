import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { MuscleAmount } from '../domain/muscles';
import { useReduceMotion } from '../theme/motion';
import { useThemedStyles, type Theme } from '../theme';
import { MAX_FONT_SCALE, duration, easing, radius, spacing, text } from '../theme/tokens';

interface Props {
  muscles: readonly MuscleAmount[];
  /** Plus grande valeur : c'est elle qui remplit sa barre. */
  max: number;
  /** Formate la valeur affichée à droite (entier, ou demie pour un secondaire). */
  format: (value: number) => string;
  /** Largeur réservée à la valeur (les séries du groupe n'en ont pas besoin d'autant). */
  valueWidth?: number;
}

/** Décalage entre deux barres au déploiement (ms). */
const STAGGER = 40;

/**
 * Légende du radar : une barre par muscle. Les barres **se déploient** de la
 * gauche au premier affichage (échelle animée depuis 0, origine à gauche),
 * en cascade de 40 ms — c'est un graphique qui se dessine, pas une section qui
 * entre en scène (la DA interdit les animations d'entrée).
 */
export default function MuscleLegend({ muscles, max, format, valueWidth = 64 }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.legend}>
      {muscles.map((muscle, index) => (
        <LegendRow
          key={muscle.key}
          label={muscle.label}
          ratio={Math.max(4, (muscle.amount / max) * 100)}
          value={format(muscle.amount)}
          valueWidth={valueWidth}
          delay={index * STAGGER}
        />
      ))}
    </View>
  );
}

function LegendRow({
  label,
  ratio,
  value,
  valueWidth,
  delay,
}: {
  label: string;
  ratio: number;
  value: string;
  valueWidth: number;
  delay: number;
}) {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReduceMotion();
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      grow.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(grow, {
        toValue: 1,
        duration: duration.slow,
        easing: easing.enter,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, grow, reduceMotion]);

  return (
    <View style={styles.legendRow}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.legendLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.legendTrack}>
        <Animated.View
          style={[
            styles.legendFill,
            { width: `${ratio}%`, transformOrigin: 'left', transform: [{ scaleX: grow }] },
          ]}
        />
      </View>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.legendValue, { minWidth: valueWidth }]}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    legend: {
      gap: spacing.sm,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    legendLabel: {
      ...text.caption,
      color: theme.colors.text,
      width: 88,
    },
    legendTrack: {
      flex: 1,
      height: 8,
      borderRadius: radius.xs,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: 'hidden',
    },
    legendFill: {
      height: 8,
      borderRadius: radius.xs,
      backgroundColor: theme.colors.action,
    },
    legendValue: {
      ...text.monoValue,
      color: theme.colors.text,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
  });
