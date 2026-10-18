import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { duration, easing, radius, spacing, text } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Puce sélectionnable (§8.8) : hauteur visuelle 36, zone tactile étendue à 44,
 * rayon 8. Sélectionnée = fond d'encre (marine en clair, bleu en sombre) et
 * texte clair ; au repos = surface secondaire. Le jaune n'est jamais utilisé
 * pour la sélection.
 */
export default function Chip({ label, selected, onPress, onLongPress, accessibilityLabel }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: duration.fast,
      easing: easing.enter,
      useNativeDriver: false,
    }).start();
  }, [progress, selected]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.surfaceAlt, theme.colors.selectedSurface],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.selectedSurface],
  });
  const color = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.text, theme.colors.onSelected],
  });

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.chip, { backgroundColor, borderColor }]}>
        <Animated.Text style={[styles.label, { color }]}>{label}</Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    chip: {
      height: 36,
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.lg,
    },
    label: text.label,
  });
