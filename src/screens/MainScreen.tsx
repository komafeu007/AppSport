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
  Icon,
  Row,
  ScreenHeader,
  SectionTitle,
  StateView,
} from '../components/ui';
import { ACTIVE_WORKOUT_BUBBLE_SPACE } from '../components/ActiveWorkoutBubble';
import { formatDuration, formatKg, formatLongDate, startOfWeek } from '../lib/format';
import type { MainScreenNavigation } from '../navigation/types';
import { useAccount } from '../services/account';
import { useActiveWorkout } from '../services/activeWorkout';
import {
  getCompletedSessions,
  getNextProgramInGroup,
  getProgramExercises,
  getSessionGroups,
  type CompletedSession,
  type ProgramExercise,
  type ProgramSummary,
  type SessionGroup,
} from '../services/database';
import { getActiveGroupId, getHiddenGroupIds, setActiveGroupId } from '../services/preferences';
import { useThemedStyles, useTheme, type Theme } from '../theme';
import { radius, spacing, text } from '../theme/tokens';

/** Exercices montrés dans la carte de la prochaine séance (le reste est résumé). */
const PREVIEW_COUNT = 3;

/** Prescription d'un exercice, au format de la DA : « 4 × 8 », « 3 × 8–12 », « 3 × 2:00 ». */
function prescription(exercise: ProgramExercise): string {
  const series = exercise.series ?? 1;
  if (exercise.duration_sec !== null && exercise.duration_sec > 0) {
    return `${series} × ${formatDuration(exercise.duration_sec)}`;
  }
  const min = exercise.reps_min ?? exercise.reps_max;
  const max = exercise.reps_max ?? exercise.reps_min;
  if (min === null || max === null) return `${series} séries`;
  return `${series} × ${min === max ? min : `${min}–${max}`}`;
}

