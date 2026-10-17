import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { neutrals, shadow } from '../../theme/colors';
import { duration, radius, spacing, spring, text } from '../../theme/tokens';

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
 * Feuille basse commune à toutes les modales de l'app : fond assombri, apparition
 * glissée + ressort, et fermeture en touchant **à côté** de la feuille (en plus du
 * bouton de fermeture propre à chaque contenu et du bouton retour Android).
 */
export default function Sheet({ visible, onClose, onDismissed, title, children, style }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // Évite de relancer l'animation quand le parent repasse une nouvelle fonction.
  const dismissed = useRef(onDismissed);
  dismissed.current = onDismissed;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const opening = Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: true,
        ...spring,
      });
      opening.start();
      return () => opening.stop();
    }

    const closing = Animated.timing(progress, {
      toValue: 0,
      duration: duration.base,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    closing.start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      dismissed.current?.();
    });
    return () => closing.stop();
  }, [progress, visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
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
                  translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [64, 0] }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: neutrals.overlay,
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: neutrals.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: neutrals.border,
    maxHeight: '88%',
    ...shadow,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: neutrals.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...text.overline,
    color: neutrals.textMuted,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
});
