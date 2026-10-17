import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const showChooser = (!completed || activeGroupId === null) && visibleGroups.length > 0;
  const shortName = nextSession !== null && nextSession.nom_seance.length <= 20;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Main</Text>

        <View style={styles.card}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : nextSession && activeGroup ? (
            <>
              <View style={shortName ? styles.shortRow : undefined}>
                <Text style={[styles.cardTitle, shortName && styles.cardTitleShort]} numberOfLines={1}>
                  {nextSession.nom_seance}
                </Text>
                <Pressable
                  style={shortName ? styles.goButton : styles.startButton}
                  onPress={() => navigation.navigate('LiveWorkout', { programId: nextSession.id })}
                >
                  <Text style={styles.startButtonText}>{shortName ? 'Go' : 'Démarrer'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>
                {groups.length === 0
                  ? 'Aucun groupe'
                  : visibleGroups.length === 0
                    ? 'Aucun groupe affiché'
                    : activeGroup
                      ? 'Aucune séance dans ce groupe'
                      : 'Choisis ton groupe'}
              </Text>
              <Text style={styles.cardMeta}>
                {groups.length === 0
                  ? 'Crée un groupe (PPL, Maison, Upper/Lower…) et ajoute-y tes séances.'
                  : visibleGroups.length === 0
                    ? 'Tous les groupes sont retirés de l’accueil. Réactive-en un depuis l’onglet Séance.'
                    : activeGroup
                      ? 'Ajoute une séance à ce groupe pour la voir apparaître ici.'
                      : 'Sélectionne un groupe ci-dessous : sa prochaine séance s’affichera ici.'}
              </Text>
              <Pressable
                style={styles.startButton}
                onPress={() => navigation.navigate('Seance')}
              >
                <Text style={styles.startButtonText}>
                  {groups.length === 0
                    ? 'Créer un groupe'
                    : activeGroup
                      ? 'Ajouter une séance'
                      : 'Gérer mes séances'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {showChooser && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choisir mon groupe</Text>
            <View style={styles.chips}>
              {visibleGroups.map((group) => {
                const active = group.id === activeGroupId;
                return (
                  <Pressable
                    key={group.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => chooseGroup(group.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {group.nom}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Le reste de l'écran Main est volontairement vide pour l'instant. */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  screenTitle: {
    color: neutrals.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  card: {
    backgroundColor: neutrals.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 20,
  },
  cardTitle: {
    color: neutrals.text,
    fontSize: 24,
    fontWeight: '800',
  },
  cardTitleShort: {
    flex: 1,
    paddingRight: 12,
  },
  shortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardMeta: {
    color: neutrals.textMuted,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  goButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  startButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: colors.alert,
    fontSize: 15,
    marginTop: 12,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    color: neutrals.text,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: neutrals.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: neutrals.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipText: {
    color: neutrals.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.background,
  },
});
