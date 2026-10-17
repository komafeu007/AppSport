import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StateView } from './src/components/ui';
import RootNavigator from './src/navigation/RootNavigator';
import { AccountProvider } from './src/services/account';
import { DATABASE_NAME, migrateDbIfNeeded } from './src/services/database';
import { colors } from './src/theme/colors';

function LoadingFallback() {
  return <StateView kind="loading" style={styles.loading} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <AccountProvider>
            <RootNavigator />
          </AccountProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    backgroundColor: colors.background,
  },
});
