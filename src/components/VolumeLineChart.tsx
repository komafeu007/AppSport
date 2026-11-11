import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type Theme } from '../theme';
import { MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

export interface VolumeLinePoint {
  label: string;
  value: number;
}

interface Props {
  points: VolumeLinePoint[];
  /** Nombre maximal de lignes affichées (les plus récentes). */
  maxRows?: number;
}

/** 6915 → « 6 915 » (espaces fins). */
function group(value: number): string {
  return String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Évolution du volume d'une séance à l'autre : une ligne par séance (date
 * mono, barre, valeur), la dernière en orange. Cadre au trait, sans carte.
 */
export default function VolumeLineChart({ points, maxRows = 6 }: Props) {
  const styles = useThemedStyles(createStyles);
  const rows = points.slice(-maxRows);
  const count = points.length;
  if (count === 0) return null;

  const max = Math.max(...rows.map((point) => point.value), 1);
  const delta = points[count - 1].value - points[0].value;
  const sign = delta < 0 ? '−' : '+';

  const summary = `Évolution du volume sur ${count} séance${count > 1 ? 's' : ''}, de ${group(
    points[0].value
  )} à ${group(points[count - 1].value)} kg.`;

  return (
    <View style={styles.box} accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={styles.head}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>Évolution du volume</Text>
        {count > 1 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.delta}>
            Δ {sign}
            {group(delta)} KG
          </Text>
        ) : null}
      </View>
      {rows.map((point, index) => {
        const last = index === rows.length - 1;
        return (
          <View key={`${point.label}-${index}`} style={styles.row}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.date}>{point.label}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${(point.value / max) * 100}%` },
                  last ? styles.fillLast : null,
                ]}
              />
            </View>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.value, last ? styles.valueLast : null]}>
              {group(point.value)} KG
            </Text>
          </View>
        );
      })}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>
        {count > 1
          ? `${count} DERNIÈRES SÉANCES · ANCIEN → RÉCENT`
          : 'PREMIÈRE FOIS · REFAIS CETTE SÉANCE POUR COMPARER'}
      </Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    title: {
      ...text.sectionTitle,
      color: theme.colors.text,
      flexShrink: 1,
    },
    delta: {
      ...text.monoValue,
      color: theme.colors.action,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    date: {
      ...text.caption,
      color: theme.colors.textMuted,
      width: 44,
    },
    track: {
      flex: 1,
      height: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    fill: {
      height: 10,
      backgroundColor: theme.colors.textMuted,
    },
    fillLast: {
      backgroundColor: theme.colors.action,
    },
    value: {
      ...text.caption,
      color: theme.colors.textMuted,
      minWidth: 84,
      textAlign: 'right',
    },
    valueLast: {
      ...text.monoValue,
      color: theme.colors.text,
      minWidth: 84,
    },
    caption: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginTop: spacing.xs,
    },
  });
