import { ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSansCondensed_400Regular,
  IBMPlexSansCondensed_500Medium,
  IBMPlexSansCondensed_600SemiBold,
  IBMPlexSansCondensed_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-condensed';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StateView } from './src/components/ui';
import RootNavigator from './src/navigation/RootNavigator';
import { AccountProvider } from './src/services/account';
import { DATABASE_NAME, migrateDbIfNeeded } from './src/services/database';
import { ThemeProvider, useTheme } from './src/theme';

/**
 * Polices de la DA « Terminal » : Chakra Petch (titres, chiffres), IBM Plex
 * Sans Condensed (texte) et IBM Plex Mono (libellés techniques). La graisse est
 * portée par le nom de famille (voir `fontFamily` dans `theme/tokens.ts`).
 */
const FONTS = {
  ChakraPetch_600SemiBold,
  ChakraPetch_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexSansCondensed_400Regular,
  IBMPlexSansCondensed_500Medium,
  IBMPlexSansCondensed_600SemiBold,
  IBMPlexSansCondensed_700Bold,
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
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
