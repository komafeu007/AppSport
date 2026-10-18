import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Appear,
  Button,
  Card,
  Chip,
  Row,
  ScreenHeader,
  SectionTitle,
  StateView,
} from '../components/ui';
import { ACTIVE_WORKOUT_BUBBLE_SPACE } from '../components/ActiveWorkoutBubble';
import { formatDuration, formatKg, formatShortDate } from '../lib/format';
import type { MainScreenNavigation } from '../navigation/types';
import { useAccount } from '../services/account';
import { useActiveWorkout } from '../services/activeWorkout';
import {
  getCompletedSessions,
  getNextProgramInGroup,
  getSessionGroups,
  hasCompletedSessions,
  type CompletedSession,
  type ProgramSummary,
  type SessionGroup,
} from '../services/database';
import { getActiveGroupId, getHiddenGroupIds, setActiveGroupId } from '../services/preferences';
import { useThemedStyles, type Theme } from '../theme';
import { spacing, text } from '../theme/tokens';

export default function MainScreen() {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const navigation = useNavigation<MainScreenNavigation>();
  const { accountId, account } = useAccount();
  // Séance mise de côté : le bouton principal la reprend au lieu de la redémarrer.
  const activeWorkout = useActiveWorkout();

  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [nextSession, setNextSession] = useState<ProgramSummary | null>(null);
  const [activeGroupId, setActive] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(() => {
    if (accountId === null) return;
    let mounted = true;
    if (!loaded.current) setLoading(true);
    Promise.all([
      getSessionGroups(db, accountId),
      getActiveGroupId(accountId),
      getHiddenGroupIds(accountId),
      hasCompletedSessions(db, accountId),
      getCompletedSessions(db, accountId),
    ])
      .then(async ([groupRows, storedActive, hidden, done, sessionRows]) => {
        // Un groupe « retiré » de l'accueil ne compte plus comme groupe actif.
        const activeId =
          storedActive !== null &&
          groupRows.some((group) => group.id === storedActive) &&
          !hidden.includes(storedActive)
            ? storedActive
            : null;
        const next = activeId === null ? null : await getNextProgramInGroup(db, activeId);
        if (!mounted) return;
        setGroups(groupRows);
        setHiddenIds(hidden);
        setActive(activeId);
        setNextSession(next);
        setCompleted(done);
        setSessions(sessionRows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
        loaded.current = true;
      });
    return () => {
      mounted = false;
    };
  }, [accountId, db]);

  useFocusEffect(load);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const visibleGroups = groups.filter((group) => !hiddenIds.includes(group.id));

  const chooseGroup = useCallback(
    async (id: number) => {
      if (accountId === null) return;
      await setActiveGroupId(accountId, id);
      load();
    },
    [accountId, load]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Accueil" />
        <StateView kind="loading" style={styles.flex} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Accueil" />
        <StateView
          kind="error"
          title="Base de données indisponible"
          message={error}
          style={styles.flex}
        />
      </SafeAreaView>
    );
  }

  const showChooser = (!completed || activeGroupId === null) && visibleGroups.length > 0;
  const shortName = nextSession !== null && nextSession.nom_seance.length <= 20;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Accueil"
        subtitle="Ta prochaine séance, prête à démarrer."
        right={
          <Button
            label={account?.prenom ?? 'Compte'}
            variant="secondary"
            size="sm"
            onPress={() => navigation.navigate('Accounts')}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, activeWorkout !== null && styles.contentReserved]}
      >
        <Appear>
          <Card tone="accent" style={styles.hero}>
            {nextSession && activeGroup ? (
              <View style={shortName ? styles.shortRow : undefined}>
                <Text
                  style={[styles.heroTitle, shortName && styles.heroTitleShort]}
                  numberOfLines={1}
                >
                  {nextSession.nom_seance}
                </Text>
                <Button
                  label={activeWorkout?.program_id === nextSession.id ? 'Reprendre' : 'Démarrer'}
                  size="lg"
                  style={shortName ? undefined : styles.heroButton}
                  onPress={() =>
                    navigation.navigate('LiveWorkout', { programId: nextSession.id })
                  }
                />
              </View>
            ) : (
              <>
                <Text style={styles.heroTitle}>
                  {groups.length === 0
                    ? 'Aucun groupe'
                    : visibleGroups.length === 0
                      ? 'Aucun groupe affiché'
                      : activeGroup
                        ? 'Aucune séance dans ce groupe'
                        : 'Choisis ton groupe'}
                </Text>
                <Text style={styles.heroMeta}>
                  {groups.length === 0
                    ? 'Crée un groupe (PPL, Maison, Upper/Lower…) et ajoute-y tes séances.'
                    : visibleGroups.length === 0
                      ? 'Tous les groupes sont retirés de l’accueil. Réactive-en un depuis l’onglet Séance.'
                      : activeGroup
                        ? 'Ajoute une séance à ce groupe pour la voir apparaître ici.'
                        : 'Sélectionne un groupe ci-dessous : sa prochaine séance s’affichera ici.'}
                </Text>
                <Button
                  label={
                    groups.length === 0
                      ? 'Créer un groupe'
                      : activeGroup
                        ? 'Ajouter une séance'
                        : 'Gérer mes séances'
                  }
                  size="lg"
                  style={styles.heroButton}
                  onPress={() => navigation.navigate('Seance')}
                />
              </>
            )}
          </Card>
        </Appear>

        {showChooser ? (
          <Appear style={styles.section}>
            <SectionTitle>Choisir mon groupe</SectionTitle>
            <View style={styles.chips}>
              {visibleGroups.map((group) => (
                <Chip
                  key={group.id}
                  label={group.nom}
                  selected={group.id === activeGroupId}
                  onPress={() => chooseGroup(group.id)}
                />
              ))}
            </View>
          </Appear>
        ) : null}

        <Appear style={styles.section}>
          <SectionTitle
            hint={
              sessions.length > 0
                ? `${sessions.length} séance${sessions.length > 1 ? 's' : ''}`
                : 'aucune'
            }
          >
            Historique
          </SectionTitle>
        </Appear>

        {sessions.length === 0 ? (
          <Text style={styles.historyEmpty}>
            Tes séances terminées s’afficheront ici, de la plus récente à la plus ancienne.
          </Text>
        ) : (
          sessions.map((session, index) => (
            <Row
              key={session.id}
              inset={false}
              last={index === sessions.length - 1}
              accessibilityLabel={`Récapitulatif de ${session.nom_seance ?? 'séance'}`}
              onPress={() => navigation.navigate('SessionSummary', { sessionId: session.id })}
            >
              <View style={styles.historyBody}>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {session.nom_seance ?? 'Séance'}
                </Text>
                <Text style={styles.historyMeta} numberOfLines={1}>
                  {formatShortDate(session.date, true)} · {session.exercise_count} exercice
                  {session.exercise_count > 1 ? 's' : ''} · {session.total_reps} reps
                </Text>
              </View>
              <View style={styles.historyStats}>
                <Text style={styles.historyVolume}>{formatKg(session.total_volume)}</Text>
                <Text style={styles.historyDuration}>
                  {formatDuration(session.duration_sec ?? 0)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Row>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  /** Place libre pour la bulle de reprise, qui flotte en bas de l'écran. */
  contentReserved: {
    paddingBottom: spacing.xxxl + ACTIVE_WORKOUT_BUBBLE_SPACE,
  },
  hero: {
    padding: spacing.xl,
  },
  heroTitle: {
    ...text.cardTitle,
    color: theme.colors.text,
  },
  heroTitleShort: {
    flex: 1,
    paddingRight: spacing.md,
  },
  shortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroMeta: {
    ...text.meta,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.sm - 2,
  },
  heroButton: {
    marginTop: spacing.lg + 2,
  },
  section: {
    marginTop: spacing.xxl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  historyEmpty: {
    ...text.meta,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  historyBody: {
    flex: 1,
  },
  historyTitle: {
    ...text.bodyStrong,
    color: theme.colors.text,
  },
  historyMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  historyStats: {
    alignItems: 'flex-end',
  },
  historyVolume: {
    ...text.bodyStrong,
    color: theme.colors.action,
    fontVariant: ['tabular-nums'],
  },
  historyDuration: {
    ...text.caption,
    color: theme.colors.action,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    ...text.title,
    color: theme.colors.textMuted,
  },
});
