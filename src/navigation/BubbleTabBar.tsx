import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, neutrals, shadow } from '../theme/colors';
import { duration, radius, spacing, spring, text } from '../theme/tokens';
import PressableScale from '../components/ui/PressableScale';

const PADDING = spacing.sm - 2;
const GAP = spacing.sm - 2;
const BORDER = 1;

/**
 * Barre d'onglets « bulle » : une pilule flottante en bas, avec une pastille
 * accent qui **glisse** d'un onglet à l'autre (ressort) et des libellés dont la
 * couleur s'anime. Pas d'icônes externes (aucune lib installée).
 */
export default function BubbleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const count = state.routes.length;

  const tabWidth =
    barWidth > 0 ? (barWidth - BORDER * 2 - PADDING * 2 - GAP * (count - 1)) / count : 0;

  const index = useRef(new Animated.Value(state.index)).current;
  const labels = useRef(
    state.routes.map((_, position) => new Animated.Value(position === state.index ? 1 : 0))
  ).current;

  useEffect(() => {
    Animated.spring(index, { toValue: state.index, useNativeDriver: true, ...spring }).start();
    state.routes.forEach((_, position) => {
      Animated.timing(labels[position], {
        toValue: position === state.index ? 1 : 0,
        duration: duration.fast,
        useNativeDriver: false,
      }).start();
    });
  }, [index, labels, state.index, state.routes]);

  const pillOffset = useMemo(
    () => Animated.multiply(index, tabWidth + GAP),
    [index, tabWidth]
  );

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              { width: tabWidth, left: PADDING + BORDER, transform: [{ translateX: pillOffset }] },
            ]}
          />
        ) : null}

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
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={styles.tab}
            >
              <Animated.Text
                style={[
                  styles.label,
                  {
                    color: labels[position].interpolate({
                      inputRange: [0, 1],
                      outputRange: [neutrals.textMuted, colors.background],
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: neutrals.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: neutrals.border,
    padding: PADDING,
    gap: GAP,
    ...shadow,
  },
  pill: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...text.bodyStrong,
    fontWeight: '800',
  },
});
