import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Easing } from 'react-native';

import LiveWorkoutScreen from '../screens/LiveWorkoutScreen';
import MainScreen from '../screens/MainScreen';
import SessionEditorScreen from '../screens/SessionEditorScreen';
import SessionListScreen from '../screens/SessionListScreen';
import { colors, neutrals } from '../theme/colors';
import { duration, text } from '../theme/tokens';
import BubbleTabBar from './BubbleTabBar';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: neutrals.surface,
    text: neutrals.text,
    primary: colors.accent,
    border: neutrals.border,
    notification: colors.alert,
  },
};

/** Fondu + glissement court quand on change d'onglet (Main ↔ Séance). */
const tabTransition = {
  animation: 'shift',
  transitionSpec: {
    animation: 'timing',
    config: { duration: duration.base, easing: Easing.out(Easing.cubic) },
  },
} as const;

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BubbleTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        ...tabTransition,
      }}
    >
      <Tab.Screen name="Main" component={MainScreen} options={{ title: 'Main' }} />
      <Tab.Screen name="Seance" component={SessionListScreen} options={{ title: 'Séance' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { ...text.title, color: neutrals.text },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          animationDuration: duration.base,
        }}
      >
        <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="SessionEditor"
          component={SessionEditorScreen}
          options={({ route }) => ({
            title: route.params?.programId ? 'Modifier la séance' : 'Nouvelle séance',
          })}
        />
        <Stack.Screen
          name="LiveWorkout"
          component={LiveWorkoutScreen}
          options={{
            title: 'Séance en cours',
            // La séance en cours arrive du bas : on entre « dans » l'effort.
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