export default function MainScreen() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation<MainScreenNavigation>();
  const { accountId, account } = useAccount();
  // Séance mise de côté : le bouton principal la reprend au lieu de la redémarrer.
  const activeWorkout = useActiveWorkout();

  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [nextSession, setNextSession] = useState<ProgramSummary | null>(null);
  const [nextExercises, setNextExercises] = useState<ProgramExercise[]>([]);
  const [activeGroupId, setActive] = useState<number | null>(null);
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
      getCompletedSessions(db, accountId),
    ])
      .then(async ([groupRows, storedActive, hidden, sessionRows]) => {
        // Un groupe « retiré » de l'accueil ne compte plus comme groupe actif.
        const activeId =
          storedActive !== null &&
          groupRows.some((group) => group.id === storedActive) &&
          !hidden.includes(storedActive)
            ? storedActive
            : null;
        const next = activeId === null ? null : await getNextProgramInGroup(db, activeId);
        const exercises = next === null ? [] : await getProgramExercises(db, next.id);
        if (!mounted) return;
        setNextExercises(exercises);
        setGroups(groupRows);
        setHiddenIds(hidden);
        setActive(activeId);
        setNextSession(next);
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

  /**
   * Le bouton du héros va au plus court : créer un groupe, ajouter une séance au
   * groupe choisi, ou ouvrir la liste pour choisir un groupe.
   */
  const openPrimaryAction = useCallback(() => {
    if (groups.length === 0) {
      navigation.navigate('Seance', { createGroup: true });
      return;
    }
    if (activeGroup) {
      navigation.navigate('SessionEditor', { groupId: activeGroup.id });
      return;
    }
    navigation.navigate('Seance');
  }, [activeGroup, groups.length, navigation]);

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

  const showChooser =
    visibleGroups.length > 0 && (visibleGroups.length > 1 || activeGroupId === null);
  const resuming = nextSession !== null && activeWorkout?.program_id === nextSession.id;

  // Couloir de la semaine (§8.6) : une graduation par séance prévue au profil.
  const weekStart = startOfWeek();
  const weekCount = sessions.filter((session) => new Date(session.date) >= weekStart).length;
  const weekTarget = account?.sessions_per_week ?? null;
  const showWeek = weekTarget !== null && weekTarget > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Accueil"
        subtitle={formatLongDate(new Date())}
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
              <>
                <Text style={styles.heroContext} numberOfLines={1}>
                  {resuming ? 'Séance en cours' : `Prochaine séance, ${activeGroup.nom}`}
                </Text>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {nextSession.nom_seance}
                </Text>

                {nextExercises.length > 0 ? (
                  <View style={styles.preview}>
                    {nextExercises.slice(0, PREVIEW_COUNT).map((exercise) => (
                      <View key={exercise.id} style={styles.previewRow}>
                        <Text style={styles.previewName} numberOfLines={1}>
                          {exercise.nom}
                        </Text>
                        <Text style={styles.previewValue}>{prescription(exercise)}</Text>
                      </View>
                    ))}
                    {nextExercises.length > PREVIEW_COUNT ? (
                      <Text style={styles.previewMore}>
                        {nextExercises.length - PREVIEW_COUNT === 1
                          ? 'Et 1 autre exercice'
                          : `Et ${nextExercises.length - PREVIEW_COUNT} autres exercices`}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <Button
                  label={resuming ? 'Reprendre la séance' : 'Commencer la séance'}
                  size="lg"
                  style={styles.heroButton}
                  onPress={() =>
                    navigation.navigate('LiveWorkout', { programId: nextSession.id })
                  }
                />
              </>
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
                      ? 'Tous les groupes sont retirés de l’accueil. Réactive-en un depuis l’onglet Séances.'
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
                  onPress={openPrimaryAction}
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

        {showWeek ? (
          <Appear style={styles.section}>
            <SectionTitle>Cette semaine</SectionTitle>
            <View
              style={styles.weekRow}
              accessible
              accessibilityLabel={`Cette semaine : ${weekCount} séance${
                weekCount > 1 ? 's' : ''
              } sur ${weekTarget} prévue${weekTarget > 1 ? 's' : ''}.`}
            >
              <View style={styles.lane}>
                {Array.from({ length: weekTarget }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.laneSegment,
                      index < weekCount && styles.laneSegmentDone,
                      index > 0 && styles.laneGraduation,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.weekValue}>
                {weekCount} sur {weekTarget}
              </Text>
            </View>
          </Appear>
        ) : null}

        <Appear style={styles.section}>
          <SectionTitle
            hint={
              sessions.length > 0
                ? `${sessions.length} séance${sessions.length > 1 ? 's' : ''}`
                : undefined
            }
          >
            Dernières séances
          </SectionTitle>
        </Appear>

        {sessions.length === 0 ? (
          <Text style={styles.historyEmpty}>
            Aucune séance terminée. Elles s’afficheront ici, de la plus récente à la plus ancienne.
          </Text>
        ) : (
          sessions.map((session, index) => {
            // Une séance d'endurance n'a pas de volume : son chiffre est le temps d'effort.
            const mainValue =
              session.total_volume > 0
                ? formatKg(session.total_volume)
                : session.total_effort_sec > 0
                  ? formatDuration(session.total_effort_sec)
                  : formatKg(0);
            return (
              <Row
                key={session.id}
                inset={false}
                last={index === sessions.length - 1}
                accessibilityLabel={`Récapitulatif de ${session.nom_seance ?? 'séance'}, ${formatLongDate(
                  session.date
                )}, ${mainValue}, durée ${formatDuration(session.duration_sec ?? 0)}`}
                onPress={() => navigation.navigate('SessionSummary', { sessionId: session.id })}
              >
                <View style={styles.historyBody}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {session.nom_seance ?? 'Séance'}
                  </Text>
                  <Text style={styles.historyMeta} numberOfLines={1}>
                    {formatLongDate(session.date)}, {session.exercise_count} exercice
                    {session.exercise_count > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.historyStats}>
                  <Text style={styles.historyValue}>{mainValue}</Text>
                  <Text style={styles.historyDuration}>
                    {formatDuration(session.duration_sec ?? 0)}
                  </Text>
                </View>
                <Icon name="chevronRight" size={20} color={theme.colors.textMuted} />
              </Row>
            );
          })
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
  heroContext: {
    ...text.meta,
    color: theme.colors.textMuted,
    marginBottom: spacing.xs,
  },
  // Le nom de la prochaine séance est **l'information** de l'écran : il prend
  // le titre de section, pas la taille d'une ligne de liste.
  heroTitle: {
    ...text.sectionTitle,
    color: theme.colors.text,
  },
  heroMeta: {
    ...text.meta,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  // Aperçu de la séance (maquette §7.7) : nom à gauche, prescription à droite.
  preview: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  previewName: {
    ...text.body,
    color: theme.colors.text,
    flex: 1,
  },
  previewValue: {
    ...text.bodyStrong,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  previewMore: {
    ...text.meta,
    color: theme.colors.textMuted,
  },
  heroButton: {
    marginTop: spacing.xl,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Couloir de piste gradué (§8.6) : rail craie, remplissage bleu, une
  // graduation marine de 1 px entre deux séances prévues.
  lane: {
    flex: 1,
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.xs,
    overflow: 'hidden',
    backgroundColor: theme.colors.border,
  },
  laneSegment: {
    flex: 1,
  },
  laneSegmentDone: {
    backgroundColor: theme.colors.action,
  },
  laneGraduation: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.text,
  },
  weekValue: {
    ...text.bodyStrong,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  section: {
    marginTop: spacing.xxl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  historyValue: {
    ...text.bodyStrong,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  historyDuration: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
