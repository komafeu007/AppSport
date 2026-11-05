import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReduceMotion } from '../../theme/motion';
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
 *
 * Avec « Réduire les animations », l'échelle ne bouge plus : le contrôle garde
 * son retour natif (opacité/ondulation de la plateforme) et rien ne saute.
 */
export default function PressableScale({
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  /** Retour d'appui sans mouvement : l'opacité baisse pendant le toucher. */
  const [pressed, setPressed] = useState(false);

  const animate = (toValue: number) => {
    if (reduceMotion) return;
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
      style={[
        style,
        { transform: [{ scale }] },
        reduceMotion && pressed ? { opacity: 0.72 } : null,
      ]}
      onPressIn={(event: GestureResponderEvent) => {
        if (reduceMotion) setPressed(true);
        else animate(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        if (reduceMotion) setPressed(false);
        else animate(1);
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
