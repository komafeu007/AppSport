import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useSheetDrag } from './Sheet';

/** Distance (px) au-delà de laquelle relâcher ferme la feuille. */
const DISMISS_DISTANCE = 72;
/** Vitesse (px/s) d'un lancer vers le bas qui ferme la feuille. */
const DISMISS_VELOCITY = 700;
/** Seuil d'activation du geste (px), pour ne pas voler un simple appui. */
const DRAG_START = 8;

type Props = Omit<ScrollViewProps, 'onScroll' | 'scrollEventThrottle' | 'bounces' | 'overScrollMode'> & {
  scrollRef?: RefObject<ScrollView | null>;
  children: ReactNode;
};

/**
 * `ScrollView` d'une feuille (`Sheet`) qui **suit le doigt** : un glissement
 * vers le bas commencé contenu tout en haut fait descendre la feuille, et la
 * ferme au-delà d'un seuil (distance ou vitesse).
 *
 * Le geste est un `Pan` de Gesture Handler composé *simultanément* avec le
 * geste natif de défilement (`Gesture.Native`) : la vue défilante garde la main
 * sur le scroll, et le pan ne prend le relais que si le contenu est déjà tout en
 * haut — un glissement vers le bas y est alors une fermeture, pas un défilement.
 * C'est la seule façon d'obtenir ce suivi : un `PanResponder` (ou les
 * événements tactiles) est annulé par la vue défilante native dès les premiers
 * pixels, et ses rappels de défilement ne donnent que la vitesse, jamais la
 * position du doigt.
 */
export default function SheetScrollView({ scrollRef, children, ...rest }: Props) {
  const sheetDrag = useSheetDrag();
  /** Le contenu est tout en haut. */
  const atTop = useRef(true);
  /** Le geste en cours a commencé alors que le contenu était en haut. */
  const fromTop = useRef(false);

  const gesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Native(),
        Gesture.Pan()
          // Reanimated n'est pas installé : les rappels restent sur le fil JS.
          .runOnJS(true)
          // S'active en descendant seulement : tirer vers le haut défile.
          .activeOffsetY([-100000, DRAG_START])
          .failOffsetY([-16, 100000])
          .failOffsetX([-24, 24])
          .onStart(() => {
            fromTop.current = atTop.current;
          })
          .onUpdate((event) => {
            if (!fromTop.current) return;
            // On retire le seuil d'activation : la feuille ne saute pas de
            // 8 px au moment où le geste prend la main.
            sheetDrag?.follow(Math.max(0, event.translationY - DRAG_START));
          })
          .onEnd((event) => {
            if (!fromTop.current) return;
            fromTop.current = false;
            const dismiss =
              event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
            sheetDrag?.release(dismiss);
          })
          .onFinalize((_event, success) => {
            // Geste interrompu (appel entrant, doigt levé hors zone…) : la
            // feuille reprend sa place au lieu de rester à mi-chemin.
            if (success || !fromTop.current) return;
            fromTop.current = false;
            sheetDrag?.release(false);
          })
      ),
    [sheetDrag]
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.current = event.nativeEvent.contentOffset.y <= 0;
  };

  return (
    <GestureDetector gesture={gesture}>
      <ScrollView
        ref={scrollRef}
        {...rest}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        // Pas de rebond : c'est la feuille qui suit le doigt, pas le contenu.
        bounces={false}
        overScrollMode="never"
      >
        {children}
      </ScrollView>
    </GestureDetector>
  );
}
