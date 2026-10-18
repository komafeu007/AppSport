import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Easing, StyleSheet, View } from 'react-native';

import { StateView } from '../components/ui';
import ActiveWorkoutBubble from '../components/ActiveWorkoutBubble';
import AccountFormScreen from '../screens/AccountFormScreen';
import AccountSelectScreen from '../screens/AccountSelectScreen';
import LiveWorkoutScreen from '../screens/LiveWorkoutScreen';
import MainScreen from '../screens/MainScreen';
import ProgramGeneratorScreen from '../screens/ProgramGeneratorScreen';
import SessionEditorScreen from '../screens/SessionEditorScreen';
import SessionListScreen from '../screens/SessionListScreen';
import SessionSummaryScreen from '../screens/SessionSummaryScreen';
import { useAccount } from '../services/account';
import { useTheme, type Theme } from '../theme';
import { duration, text } from '../theme/tokens';
import StartLineTabBar from './StartLineTabBar';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/** Thème de navigation aligné sur le thème actif (clair ou sombre, §14). */
function toNavigationTheme(theme: Theme): NavigationTheme {
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      primary: theme.colors.action,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}

/** Fondu + glissement court quand on change d'onglet (Accueil ↔ Séances). */
const tabTransition = {
  animation: 'shift',
  transitionSpec: {
    animation: 'timing',
    config: { duration: duration.base, easing: Easing.bezier(0.2, 0, 0, 1) },
  },
} as const;

/** Onglets principaux (accueil + séances), affichés une fois un compte choisi. */
function MainTabs() {
  const theme = useTheme();

  return (
    <View style={styles.tabs}>
      <Tab.Navigator
        tabBar={(props) => <StartLineTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.background },
          ...tabTransition,
        }}
      >
        <Tab.Screen name="Main" component={MainScreen} options={{ title: 'Accueil' }} />
        <Tab.Screen name="Seance" component={SessionListScreen} options={{ title: 'Séances' }} />
      </Tab.Navigator>
      {/* Séance quittée en cours de route : accessible d'un appui depuis les onglets. */}
      <ActiveWorkoutBubble />
    </View>
  );
}

export default function RootNavigator() {
  const { ready, accountId } = useAccount();
  const theme = useTheme();

  const stackScreenOptions = useMemo(
    () =>
      ({
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.action,
        headerTitleStyle: { ...text.title, color: theme.colors.text },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
        animationDuration: duration.base,
      }) as const,
    [theme]
  );

  const navigationTheme = useMemo(() => toNavigationTheme(theme), [theme]);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <StateView kind="loading" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {/*
        Un seul navigateur, dont les écrans changent selon qu'un compte est actif.
        Les noms des écrans sont **distincts** entre les deux états : c'est ce qui
        déclenche la réinitialisation automatique de la navigation quand on crée
        ou choisit un profil (sinon l'ancienne pile — et son formulaire — persiste).
      */}
      <Stack.Navigator screenOptions={stackScreenOptions}>
        {accountId === null ? (
          <>
            <Stack.Screen
              name="Welcome"
              component={AccountSelectScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WelcomeForm"
              component={AccountFormScreen}
              options={{ title: 'Nouveau profil' }}
            />
            <Stack.Screen
              name="WelcomeGenerator"
              component={ProgramGeneratorScreen}
              options={{ title: 'Ton programme' }}
            />
          </>
        ) : (
          <>
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
            <Stack.Screen
              name="SessionSummary"
              component={SessionSummaryScreen}
              options={{
                title: 'Récapitulatif',
                // Le récapitulatif remplace la séance en cours : retour discret (fondu).
                animation: 'fade',
                headerBackVisible: false,
              }}
            />
            <Stack.Screen
              name="ProgramGenerator"
              component={ProgramGeneratorScreen}
              options={({ route }) => ({
                title: route.params?.reason === 'bloc' ? 'Nouveau bloc' : 'Ton programme',
              })}
            />
            <Stack.Screen
              name="Accounts"
              component={AccountSelectScreen}
              options={{ title: 'Comptes' }}
            />
            <Stack.Screen
              name="AccountForm"
              component={AccountFormScreen}
              options={({ route }) => ({
                title: route.params?.accountId ? 'Modifier le profil' : 'Nouveau profil',
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
  },
  loading: {
    flex: 1,
  },
});
