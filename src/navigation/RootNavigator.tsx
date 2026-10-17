import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LiveWorkoutScreen from '../screens/LiveWorkoutScreen';
import MainScreen from '../screens/MainScreen';
import SessionEditorScreen from '../screens/SessionEditorScreen';
import SessionListScreen from '../screens/SessionListScreen';
import { colors, neutrals } from '../theme/colors';
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

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <BubbleTabBar {...props} />} screenOptions={{ headerShown: false }}>
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
          headerStyle: { backgroundColor: neutrals.surface },
          headerTintColor: neutrals.text,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: colors.background },
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
          options={{ title: 'Séance en cours' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
