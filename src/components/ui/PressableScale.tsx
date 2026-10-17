import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { spring } from '../../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Échelle pendant l'appui (1 = pas d'animation). */
  scaleTo?: number;
  children?: ReactNode;
}

/**
 * Pressable avec un léger effet d'enfoncement (ressort) — retour tactile commun
 * à tous les éléments cliquables de l'app.
 */
export default function PressableScale({
  style,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, ...spring }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event: GestureResponderEvent) => {
        animate(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        animate(1);
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
