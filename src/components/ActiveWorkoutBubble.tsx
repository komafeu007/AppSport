import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainScreenNavigation } from '../navigation/types';
import { useAccount } from '../services/account';
import { abandonActiveWorkout, loadActiveWorkout, useActiveWorkout } from '../services/activeWorkout';
import { useThemedStyles, type Theme } from '../theme';
import { duration, easing, radius, spacing, spring, text, touch, fontFamily } from '../theme/tokens';
import { ConfirmSheet, PressableScale, type ConfirmRequest } from './ui';

/** Hauteur de la barre d'onglets (§8.9) : la bulle flotte juste au-dessus. */
const TAB_BAR_HEIGHT = 56;

/**
 * Place à réserver en bas des écrans à onglets : la bulle flotte au-dessus de
 * leur contenu, ils doivent donc laisser cette hauteur libre.
 */
export const ACTIVE_WORKOUT_BUBBLE_SPACE = touch.session + spacing.md * 2;

/**
 * Bulle de reprise, en bas des onglets : une séance quittée en cours de route
 * reste accessible d'un appui, sans recommencer. Elle flotte grâce à sa couleur
 * d'action (la DA n'autorise qu'une seule ombre, celle des feuilles) et se
 * ferme avec le « × » (abandon de la séance).
 */
export default function ActiveWorkoutBubble() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MainScreenNavigation>();
  const { accountId } = useAccount();
  const draft = useActiveWorkout();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // La séance en cours vit en mémoire : on la relit au premier affichage et à
  // chaque changement de profil.
  useEffect(() => {
    if (accountId !== null) void loadActiveWorkout(accountId);
  }, [accountId]);

  /*
   * La bulle apparaît (et disparaît) en glissant depuis le bas, pour ne pas
   * surgir d'un coup sous les yeux. Elle garde son dernier contenu pendant la
   * sortie : le brouillon est déjà effacé quand l'animation démarre.
   */
  const visible = draft !== null;
  const [rendered, setRendered] = useState(visible);
  const lastDraft = useRef(draft);
  if (draft !== null) lastDraft.current = draft;
  const slide = useRef(new Animated.Value(visible ? 0 : 1)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, ...spring }).start();
      return;
    }
    Animated.timing(slide, {
      toValue: 1,
      duration: duration.fast,
      easing: easing.exit,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [slide, visible]);

  const shown = rendered ? lastDraft.current : null;
  const total = shown?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? 0;
  const done =
    shown?.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
      0
    ) ?? 0;

  const abandon = () => {
    setConfirm({
      title: 'Abandonner la séance en cours ?',
      message:
        'Les séries déjà validées ne seront pas enregistrées. Les poids saisis restent dans le programme.',
      confirmLabel: 'Abandonner',
      cancelLabel: 'Continuer',
      destructive: true,
      onConfirm: () => {
        if (accountId !== null) void abandonActiveWorkout(accountId);
      },
    });
  };

  return (
    <>
      {shown !== null ? (
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            styles.wrap,
            {
              bottom: TAB_BAR_HEIGHT + insets.bottom + spacing.md,
              opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                {
                  // Glisse sous la barre d'onglets en disparaissant.
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, touch.session],
                  }),
                },
              ],
            },
          ]}
        >
          <PressableScale
            style={styles.bubble}
            onPress={() => navigation.navigate('LiveWorkout', { programId: shown.program_id })}
            accessibilityRole="button"
            accessibilityLabel={`Reprendre la séance ${shown.nom}`}
          >
            <View style={styles.labels}>
              <Text style={styles.title}>Reprendre la séance</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {shown.nom} · {done}/{total} série{total > 1 ? 's' : ''}
              </Text>
            </View>
            <PressableScale
              style={styles.close}
              onPress={abandon}
              accessibilityRole="button"
              accessibilityLabel="Abandonner la séance en cours"
              scaleTo={0.9}
              hitSlop={8}
            >
              <Text style={styles.closeGlyph}>×</Text>
            </PressableScale>
          </PressableScale>
        </Animated.View>
      ) : null}

      {/* Hors du test sur `draft` : la feuille garde son animation de fermeture
          au moment où la séance abandonnée fait disparaître la bulle. */}
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: spacing.xl,
      right: spacing.xl,
    },
    bubble: {
      minHeight: touch.session,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingLeft: spacing.lg,
      paddingRight: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.button,
      backgroundColor: theme.colors.action,
    },
    labels: {
      flex: 1,
    },
    title: {
      ...text.label,
      color: theme.colors.onAction,
    },
    meta: {
      ...text.caption,
      color: theme.colors.onAction,
      marginTop: 2,
    },
    close: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeGlyph: {
      // Même glyphe que `IconButton` : le × reste dans la police de texte.
      fontFamily: fontFamily.textBold,
      fontSize: 18,
      lineHeight: 22,
      color: theme.colors.onAction,
    },
  });
