import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { useReduceMotion } from '../theme/motion';
import { useThemedStyles, useTheme, type Theme } from '../theme';
import { MAX_FONT_SCALE, duration, easing, spacing, spring, text } from '../theme/tokens';


/**
 * Barre d'onglets de la DA « Terminal » : deux moitiés séparées par un filet,
 * chacune avec son numéro mono (« 01 ») et son libellé en Chakra Petch
 * capitales. L'onglet actif passe en crème, son numéro en orange suivi d'un
 * point, et porte un trait orange de 3 px sur toute sa largeur, qui **glisse**
 * d'un onglet à l'autre. Pas d'icône : le numéro fait office de repère.
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
              width: slot,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, count - 1],
                    outputRange: [0, barWidth - slot],
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
            style={[styles.tab, index > 0 ? styles.tabDivided : null]}
          >
            {!canSlide && focused ? <View style={[styles.startLine, styles.startLineStatic]} /> : null}
            <Animated.Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[
                styles.number,
                {
                  color: labels[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.colors.textMuted, theme.colors.action],
                  }),
                },
              ]}
            >
              {`${String(index + 1).padStart(2, '0')}${focused ? ' •' : ''}`}
            </Animated.Text>
            <Animated.Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[
                styles.label,
                {
                  color: labels[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.colors.textMuted, theme.colors.text],
                  }),
                },
              ]}
            >
              {label}
            </Animated.Text>
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
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderStrong,
    },
    tab: {
      flex: 1,
      // Hauteur minimale : le libellé suit la taille de texte du système.
      minHeight: 72,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      justifyContent: 'center',
      gap: 2,
    },
    tabDivided: {
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.borderStrong,
    },
    startLine: {
      position: 'absolute',
      top: -1,
      left: 0,
      height: 3,
      backgroundColor: theme.colors.action,
      zIndex: 1,
    },
    startLineStatic: {
      right: 0,
    },
    number: {
      ...text.caption,
      fontSize: 11,
    },
    label: {
      ...text.sectionTitle,
      fontSize: 22,
      lineHeight: 26,
    },
  });
