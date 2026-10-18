import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Enveloppe de section. Elle n'anime plus rien : la DA interdit les apparitions
 * automatiques (§11.1 « Aucune animation d'apparition automatique sur les
 * sections »). Le composant reste en place pour garder une enveloppe unique aux
 * sections des écrans, sans changer leur structure.
 */
export default function Appear({ children, style }: Props) {
  return <View style={style}>{children}</View>;
}
