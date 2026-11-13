import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { MuscleAmount } from '../domain/muscles';
import { useReduceMotion } from '../theme/motion';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { scale, MAX_FONT_SCALE, duration, easing, spacing, text } from '../theme/tokens';

interface Props {
  muscles: readonly MuscleAmount[];
  /** Formate la valeur affichée à droite. */
  format: (value: number) => string;
}

const LABEL_WIDTH = scale(84);
const VALUE_WIDTH = scale(40);
const BAR_HEIGHT = scale(12);
const CUT = 6;
const STAGGER = 40;

/**
 * Charge par muscle : barres horizontales orange sur une piste sombre, coupe
 * diagonale en bout de barre, tri décroissant, graduation `0 … max` dessous.
 * Les barres se déploient une fois à l'arrivée des données (le dessin de la
 * figure, pas l'entrée d'une section).
 */
export default function MuscleBarChart({ muscles, format }: Props) {
  const styles = useThemedStyles(createStyles);
  const sorted = [...muscles].sort((a, b) => b.amount - a.amount);
  const max = Math.max(...sorted.map((muscle) => muscle.amount), 1);

  return (
    <View>
      {sorted.map((muscle, index) => (
        <BarRow
          key={muscle.key}
          label={muscle.label}
          ratio={Math.max(0.03, muscle.amount / max)}
          value={format(muscle.amount)}
          delay={index * STAGGER}
        />
      ))}
      <View style={styles.axis}>
        <View style={styles.axisSpacer} />
        <View style={styles.ticks}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.tick}>0</Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.tick}>|</Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.tick}>|</Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.tick}>{format(max)}</Text>
        </View>
        <View style={styles.valueSpacer} />
      </View>
    </View>
  );
}

function BarRow({
  label,
  ratio,
  value,
  delay,
}: {
  label: string;
  ratio: number;
  value: string;
  delay: number;
}) {
  const theme = useTheme();
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
    <View style={styles.row} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: `${ratio * 100}%`, transformOrigin: 'left', transform: [{ scaleX: grow }] },
          ]}
        >
          <Svg width={CUT} height={CUT} style={styles.cut}>
            <Polygon
              points={`${CUT},0 ${CUT},${CUT} 0,${CUT}`}
              fill={theme.colors.background}
            />
          </Svg>
        </Animated.View>
      </View>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.value}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs + 2,
    },
    label: {
      ...text.caption,
      color: theme.colors.text,
      width: LABEL_WIDTH,
    },
    track: {
      flex: 1,
      height: BAR_HEIGHT,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    fill: {
      height: BAR_HEIGHT - 2,
      backgroundColor: theme.colors.action,
    },
    cut: {
      position: 'absolute',
      right: 0,
      bottom: 0,
    },
    value: {
      ...text.monoValue,
      color: theme.colors.text,
      width: VALUE_WIDTH,
      textAlign: 'right',
    },
    axis: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    axisSpacer: { width: LABEL_WIDTH },
    valueSpacer: { width: VALUE_WIDTH },
    ticks: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tick: {
      ...text.caption,
      fontSize: scale(10),
      color: theme.colors.textMuted,
    },
  });
