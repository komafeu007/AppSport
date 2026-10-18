import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../theme';
import { fontFamily } from '../theme/tokens';

export interface RadarPoint {
  label: string;
  value: number;
}

interface Props {
  data: RadarPoint[];
  /** Côté du carré, en px (fourni par l'écran selon la largeur disponible). */
  size: number;
}

const LEVELS = [0.25, 0.5, 0.75, 1];
/** Marge réservée aux libellés autour du cercle. */
const LABEL_PAD = 74;

/**
 * Graphique « araignée » (radar) des muscles travaillés : un axe par muscle,
 * la distance au centre est proportionnelle au volume. Rendu en SVG pur, sans
 * dépendance de charting. Repère en Craie, série en bleu d'action (§10.3).
 */
export default function MuscleRadarChart({ data, size }: Props) {
  const theme = useTheme();
  const count = data.length;
  if (count < 3) return null;

  const max = Math.max(...data.map((point) => point.value), 1);
  const center = size / 2;
  const radius = size / 2 - LABEL_PAD;

  const pointAt = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return {
      x: center + radius * ratio * Math.cos(angle),
      y: center + radius * ratio * Math.sin(angle),
      angle,
    };
  };

  const ring = (ratio: number) =>
    Array.from({ length: count }, (_, index) => {
      const point = pointAt(index, ratio);
      return `${point.x},${point.y}`;
    }).join(' ');

  const shape = data
    .map((point, index) => {
      const at = pointAt(index, point.value / max);
      return `${at.x},${at.y}`;
    })
    .join(' ');

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G>
          {LEVELS.map((ratio) => (
            <Polygon
              key={ratio}
              points={ring(ratio)}
              fill="none"
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {data.map((point, index) => {
            const at = pointAt(index, 1);
            return (
              <Line
                key={point.label}
                x1={center}
                y1={center}
                x2={at.x}
                y2={at.y}
                stroke={theme.colors.border}
                strokeWidth={1}
              />
            );
          })}
        </G>

        <Polygon
          points={shape}
          fill={theme.colors.action}
          fillOpacity={0.22}
          stroke={theme.colors.action}
          strokeWidth={2}
        />

        {data.map((point, index) => {
          const at = pointAt(index, point.value / max);
          return <Circle key={point.label} cx={at.x} cy={at.y} r={3.5} fill={theme.colors.action} />;
        })}

        {data.map((point, index) => {
          const at = pointAt(index, 1.16);
          const cosine = Math.cos(at.angle);
          const anchor = Math.abs(cosine) < 0.3 ? 'middle' : cosine > 0 ? 'start' : 'end';
          return (
            <SvgText
              key={point.label}
              x={at.x}
              y={at.y + 4}
              fill={theme.colors.text}
              fontFamily={fontFamily.textSemiBold}
              fontSize={11}
              textAnchor={anchor}
            >
              {point.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
