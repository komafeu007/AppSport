import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { useThemedStyles, useTheme, type Theme } from '../theme';
import { duration, easing, spacing, text } from '../theme/tokens';

/**
 * Barre d'onglets « ligne de départ » (§8.9) : fond surface, filet supérieur de
 * 1 px, hauteur 56 + zone de sécurité basse. L'onglet actif est en bleu court et
 * porte un trait de 3 px en haut, à la manière d'une ligne de départ. Ni pastille
 * flottante ni ombre : l'app n'a qu'une carte et qu'une ombre (les feuilles).
 */
export default function StartLineTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const labels = useRef(
    state.routes.map((_, position) => new Animated.Value(position === state.index ? 1 : 0))
  ).current;

  useEffect(() => {
    state.routes.forEach((_, position) => {
      Animated.timing(labels[position], {
        toValue: position === state.index ? 1 : 0,
        duration: duration.fast,
        easing: easing.enter,
        useNativeDriver: false,
      }).start();
    });
  }, [labels, state.index, state.routes]);

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, position) => {
        const focused = state.index === position;
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
            {focused ? <View style={styles.startLine} /> : null}
            <Animated.Text
              style={[
                styles.label,
                {
                  color: labels[position].interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.colors.textMuted, theme.colors.action],
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
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    startLine: {
      position: 'absolute',
      top: 0,
      width: 40,
      height: 3,
      backgroundColor: theme.colors.action,
    },
    label: text.label,
  });
