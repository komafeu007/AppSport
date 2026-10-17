import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { colors, neutrals } from '../theme/colors';

export interface VolumeLinePoint {
  label: string;
  value: number;
}

interface Props {
  points: VolumeLinePoint[];
  height?: number;
}

const PAD = { left: 40, right: 14, top: 16, bottom: 24 };

/** Volume compact pour l'axe : 1250 → « 1,3k ». */
function formatCompact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')}k`;
  return String(Math.round(value));
}

/**
 * Courbe d'évolution du volume total d'une séance à l'autre. La largeur est
 * mesurée au rendu pour rester responsive ; rendu en SVG pur.
 */
export default function VolumeLineChart({ points, height = 170 }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next !== width) setWidth(next);
  };

  const count = points.length;
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin;
  const pad = span > 0 ? span * 0.18 : Math.max(rawMax * 0.1, 1);
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);

  const x = (index: number) =>
    count <= 1 ? PAD.left + plotW / 2 : PAD.left + (plotW * index) / (count - 1);
  const y = (value: number) =>
    max === min ? PAD.top + plotH / 2 : PAD.top + plotH * (1 - (value - min) / (max - min));

  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point.value)}`).join(' ');
  const area = `${path} L${x(count - 1)} ${PAD.top + plotH} L${x(0)} ${PAD.top + plotH} Z`;

  const ticks = [0, 0.5, 1];

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout}>
      {width > 0 && count > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((ratio) => {
            const lineY = PAD.top + plotH * (1 - ratio);
            return (
              <Line
                key={ratio}
                x1={PAD.left}
                y1={lineY}
                x2={width - PAD.right}
                y2={lineY}
                stroke={neutrals.border}
                strokeWidth={1}
              />
            );
          })}
          {ticks.map((ratio) => {
            const value = min + (max - min) * ratio;
            const lineY = PAD.top + plotH * (1 - ratio);
            return (
              <SvgText
                key={`label-${ratio}`}
                x={PAD.left - 6}
                y={lineY + 3.5}
                fill={neutrals.textMuted}
                fontSize={10}
                textAnchor="end"
              >
                {formatCompact(value)}
              </SvgText>
            );
          })}

          {count > 1 ? <Path d={area} fill={colors.accent} fillOpacity={0.12} /> : null}
          {count > 1 ? (
            <Path d={path} fill="none" stroke={colors.accent} strokeWidth={2.5} />
          ) : null}

          {points.map((point, index) => (
            <Circle
              key={line + index}
              cx={x(index)}
              cy={y(point.value)}
              r={index === count - 1 ? 5 : 3.5}
              fill={index === count - 1 ? colors.accent : colors.background}
              stroke={colors.accent}
              strokeWidth={2}
            />
          ))}

          {points.map((point, index) => {
            const everyOther = count > 7 && index % 2 === 1 && index !== count - 1;
            if (everyOther) return null;
            return (
              <SvgText
                key={`date-${index}`}
                x={x(index)}
                y={height - 8}
                fill={neutrals.textMuted}
                fontSize={10}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    justifyContent: 'center',
  },
});
