import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useReduceMotion } from '../../theme/motion';
import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { scale, MAX_FONT_SCALE, duration, easing, radius, spacing, spring, text } from '../../theme/tokens';
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
 *
 * La sélection est marquée par la couleur **et** par un petit rebond de la
 * puce (échelle 1 → 1,06 → 1) : au doigt, on sent que le choix est pris.
 */
export default function Chip({ label, selected, onPress, onLongPress, accessibilityLabel }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  /** Rebond de sélection (0 = repos, 1 = puce gonflée). */
  const pop = useRef(new Animated.Value(0)).current;
  const wasSelected = useRef(selected);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: duration.fast,
      easing: easing.enter,
      useNativeDriver: false,
    }).start();
  }, [progress, selected]);

  // Pas de rebond au montage (les puces cochées d'un formulaire ne doivent pas
  // toutes sauter en arrivant sur l'écran) : seulement au passage à « cochée ».
  useEffect(() => {
    // Le rebond est du mouvement : il disparaît quand les animations sont réduites
    // (la sélection reste lisible par la couleur et `accessibilityState`).
    if (reduceMotion) {
      wasSelected.current = selected;
      return;
    }
    if (selected && !wasSelected.current) {
      pop.setValue(0);
      Animated.sequence([
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...spring }),
        Animated.spring(pop, { toValue: 0, useNativeDriver: true, ...spring }),
      ]).start();
    }
    wasSelected.current = selected;
  }, [pop, reduceMotion, selected]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.background, theme.colors.selectedSurface],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.borderStrong, theme.colors.selectedSurface],
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
      // 36 px visuels + 6 px de chaque côté = 48 dp de cible (Android).
      hitSlop={{ top: scale(6), bottom: scale(6), left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={{
          transform: [
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          ],
        }}
      >
        <Animated.View style={[styles.chip, { backgroundColor, borderColor }]}>
          <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.label, { color }]}>{label}</Animated.Text>
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    chip: {
      // `minHeight` (et non `height`) : le libellé peut grandir avec la taille
      // de texte système sans être coupé.
      minHeight: scale(36),
      paddingVertical: spacing.xs,
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.lg,
    },
    label: text.label,
  });
