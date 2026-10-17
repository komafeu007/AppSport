import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, neutrals } from '../theme/colors';

/**
 * Barre d'onglets « bulle » : une pilule flottante en bas, l'onglet actif
 * rempli d'un rond accent. Pas d'icônes externes (aucune lib installée).
 */
export default function BubbleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
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
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: neutrals.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: neutrals.border,
    padding: 6,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  label: {
    color: neutrals.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  labelActive: {
    color: colors.background,
  },
});
