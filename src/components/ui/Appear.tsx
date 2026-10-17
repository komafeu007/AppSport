import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { duration } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  /** Retard avant l'apparition (pour un effet d'escalier : index × 60 ms). */
  delay?: number;
  /** Décalage vertical au départ (px). */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Apparition douce (fondu + léger glissement vers le haut) au montage.
 * Sert aux cartes, sections et listes pour donner du rythme à l'ouverture d'un écran.
 */
export default function Appear({ children, delay = 0, offset = 12, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: duration.slow,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
