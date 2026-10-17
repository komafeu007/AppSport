import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Easing, StyleSheet, View } from 'react-native';

import { StateView } from '../components/ui';
import AccountFormScreen from '../screens/AccountFormScreen';
import AccountSelectScreen from '../screens/AccountSelectScreen';
import LiveWorkoutScreen from '../screens/LiveWorkoutScreen';
import MainScreen from '../screens/MainScreen';
import ProgramGeneratorScreen from '../screens/ProgramGeneratorScreen';
import SessionEditorScreen from '../screens/SessionEditorScreen';
import SessionListScreen from '../screens/SessionListScreen';
import SessionSummaryScreen from '../screens/SessionSummaryScreen';
import { useAccount } from '../services/account';
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

/** Onglets principaux (accueil + séances), affichés une fois un compte choisi. */
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

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.accent,
  headerTitleStyle: { ...text.title, color: neutrals.text },
  headerTitleAlign: 'center',
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
  animation: 'slide_from_right',
  animationDuration: duration.base,
} as const;

export default function RootNavigator() {
  const { ready, accountId } = useAccount();

  if (!ready) {
    return (
      <View style={styles.loading}>
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
  loading: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
