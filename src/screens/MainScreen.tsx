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
  ScreenHeader,
  SectionTitle,
  StateView,
} from '../components/ui';
import type { MainScreenNavigation } from '../navigation/types';
import {
  getNextProgramInGroup,
  getSessionGroups,
  hasCompletedSessions,
  type ProgramSummary,
  type SessionGroup,
} from '../services/database';
import { getActiveGroupId, getHiddenGroupIds, setActiveGroupId } from '../services/preferences';
import { colors, neutrals } from '../theme/colors';
import { spacing, text } from '../theme/tokens';

export default function MainScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<MainScreenNavigation>();

  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [nextSession, setNextSession] = useState<ProgramSummary | null>(null);
  const [activeGroupId, setActive] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(() => {
    let mounted = true;
    if (!loaded.current) setLoading(true);
    Promise.all([
      getSessionGroups(db),
      getActiveGroupId(),
      getHiddenGroupIds(),
      hasCompletedSessions(db),
    ])
      .then(async ([groupRows, storedActive, hidden, done]) => {
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
  }, [db]);

  useFocusEffect(load);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const visibleGroups = groups.filter((group) => !hiddenIds.includes(group.id));

  const chooseGroup = useCallback(
    async (id: number) => {
      await setActiveGroupId(id);
      load();
    },
    [load]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Main" />
        <StateView kind="loading" style={styles.flex} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Main" />
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
      <ScreenHeader title="Main" subtitle="Ta prochaine séance, prête à démarrer." />

      <ScrollView contentContainerStyle={styles.content}>
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
                  label={shortName ? 'Go' : 'Démarrer'}
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
          <Appear delay={80} style={styles.section}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    padding: spacing.xl,
  },
  heroTitle: {
    ...text.cardTitle,
    color: neutrals.text,
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
    color: neutrals.textMuted,
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
});
