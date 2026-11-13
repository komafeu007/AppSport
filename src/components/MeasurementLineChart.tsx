import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { useThemedStyles, useTheme, type Theme } from '../theme';
import { scale, MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

export interface MeasurementPoint {
  /** Libellé de date (« 07.11 »). */
  label: string;
  value: number;
}

interface Props {
  /** Points dans l'ordre chronologique (le plus ancien d'abord). */
  points: MeasurementPoint[];
  height?: number;
  /** Mini-courbe sans axes ni dates (ligne de liste). */
  compact?: boolean;
  /** Format des valeurs d'axe (« 38,5 »). */
  formatValue?: (value: number) => string;
  accessibilityLabel?: string;
}

/**
 * Courbe d'évolution d'une mesure : trait crème, dernier point en orange
 * (la mesure qui compte), bornes min/max à gauche et dates aux extrémités.
 * En `compact`, c'est une mini-courbe sans texte pour les lignes de liste.
 */
export default function MeasurementLineChart({
  points,
  height = scale(120),
  compact = false,
  formatValue = (value) => String(value),
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [width, setWidth] = useState(0);

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = compact ? 3 : 6;

  const coords = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (points.length - 1),
    y: pad + (1 - (point.value - min) / span) * (height - pad * 2),
  }));
  const last = coords[coords.length - 1];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.plotRow}>
        {compact ? null : (
          <View style={[styles.axis, { height }]}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.axisText}>{formatValue(max)}</Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.axisText}>{formatValue(min)}</Text>
          </View>
        )}
        <View style={[styles.plot, { height }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {width > 0 && points.length > 0 ? (
            <Svg width={width} height={height}>
              {compact ? null : (
                <>
                  <Line x1={0} y1={pad} x2={width} y2={pad} stroke={theme.colors.border} strokeWidth={1} strokeDasharray="2 3" />
                  <Line
                    x1={0}
                    y1={height - pad}
                    x2={width}
                    y2={height - pad}
                    stroke={theme.colors.border}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                </>
              )}
              {coords.length > 1 ? (
                <Polyline
                  points={coords.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={theme.colors.text}
                  strokeWidth={compact ? 1.5 : 2}
                  strokeLinejoin="miter"
                />
              ) : null}
              {compact
                ? null
                : coords.slice(0, -1).map((point, index) => (
                    <Circle key={index} cx={point.x} cy={point.y} r={2.5} fill={theme.colors.text} />
                  ))}
              <Circle cx={last.x} cy={last.y} r={compact ? 2.5 : 4} fill={theme.colors.action} />
            </Svg>
          ) : null}
        </View>
      </View>
      {compact || points.length === 0 ? null : (
        <View style={styles.dates}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.axisText}>{points[0].label}</Text>
          {points.length > 1 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.axisText}>{points[points.length - 1].label}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    plotRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    axis: {
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    plot: {
      flex: 1,
    },
    dates: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    axisText: {
      ...text.caption,
      fontSize: scale(10),
      lineHeight: scale(14),
      color: theme.colors.textMuted,
    },
  });
