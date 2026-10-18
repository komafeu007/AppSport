import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { duration, easing } from '../../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Échelle pendant l'appui (1 = pas d'animation). */
  scaleTo?: number;
  children?: ReactNode;
}

/**
 * Retour tactile commun à tous les éléments cliquables : léger enfoncement de
 * 100 ms (§11.2 « appui »). Pas de rebond : la DA veut un mouvement qui répond
 * au geste, pas un effet décoratif.
 */
export default function PressableScale({
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: duration.pressed,
      easing: easing.enter,
      useNativeDriver: true,
    }).start();
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
