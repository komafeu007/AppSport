import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { spring } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Apparition en **léger rebond** (échelle 0,6 → 1). Réservé à un élément qui
 * surgit dans un écran déjà affiché — l'étiquette « Record » qui apparaît dès
 * qu'une série bat le record. Ce n'est pas une animation d'entrée de section :
 * la DA les interdit (voir `Appear`, volontairement statique).
 */
export default function PopIn({ children, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, ...spring }).start();
  }, [progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
