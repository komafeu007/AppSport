import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon, { type IconName } from '../components/ui/Icon';
import PressableScale from '../components/ui/PressableScale';
import { useReduceMotion } from '../theme/motion';
import { useThemedStyles, useTheme, type Theme } from '../theme';
import { duration, easing, spacing, spring, text } from '../theme/tokens';

/** Largeur du trait de ligne de départ (§8.9). */
const START_LINE_WIDTH = 40;

/** Icône de chaque onglet (DA §8.9 : icône 24 px + libellé 12/500). */
const TAB_ICONS: Record<string, IconName> = {
  Main: 'home',
  Seance: 'sessions',
};

/**
 * Barre d'onglets « ligne de départ » (§8.9) : fond surface, filet supérieur de
 * 1 px, hauteur 56 + zone de sécurité basse. L'onglet actif est en bleu court et
 * porte un trait de 3 px en haut, à la manière d'une ligne de départ. Ce trait
 * **glisse** d'un onglet à l'autre au lieu de sauter. Ni pastille flottante ni
 * ombre : l'app n'a qu'une carte et qu'une ombre (les feuilles).
 */
export default function StartLineTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  // Le trait glisse d'un onglet à l'autre ; mouvement réduit = il saute d'un coup.
  const reduceMotion = useReduceMotion();
  const [barWidth, setBarWidth] = useState(0);
  const labels = useRef(
    state.routes.map((_, position) => new Animated.Value(position === state.index ? 1 : 0))
  ).current;
  /** Position du trait, en « onglets » (0 = premier). */
  const position = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    state.routes.forEach((_, index) => {
      Animated.timing(labels[index], {
        toValue: index === state.index ? 1 : 0,
        duration: reduceMotion ? 0 : duration.fast,
        easing: easing.enter,
        useNativeDriver: false,
      }).start();
    });
  }, [labels, reduceMotion, state.index, state.routes]);

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(state.index);
      return;
    }
    Animated.spring(position, { toValue: state.index, useNativeDriver: true, ...spring }).start();
  }, [position, reduceMotion, state.index]);

  const count = state.routes.length;
  const slot = count > 0 ? barWidth / count : 0;
  // Tant que la largeur n'est pas mesurée (première image), on garde le trait
  // statique sous l'onglet actif : impossible de le placer autrement.
  const canSlide = barWidth > 0 && count > 1;

  return (
    <View
      style={[styles.wrap, { paddingBottom: insets.bottom }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {canSlide ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.startLine,
            {
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, count - 1],
                    outputRange: [
                      slot / 2 - START_LINE_WIDTH / 2,
                      barWidth - slot / 2 - START_LINE_WIDTH / 2,
                    ],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key]?.options;
        const label = options?.title ?? route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <PressableScale
            key={route.key}
            onPress={onPress}
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            style={styles.tab}
          >
            {!canSlide && focused ? <View style={styles.startLine} /> : null}
            <View style={styles.tabContent}>
              <View style={styles.iconWrap}>
                <Animated.View
                  style={{
                    opacity: labels[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                  }}
                >
                  <Icon name={TAB_ICONS[route.name] ?? 'dot'} size={24} color={theme.colors.textMuted} />
                </Animated.View>
                <Animated.View style={[styles.iconOverlay, { opacity: labels[index] }]}>
                  <Icon name={TAB_ICONS[route.name] ?? 'dot'} size={24} color={theme.colors.action} />
                </Animated.View>
              </View>
              <Animated.Text
                style={[
                  styles.label,
                  {
                    color: labels[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [theme.colors.textMuted, theme.colors.action],
                    }),
                  },
                ]}
              >
                {label}
              </Animated.Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      // Hauteur minimale : le libellé suit la taille de texte du système.
      minHeight: 56,
      paddingVertical: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    startLine: {
      position: 'absolute',
      top: 0,
      width: START_LINE_WIDTH,
      height: 3,
      backgroundColor: theme.colors.action,
    },
    tabContent: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    iconWrap: {
      width: 24,
      height: 24,
    },
    iconOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    // DA §8.9 : libellé 12 / 500, toujours visible sous l'icône de 24 px.
    label: text.caption,
  });
