import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Appear,
  Button,
  Card,
  Chip,
  ConfirmSheet,
  Badge,
  LeaderRow,
  Row,
  ScreenHeader,
  SectionTitle,
  StateView,
  StatTiles,
  SystemBar,
  type ConfirmRequest,
} from '../components/ui';
import { ACTIVE_WORKOUT_BUBBLE_SPACE } from '../components/ActiveWorkoutBubble';
import {
  formatDotDate,
  formatDotDateYear,
  formatDuration,
  formatKg,
  formatLongDate,
  formatWeekdayShort,
  isoWeekNumber,
  padIndex,
  startOfWeek,
} from '../lib/format';
import type { MainScreenNavigation } from '../navigation/types';
import { useAccount } from '../services/account';
import { useActiveWorkout } from '../services/activeWorkout';
import {
  deleteCompletedSession,
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
import { scale, MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

/** Barres du code-barres décoratif (largeurs en px, alternées barre / vide). */
const BARCODE = [2, 1, 1, 3, 2, 1, 4, 1, 2, 2, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1];

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
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
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

  // Appui long sur une séance de l'historique : la retirer, après confirmation.
  const askDeleteSession = (session: CompletedSession) => {
    setConfirm({
      title: 'Supprimer cette séance',
      message: `${session.nom_seance ?? 'Séance'} du ${formatLongDate(
        session.date
      )} disparaît de l’historique et des stats. Tes charges ne changent pas.`,
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () => {
        deleteCompletedSession(db, session.id)
          .then(load)
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : 'Erreur inconnue')
          );
      },
    });
  };

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
        <ScreenHeader kicker="01 — Tableau de bord" title="Accueil" />
        <StateView kind="loading" style={styles.flex} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader kicker="01 — Tableau de bord" title="Accueil" />
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

  // Couloir de la semaine : séances faites depuis lundi sur celles prévues au profil.
  const now = new Date();
  const weekStart = startOfWeek();
  const weekCount = sessions.filter((session) => new Date(session.date) >= weekStart).length;
  const weekTarget = account?.sessions_per_week ?? null;
  const showWeek = weekTarget !== null && weekTarget > 0;

  // Télémétrie des 7 derniers jours.
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recent = sessions.filter((session) => new Date(session.date).getTime() >= sevenDaysAgo);
  const recentVolume = recent.reduce((sum, session) => sum + session.total_volume, 0);
  const recentDuration = recent.reduce((sum, session) => sum + (session.duration_sec ?? 0), 0);

  // Dernière fois que cette séance a été faite (volume et durée).
  const lastOfNext =
    nextSession === null
      ? null
      : (sessions.find((session) => session.program_id === nextSession.id) ?? null);
  const refCode = nextSession ? `ARN-SE-${padIndex(nextSession.id, 3)}` : null;

  // Le journal suit le groupe actif : chaque séance garde le groupe où elle a été faite.
  const journal =
    activeGroupId === null
      ? sessions
      : sessions.filter((session) => session.group_id === activeGroupId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SystemBar
        center={`${formatWeekdayShort(now)} ${formatDotDateYear(now)}`}
        right={`SEM. ${padIndex(isoWeekNumber(now))}`}
      />
      <ScreenHeader
        kicker="01 — Tableau de bord"
        title="Accueil"
        right={
          <Pressable
            style={styles.operator}
            onPress={() => navigation.navigate('Accounts')}
            accessibilityRole="button"
            accessibilityLabel={`Profil ${account?.prenom ?? ''}`}
          >
            <View style={styles.operatorDot} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.operatorText} numberOfLines={1}>
              OP. {(account?.prenom ?? 'Compte').toUpperCase()}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, activeWorkout !== null && styles.contentReserved]}
      >
        <Appear>
          <Card crosshair style={styles.hero}>
            {nextSession && activeGroup ? (
              <>
                <View style={styles.heroTop}>
                  <Badge tone="action" label={resuming ? 'SÉANCE EN COURS' : 'PROCHAINE SÉANCE'} />
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.ref}>RÉF. {refCode}</Text>
                </View>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroTitle} numberOfLines={2}>
                  {nextSession.nom_seance}
                </Text>

                <View style={styles.leaders}>
                  {nextExercises.length > 0 ? (
                    <LeaderRow label="Exercices" value={padIndex(nextExercises.length)} />
                  ) : null}
                  <LeaderRow label="Groupe" value={activeGroup.nom.toUpperCase()} />
                  {lastOfNext && lastOfNext.total_volume > 0 ? (
                    <LeaderRow
                      label="Dernier volume"
                      value={formatKg(lastOfNext.total_volume).toUpperCase()}
                    />
                  ) : null}
                  {lastOfNext && (lastOfNext.duration_sec ?? 0) > 0 ? (
                    <LeaderRow
                      label="Dernière durée"
                      value={formatDuration(lastOfNext.duration_sec ?? 0)}
                    />
                  ) : null}
                </View>

                <View style={styles.barcodeRow} accessibilityElementsHidden>
                  <View style={styles.barcode}>
                    {BARCODE.map((width, index) => (
                      <View
                        key={index}
                        style={[
                          styles.bar,
                          { width, marginRight: 2 },
                          index % 2 === 1 && styles.barGap,
                        ]}
                      />
                    ))}
                  </View>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.ref}>{refCode}</Text>
                </View>

                <Button
                  label={resuming ? 'Reprendre' : 'Démarrer'}
                  code="GO"
                  arrow
                  size="lg"
                  style={styles.heroButton}
                  onPress={() =>
                    navigation.navigate('LiveWorkout', { programId: nextSession.id })
                  }
                />
              </>
            ) : (
              <>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroTitle}>
                  {groups.length === 0
                    ? 'Aucun groupe'
                    : visibleGroups.length === 0
                      ? 'Aucun groupe affiché'
                      : activeGroup
                        ? 'Aucune séance dans ce groupe'
                        : 'Choisis ton groupe'}
                </Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroMeta}>
                  {groups.length === 0
                    ? 'Crée un groupe, puis ajoute-y tes séances.'
                    : visibleGroups.length === 0
                      ? 'Tous les groupes sont masqués. Réaffiche-en un depuis l’onglet Séances.'
                      : activeGroup
                        ? 'Ajoute une séance à ce groupe.'
                        : 'Choisis un groupe ci-dessous.'}
                </Text>
                <Button
                  label={
                    groups.length === 0
                      ? 'Créer un groupe'
                      : activeGroup
                        ? 'Ajouter une séance'
                        : 'Gérer mes séances'
                  }
                  code="GO"
                  arrow
                  size="lg"
                  style={styles.heroButton}
                  onPress={openPrimaryAction}
                />
              </>
            )}
          </Card>
        </Appear>

        <Appear style={styles.section}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>// Télémétrie — 7 derniers jours</Text>
          <StatTiles
            tiles={[
              showWeek
                ? {
                    // Objectif de la semaine (depuis lundi), pas sur 7 jours glissants.
                    label: 'A.01 Sem. / obj.',
                    value: `${padIndex(weekCount)}/${padIndex(weekTarget)}`,
                  }
                : { label: 'A.01 Séances', value: padIndex(recent.length) },
              {
                label: 'A.02 Volume',
                value: (recentVolume / 1000).toFixed(1).replace('.', ','),
                unit: 't',
              },
              { label: 'A.03 Durée', value: formatDuration(recentDuration) },
            ]}
          />
        </Appear>

        {showChooser ? (
          <Appear style={styles.section}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>// Groupe actif</Text>
            <View style={styles.chips}>
              {visibleGroups.map((group) => {
                const selected = group.id === activeGroupId;
                return (
                  <Chip
                    key={group.id}
                    label={`${selected ? '[■]' : '[ ]'} ${group.nom.toUpperCase()}`}
                    accessibilityLabel={group.nom}
                    selected={selected}
                    onPress={() => chooseGroup(group.id)}
                  />
                );
              })}
            </View>
          </Appear>
        ) : null}

        <Appear style={styles.section}>
          <SectionTitle
            hint={journal.length > 0 ? `${padIndex(journal.length, 3)} entrées` : undefined}
          >
            Journal
          </SectionTitle>
        </Appear>

        {journal.length === 0 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.historyEmpty}>
            Aucune séance terminée. Elles s’afficheront ici, de la plus récente à la plus ancienne.
          </Text>
        ) : (
          journal.map((session, index) => {
            // Une séance d'endurance n'a pas de volume : son chiffre est le temps d'effort.
            const mainValue =
              session.total_volume > 0
                ? formatKg(session.total_volume)
                : session.total_effort_sec > 0
                  ? formatDuration(session.total_effort_sec)
                  : formatKg(0);
            const work =
              session.total_reps > 0
                ? `${session.total_reps} REPS`
                : session.total_effort_sec > 0
                  ? formatDuration(session.total_effort_sec)
                  : null;
            const meta = [
              formatDotDate(session.date),
              `${session.exercise_count} EXO${session.exercise_count > 1 ? 'S' : ''}`,
              work,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Row
                key={session.id}
                inset={false}
                last={index === journal.length - 1}
                accessibilityLabel={`Récapitulatif de ${session.nom_seance ?? 'séance'}, ${formatLongDate(
                  session.date
                )}, ${mainValue}, durée ${formatDuration(session.duration_sec ?? 0)}`}
                onPress={() => navigation.navigate('SessionSummary', { sessionId: session.id })}
                onLongPress={() => askDeleteSession(session)}
              >
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.historyIndex}>#{padIndex(journal.length - index, 3)}</Text>
                <View style={styles.historyBody}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.historyTitle} numberOfLines={1}>
                    {session.nom_seance ?? 'Séance'}
                  </Text>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.historyMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                <View style={styles.historyStats}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.historyValue}>{mainValue.toUpperCase()}</Text>
                  <Badge tone="success" label="VALIDÉ" />
                </View>
              </Row>
            );
          })
        )}
      </ScrollView>

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
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
  operator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: scale(36),
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  operatorDot: {
    width: scale(8),
    height: scale(8),
    backgroundColor: theme.colors.action,
  },
  operatorText: {
    ...text.caption,
    color: theme.colors.text,
  },
  hero: {
    padding: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  ref: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  heroTitle: {
    ...text.screenTitle,
    fontSize: scale(34),
    lineHeight: scale(38),
    color: theme.colors.text,
  },
  heroMeta: {
    ...text.meta,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  leaders: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  barcodeRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barcode: {
    flexDirection: 'row',
    height: scale(24),
    opacity: 0.6,
  },
  bar: {
    height: '100%',
    backgroundColor: theme.colors.text,
  },
  barGap: {
    backgroundColor: 'transparent',
  },
  heroButton: {
    marginTop: spacing.xl,
  },
  section: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  caption: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  historyEmpty: {
    ...text.meta,
    color: theme.colors.textMuted,
    lineHeight: scale(20),
  },
  historyIndex: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginRight: spacing.md,
  },
  historyBody: {
    flex: 1,
  },
  historyTitle: {
    ...text.cardTitle,
    color: theme.colors.text,
  },
  historyMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  historyStats: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  historyValue: {
    ...text.monoValue,
    color: theme.colors.text,
  },
});
