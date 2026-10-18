import {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
} from '@expo-google-fonts/big-shoulders-display';
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StateView } from './src/components/ui';
import RootNavigator from './src/navigation/RootNavigator';
import { AccountProvider } from './src/services/account';
import { DATABASE_NAME, migrateDbIfNeeded } from './src/services/database';
import { ThemeProvider, useTheme } from './src/theme';

/**
 * Polices de la DA « Foulée » (§6.1) : Big Shoulders Display pour les chiffres
 * et les titres, Public Sans pour le texte. La graisse est portée par le nom de
 * famille (voir `fontFamily` dans `theme/tokens.ts`).
 */
const FONTS = {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} as const;

/** Contenu de l'app, une fois le thème actif (couleurs + barre d'état). */
function ThemedApp() {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Suspense fallback={<StateView kind="loading" />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <AccountProvider>
            <RootNavigator />
          </AccountProvider>
        </SQLiteProvider>
      </Suspense>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  // Tant que les polices ne sont pas prêtes, on laisse l'écran de démarrage
  // visible : pas de flash en police système. En cas d'erreur, on démarre quand
  // même (repli automatique sur la police système).
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
