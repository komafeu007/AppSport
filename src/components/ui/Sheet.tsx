import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedStyles, type Theme } from '../../theme';
import { duration, easing, radius, spacing, text } from '../../theme/tokens';

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
 * Feuille basse commune à toutes les modales de l'app (§8.10) : coins à 20,
 * poignée 36 × 4, voile d'encre, **seule ombre autorisée** de l'app, et
 * fermeture en touchant à côté de la feuille.
 */
export default function Sheet({ visible, onClose, onDismissed, title, children, style }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // Évite de relancer l'animation quand le parent repasse une nouvelle fonction.
  const dismissed = useRef(onDismissed);
  dismissed.current = onDismissed;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const opening = Animated.timing(progress, {
        toValue: 1,
        duration: duration.slow,
        easing: easing.enter,
        useNativeDriver: true,
      });
      opening.start();
      return () => opening.stop();
    }

    const closing = Animated.timing(progress, {
      toValue: 0,
      duration: duration.slow,
      easing: easing.exit,
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
      borderColor: theme.colors.border,
      maxHeight: '88%',
      ...theme.shadow,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: theme.colors.border,
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
