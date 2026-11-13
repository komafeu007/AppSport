import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { scale, MAX_FONT_SCALE, spacing, text } from '../../theme/tokens';

export interface StatTile {
  /** Libellé mono : « A.01 Séances », « T.02 Durée ». */
  label: string;
  value: string;
  /** Unité accolée à la valeur (« t ») ou mention dessous (« kg », « min:s »). */
  unit?: string;
  /** Unité dessous plutôt qu'accolée. */
  unitBelow?: boolean;
  /** Valeur en orange (la mesure qui compte). */
  accent?: boolean;
}

interface Props {
  tiles: StatTile[];
  style?: StyleProp<ViewStyle>;
  /** Libellé et chiffre centrés dans chaque tuile (écran de séance). */
  centered?: boolean;
}

/**
 * Bandeau de télémétrie : tuiles côte à côte, séparées par des filets, chacune
 * avec un libellé mono et un chiffre en Chakra Petch. Ce n'est pas une carte
 * (fond transparent) : l'écran garde sa carte unique.
 */
export default function StatTiles({ tiles, style, centered = false }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.grid, style]}>
      {tiles.map((tile, index) => (
        <View
          key={tile.label}
          style={[styles.tile, index > 0 ? styles.divided : null, centered && styles.centered]}
          accessible
          accessibilityLabel={`${tile.label} : ${tile.value}${tile.unit ? ` ${tile.unit}` : ''}`}
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{tile.label}</Text>
          <View style={styles.valueRow}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[styles.value, tile.accent ? styles.accent : null]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {tile.value}
            </Text>
            {tile.unit && !tile.unitBelow ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.unitInline}>{tile.unit}</Text> : null}
          </View>
          {tile.unit && tile.unitBelow ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.unitBelow}>{tile.unit}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    tile: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    centered: { alignItems: 'center' },
    divided: {
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.borderStrong,
    },
    label: {
      ...text.caption,
      fontSize: scale(10),
      lineHeight: scale(14),
      color: theme.colors.textMuted,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    value: {
      ...text.numM,
      color: theme.colors.text,
      flexShrink: 1,
    },
    accent: { color: theme.colors.action },
    unitInline: {
      ...text.caption,
      color: theme.colors.textMuted,
    },
    unitBelow: {
      ...text.caption,
      fontSize: scale(10),
      color: theme.colors.textMuted,
    },
  });
