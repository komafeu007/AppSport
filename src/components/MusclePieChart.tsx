import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme';

interface Slice {
  label: string;
  value: number;
}

interface Props {
  data: Slice[];
  size: number;
}

const PALETTE = [
  '#2347D6',
  '#FFD60A',
  '#187A41',
  '#D1273B',
  '#5B6478',
  '#0D1B4C',
  '#7A8699',
  '#B0B7C3',
];

function sectorPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export default function MusclePieChart({ data, size }: Props) {
  const theme = useTheme();
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;

  const center = size / 2;
  const radius = size / 2 - 4;

  let cursor = -Math.PI / 2;
  const slices = data.map((slice, index) => {
    const angle = (slice.value / total) * Math.PI * 2;
    const start = cursor;
    const end = cursor + angle;
    cursor = end;
    return {
      ...slice,
      path: sectorPath(center, center, radius, start, end),
      color: PALETTE[index % PALETTE.length],
    };
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {slices.map((slice) => (
          <Path
            key={slice.label}
            d={slice.path}
            fill={slice.color}
            stroke={theme.colors.background}
            strokeWidth={1}
          />
        ))}
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