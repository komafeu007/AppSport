import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { colors, neutrals } from '../../theme/colors';
import { duration, radius, spacing } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Puce sélectionnable (choix de groupe, barre, disque…). La sélection est
 * animée (fond, bordure et texte) au lieu de basculer d'un coup.
 */
export default function Chip({ label, selected, onPress, onLongPress, accessibilityLabel }: Props) {
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: duration.fast,
      useNativeDriver: false,
    }).start();
  }, [progress, selected]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [neutrals.surface, colors.secondary],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [neutrals.border, colors.secondary],
  });
  const color = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [neutrals.textMuted, colors.background],
  });

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      scaleTo={0.94}
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

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
