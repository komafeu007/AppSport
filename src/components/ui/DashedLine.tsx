import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';

interface Props {
  /** Couleur du trait ; filet du thème par défaut. */
  color?: string;
  /** Pointillés (filet de liste) ou points serrés (points de conduite). */
  variant?: 'dashed' | 'dotted';
  style?: StyleProp<ViewStyle>;
}

/**
 * Filet en pointillés de la DA « Terminal » (séparateur de liste, points de
 * conduite « EXERCICES ……… 06 »). React Native ne dessine pas un `borderTop`
 * pointillé seul de façon fiable sur Android : on trace une boîte pointillée de
 * 2 px de haut dont seul le bord supérieur reste visible.
 */
export default function DashedLine({ color, variant = 'dashed', style }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.clip, style]} pointerEvents="none">
      <View
        style={[
          styles.line,
          { borderStyle: variant },
          color ? { borderColor: color } : null,
        ]}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    clip: {
      height: 1,
      overflow: 'hidden',
    },
    line: {
      height: 3,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
  });
