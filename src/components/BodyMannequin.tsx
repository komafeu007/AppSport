import Svg, { G, Line, Polygon } from 'react-native-svg';

import type { MeasurementZone } from '../domain/bodyMeasurements';
import { useTheme } from '../theme';

/** Cadre du dessin (unités SVG). */
const VIEW_W = 120;
const VIEW_H = 220;

type Shape = { zone: MeasurementZone | null; points: number[] };

/**
 * Moitié gauche du mannequin, vue de face, en facettes à angles vifs (DA
 * « Terminal ») ; la moitié droite est son miroir. Les pièces sans zone
 * (tête, mains, pieds) sont décoratives. De petits jours séparent les pièces :
 * on lit un plan technique éclaté plutôt qu'une silhouette.
 */
const LEFT: Shape[] = [
  { zone: 'epaules', points: [50, 42, 36, 45, 29, 60, 44, 56] },
  { zone: 'bras', points: [29, 62, 43, 58, 41, 84, 27, 87] },
  { zone: 'avant_bras', points: [27, 89, 41, 86, 38, 114, 27, 114] },
  { zone: null, points: [27, 116, 38, 116, 36, 126, 28, 126] },
  { zone: 'cuisse', points: [44, 124, 59, 124, 58, 170, 47, 170] },
  { zone: 'mollet', points: [47, 174, 58, 174, 57, 208, 49, 208] },
  { zone: null, points: [48, 210, 57, 210, 59, 217, 45, 217] },
];

const CENTER: Shape[] = [
  { zone: null, points: [51, 6, 69, 6, 73, 18, 69, 30, 51, 30, 47, 18] },
  { zone: 'cou', points: [54, 32, 66, 32, 67, 40, 53, 40] },
  { zone: 'pectoraux', points: [52, 42, 68, 42, 74, 56, 72, 74, 48, 74, 46, 56] },
  { zone: 'abdos', points: [48, 76, 72, 76, 70, 104, 50, 104] },
  { zone: 'fessiers', points: [50, 106, 70, 106, 76, 122, 44, 122] },
];

const mirror = (points: number[]) => points.map((value, index) => (index % 2 === 0 ? VIEW_W - value : value));

const SHAPES: Shape[] = [
  ...CENTER,
  ...LEFT,
  ...LEFT.map((shape) => ({ zone: shape.zone, points: mirror(shape.points) })),
];

interface Props {
  width: number;
  /** Zones qui ont déjà une mesure (remplies). */
  measured: ReadonlySet<MeasurementZone>;
  selected: MeasurementZone | null;
  onSelect: (zone: MeasurementZone) => void;
}

/**
 * Mannequin interactif des mensurations : toucher une zone la sélectionne
 * (aplat orange, couleur d'action). Une zone mesurée est pleine, une zone
 * vide n'a qu'un contour pointillé. Les zones paires (bras, cuisses…)
 * répondent des deux côtés.
 */
export default function BodyMannequin({ width, measured, selected, onSelect }: Props) {
  const theme = useTheme();
  const height = (width * VIEW_H) / VIEW_W;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      {/* Axe de symétrie : repère de plan technique. */}
      <Line
        x1={VIEW_W / 2}
        y1={0}
        x2={VIEW_W / 2}
        y2={VIEW_H}
        stroke={theme.colors.border}
        strokeWidth={0.6}
        strokeDasharray="2 3"
      />
      {SHAPES.map((shape, index) => {
        const points = shape.points.join(' ');
        if (shape.zone === null) {
          return (
            <Polygon
              key={index}
              points={points}
              fill="none"
              stroke={theme.colors.borderStrong}
              strokeWidth={0.8}
            />
          );
        }
        const zone = shape.zone;
        const isSelected = zone === selected;
        const isMeasured = measured.has(zone);
        return (
          <G key={index} onPress={() => onSelect(zone)}>
            <Polygon
              points={points}
              // Fond plein même pour une zone vide : sinon le toucher ne la trouve pas.
              fill={
                isSelected
                  ? theme.colors.action
                  : isMeasured
                    ? theme.colors.surfaceAlt
                    : theme.colors.surface
              }
              stroke={isSelected ? theme.colors.action : isMeasured ? theme.colors.textMuted : theme.colors.borderStrong}
              strokeWidth={0.8}
              strokeDasharray={isSelected || isMeasured ? undefined : '2 1.5'}
            />
          </G>
        );
      })}
    </Svg>
  );
}
