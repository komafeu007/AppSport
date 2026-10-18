import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionSheet from '../components/ActionSheet';
import {
  Appear,
  Button,
  ConfirmSheet,
  IconButton,
  Row,
  ScreenHeader,
  SectionTitle,
  StateView,
  type ConfirmRequest,
} from '../components/ui';
import { OBJECTIFS, SESSION_FORMATS, optionLabel } from '../domain/profile';
import type { RootStackParamList } from '../navigation/types';
import { useAccount } from '../services/account';
import { deleteAccount, getAccounts, resetAppData, type Account } from '../services/database';
import { clearAllPreferences } from '../services/preferences';
import { useThemedStyles, type Theme } from '../theme';
import { radius, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Accounts' | 'Welcome'>;

/** Ligne d'aperçu d'un profil : objectif · fréquence · format. */
function accountMeta(account: Account): string {
  const parts: string[] = [];
  const objectif = optionLabel(OBJECTIFS, account.objectif);
  if (objectif) parts.push(objectif);
  if (account.sessions_per_week) parts.push(`${account.sessions_per_week} séance/sem.`);
  const format = optionLabel(SESSION_FORMATS, account.format_seance);
  if (format) parts.push(format);
  return parts.length > 0 ? parts.join(' · ') : 'Profil à compléter';
}

/**
 * Page d'accueil au lancement (et écran de gestion) : on choisit le profil avec
 * lequel s'entraîner. Chaque compte a ses propres séances et son historique.
 */
export default function AccountSelectScreen({ navigation }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { accountId, select, clear } = useAccount();
  const onboarding = accountId === null;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAccount, setMenuAccount] = useState<Account | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  /** Ouvre le formulaire : nom d'écran différent en onboarding (cf. RootNavigator). */
  const openForm = useCallback(
    (editId?: number) => {
      if (editId !== undefined) {
        navigation.navigate('AccountForm', { accountId: editId });
      } else if (onboarding) {
        navigation.navigate('WelcomeForm', {});
      } else {
        navigation.navigate('AccountForm', {});
      }
    },
    [navigation, onboarding]
  );

  const load = useCallback(() => {
    let mounted = true;
    getAccounts(db)
      .then((rows) => {
        if (!mounted) return;
        setAccounts(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [db]);

  useFocusEffect(load);

  const choose = useCallback(
    async (id: number) => {
      if (id === accountId) {
        // Déjà actif : en gestion des comptes on revient simplement à l'accueil.
        if (!onboarding) navigation.popToTop();
        return;
      }
      await select(id);
      // En onboarding, le changement de compte réinitialise la navigation tout seul.
      if (!onboarding) navigation.popToTop();
    },
    [accountId, navigation, onboarding, select]
  );

  const removeAccount = useCallback(
    (account: Account) => {
      setConfirm({
        title: 'Supprimer le profil',
        message: `« ${account.prenom} » et toutes ses séances/historique seront supprimés.`,
        confirmLabel: 'Supprimer',
        destructive: true,
        onConfirm: async () => {
          await deleteAccount(db, account.id);
          if (account.id === accountId) await clear();
          load();
        },
      });
    },
    [accountId, clear, db, load]
  );

  /** Repart d'une base vierge : profils, séances, historique et préférences. */
  const resetAll = useCallback(() => {
    setConfirm({
      title: 'Réinitialiser les données',
      message:
        'Tous les profils, séances et historiques enregistrés sur cet appareil seront effacés. Cette action est définitive.',
      confirmLabel: 'Tout effacer',
      destructive: true,
      onConfirm: async () => {
        await resetAppData(db);
        await clearAllPreferences();
        await clear();
        load();
      },
    });
  }, [clear, db, load]);

  const menuItems = menuAccount
    ? [
        {
          label: 'Modifier le profil',
          onPress: () => openForm(menuAccount.id),
        },
        {
          label: 'Supprimer le profil',
          destructive: true,
          onPress: () => removeAccount(menuAccount),
        },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container} edges={onboarding ? ['top', 'bottom'] : ['bottom']}>
      {onboarding ? (
        <ScreenHeader
          title="AppSport Local"
          subtitle="Choisis ton profil — chaque compte garde ses séances et son historique."
        />
      ) : null}

      {loading ? (
        <StateView kind="loading" />
      ) : error ? (
        <StateView kind="error" message={error} />
      ) : accounts.length === 0 ? (
        <StateView
          kind="empty"
          title="Aucun profil"
          message="Crée ton profil pour définir ton objectif, ton matériel et tes séances."
          action={
            <View style={styles.emptyActions}>
              <Button label="Créer mon profil" size="lg" onPress={() => openForm()} />
              <Button
                label="Réinitialiser toutes les données"
                variant="tertiary"
                onPress={resetAll}
              />
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {accounts.map((account, index) => {
            const active = account.id === accountId;
            return (
              <Row
                key={account.id}
                inset={false}
                last={index === accounts.length - 1}
                style={active ? styles.rowActive : undefined}
                onPress={() => choose(account.id)}
                accessibilityLabel={`Choisir ${account.prenom}`}
              >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {account.prenom.trim().charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.body}>
                    <View style={styles.titleRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {account.prenom}
                      </Text>
                      {active ? <Text style={styles.activeTag}>actif</Text> : null}
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>
                      {accountMeta(account)}
                    </Text>
                  </View>
                  <IconButton
                    glyph="⋯"
                    accessibilityLabel={`Options de ${account.prenom}`}
                    onPress={() => setMenuAccount(account)}
                  />
              </Row>
            );
          })}

          <Appear style={styles.danger}>
            <SectionTitle>Zone sensible</SectionTitle>
            <Text style={styles.dangerText}>
              Efface tous les profils et leur historique sur cet appareil (les exercices du
              catalogue sont conservés). Pratique pour repartir d'une base propre.
            </Text>
            <Button
              label="Réinitialiser toutes les données"
              variant="tertiary"
              onPress={resetAll}
            />
          </Appear>
        </ScrollView>
      )}

      {accounts.length > 0 ? (
        <View style={styles.footer}>
          <Button
            label="Nouveau profil"
            variant="secondary"
            size="lg"
            onPress={() => openForm()}
          />
        </View>
      ) : null}

      <ActionSheet
        visible={menuAccount !== null}
        title={menuAccount?.prenom}
        items={menuItems}
        onClose={() => setMenuAccount(null)}
      />

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  rowActive: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.action,
  },
  danger: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyActions: {
    gap: spacing.sm,
  },
  dangerText: {
    ...text.meta,
    color: theme.colors.textMuted,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.action,
  },
  avatarText: {
    ...text.title,
    color: theme.colors.onAction,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...text.subtitle,
    color: theme.colors.text,
    flexShrink: 1,
  },
  activeTag: {
    ...text.caption,
    color: theme.colors.success,
  },
  meta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
