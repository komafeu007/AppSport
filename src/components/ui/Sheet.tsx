import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '../../theme/motion';
import { useThemedStyles, type Theme } from '../../theme';
import { MAX_FONT_SCALE, duration, easing, radius, spacing, spring, text } from '../../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Appelé une fois la fermeture terminée (pour enchaîner une modale/écran). */
  onDismissed?: () => void;
  /** Titre optionnel, affiché sous la poignée. */
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pilotage du glissement de la feuille, fourni aux contenus défilants (voir
 * `useSheetDrag`). Le contenu décide *quand* le geste compte (par exemple
 * seulement quand son défilement est en haut), puis la feuille suit le doigt.
 */
export interface SheetDrag {
  /** La feuille suit le doigt : `dy` = distance vers le bas, en px. */
  follow: (dy: number) => void;
  /** Fin du geste : ferme la feuille si `dismiss`, sinon elle reprend sa place. */
  release: (dismiss: boolean) => void;
}

const SheetDragContext = createContext<SheetDrag | null>(null);

/** Glissement de la feuille la plus proche (null hors d'une feuille). */
export function useSheetDrag(): SheetDrag | null {
  return useContext(SheetDragContext);
}

/**
 * Feuille basse commune à toutes les modales de l'app (§8.10) : coins à 20,
 * poignée 36 × 4, voile d'encre, **seule ombre autorisée** de l'app, et
 * fermeture en touchant à côté de la feuille.
 */
export default function Sheet({ visible, onClose, onDismissed, title, children, style }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  // « Réduire les animations » : la feuille apparaît et disparaît sans glisser,
  // mais elle reste pilotée par la même animation (durée nulle) pour que le
  // montage/démontage et `onDismissed` gardent leur ordre.
  const motionDuration = useReduceMotion() ? 0 : duration.slow;
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // Décalage du glissement en cours (feuille tirée vers le bas).
  const dragY = useRef(new Animated.Value(0)).current;
  // Évite de relancer l'animation quand le parent repasse une nouvelle fonction.
  const dismissed = useRef(onDismissed);
  dismissed.current = onDismissed;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const drag = useMemo<SheetDrag>(
    () => ({
      follow: (dy) => dragY.setValue(Math.max(0, dy)),
      release: (dismiss) => {
        if (dismiss) {
          // La feuille finit sa course hors de l'écran avant de fermer : un
          // retour à zéro la ferait remonter juste avant de disparaître.
          Animated.timing(dragY, {
            toValue: 1200,
            duration: motionDuration === 0 ? 0 : 180,
            easing: easing.exit,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) closeRef.current();
          });
          return;
        }
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, ...spring }).start();
      },
    }),
    [dragY, motionDuration]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.setValue(0);
      const opening = Animated.timing(progress, {
        toValue: 1,
        duration: motionDuration,
        easing: easing.enter,
        useNativeDriver: true,
      });
      opening.start();
      return () => opening.stop();
    }

    const closing = Animated.timing(progress, {
      toValue: 0,
      duration: motionDuration,
      easing: easing.exit,
      useNativeDriver: true,
    });
    closing.start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      dismissed.current?.();
    });
    return () => closing.stop();
  }, [dragY, motionDuration, progress, visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* `Modal` ouvre une racine native séparée : Gesture Handler a besoin de
          son propre point d'ancrage à l'intérieur pour les gestes du contenu. */}
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <Animated.View
            style={[
              styles.backdrop,
              {
                // Le voile s'éclaircit à mesure que la feuille descend.
                opacity: Animated.multiply(
                  progress,
                  dragY.interpolate({
                    inputRange: [0, 320],
                    outputRange: [1, 0.25],
                    extrapolate: 'clamp',
                  })
                ),
              },
            ]}
          >
            <Pressable
              style={styles.backdropPress}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom },
              style,
              {
                transform: [
                  {
                    translateY: Animated.add(
                      progress.interpolate({ inputRange: [0, 1], outputRange: [64, 0] }),
                      dragY
                    ),
                  },
                ],
              },
            ]}
          >
            <View style={styles.handle} />
            {title ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>{title}</Text> : null}
            <SheetDragContext.Provider value={drag}>{children}</SheetDragContext.Provider>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
    backdropPress: {
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.colors.borderStrong,
      // Filet orange en tête : la feuille est « l'opération en cours ».
      borderTopWidth: 2,
      borderTopColor: theme.colors.action,
      maxHeight: '88%',
      ...theme.shadow,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      backgroundColor: theme.colors.borderStrong,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    title: {
      ...text.label,
      color: theme.colors.textMuted,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
  });
