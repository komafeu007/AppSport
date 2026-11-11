import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MuscleBarChart from '../components/MuscleBarChart';
import VolumeLineChart, { type VolumeLinePoint } from '../components/VolumeLineChart';
import {
  Badge,
  Button,
  Card,
  ConfirmSheet,
  DashedLine,
  SectionTitle,
  StateView,
  StatTiles,
  type ConfirmRequest,
  type StatTile,
} from '../components/ui';
import { aggregateMuscleAmount, parseSecondaryMuscles } from '../domain/muscles';
import { formatWeight } from '../domain/plates';
import { beatsSet, type SetPerformance } from '../domain/workoutRules';
import {
  formatDotDate,
  formatDotDateYear,
  formatDuration,
  formatNumber,
  formatWeekdayShort,
  padIndex,
} from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import {
  deleteCompletedSession,
  getExerciseBestSetsBefore,
  getSessionSets,
  getSessionSummary,
  getVolumeHistory,
  type ExerciseBestSet,
  type SessionSetDetail,
} from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { MAX_FONT_SCALE, fontFamily, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

/** Résumé agrégé d'un exercice réalisé. */
interface ExerciseBlock {
  id: number;
  name: string;
  image: string | null;
  isPoly: number;
  sets: Array<{ weight: number; reps: number; durationSec: number }>;
  reps: number;
  volume: number;
  /** Temps d'effort cumulé (endurance), en secondes. */
  duration: number;
  /** Exercice chronométré : ni reps ni charge, on affiche la durée. */
  timed: boolean;
  /** Meilleure série jamais faite sur cet exo **avant** cette séance ; null si 1re fois. */
  previousBest: ExerciseBestSet | null;
  /** Meilleure série de cette séance sur cet exo (poids puis reps). */
  bestSet: SetPerformance | null;
}

/** true si la séance a battu le record absolu de cet exercice. */
function isRecord(block: ExerciseBlock): boolean {
  if (block.timed || block.previousBest === null || block.bestSet === null) return false;
  return beatsSet(block.bestSet, block.previousBest);
}

function groupByExercise(
  rows: SessionSetDetail[],
  bestBefore: Map<number, ExerciseBestSet>
): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  const indexById = new Map<number, number>();

  for (const row of rows) {
    let index = indexById.get(row.exercise_id);
    if (index === undefined) {
      index = blocks.length;
      indexById.set(row.exercise_id, index);
      blocks.push({
        id: row.exercise_id,
        name: row.nom,
        image: row.image,
        isPoly: row.is_poly,
        sets: [],
        reps: 0,
        volume: 0,
        duration: 0,
        timed: false,
        previousBest: bestBefore.get(row.exercise_id) ?? null,
        bestSet: null,
      });
    }
    const block = blocks[index];
    const durationSec = row.duration_sec ?? 0;
    block.sets.push({ weight: row.weight, reps: row.reps, durationSec });
    block.reps += row.reps;
    block.volume += row.weight * row.reps;
    block.duration += durationSec;
    if (durationSec > 0) block.timed = true;
    // Un vrai record suppose des reps réalisées (une case cochée sans reps ne compte pas)
    // et un exercice de musculation : l'endurance se compte au temps, pas en charges.
    const beats =
      durationSec === 0 &&
      row.reps > 0 &&
      (block.bestSet === null || beatsSet(row, block.bestSet));
    if (beats) {
      block.bestSet = { weight: row.weight, reps: row.reps };
    }
  }

  return blocks;
}

export default function SessionSummaryScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { sessionId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('Séance');
  const [date, setDate] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [totalEffort, setTotalEffort] = useState(0);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [muscles, setMuscles] = useState<ReturnType<typeof aggregateMuscleAmount>>([]);
  const [history, setHistory] = useState<VolumeLinePoint[]>([]);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  // Relu à chaque retour sur l'écran (après une correction de la séance).
  const [reloadKey, setReloadKey] = useState(0);
  useFocusEffect(useCallback(() => setReloadKey((key) => key + 1), []));

  useEffect(() => {
    if (reloadKey === 0) return;
    let mounted = true;
    (async () => {
      try {
        const summary = await getSessionSummary(db, sessionId);
        if (!summary) throw new Error('Séance introuvable.');
        const rows = await getSessionSets(db, sessionId);
        const volume = rows.reduce((total, row) => total + row.weight * row.reps, 0);
        const reps = rows.reduce((total, row) => total + row.reps, 0);
        const effort = rows.reduce((total, row) => total + (row.duration_sec ?? 0), 0);

        // Records : meilleure série déjà faite sur chaque exo avant cette séance.
        const bestRows =
          summary.account_id != null
            ? await getExerciseBestSetsBefore(db, summary.account_id, summary.id)
            : [];
        const bestBefore = new Map(bestRows.map((row) => [row.exercise_id, row]));

        const historyRows =
          summary.program_id != null ? await getVolumeHistory(db, summary.program_id) : [];

        if (!mounted) return;
        setSessionName(summary.nom_seance ?? 'Séance');
        setDate(summary.date);
        setDurationSec(summary.duration_sec ?? 0);
        setTotalVolume(volume || summary.total_volume || 0);
        setTotalReps(reps);
        setTotalEffort(effort);
        setBlocks(groupByExercise(rows, bestBefore));
        setMuscles(
          aggregateMuscleAmount(
            rows.map((row) => ({
              target: row.target,
              muscle_group: row.muscle_group,
              secondary: parseSecondaryMuscles(row.secondary_muscles),
              // Répartition en répétitions, pas en kilos.
              amount: row.reps,
            }))
          )
        );
        setHistory(
          historyRows.map((point) => ({
            label: formatDotDate(point.date),
            value: point.total_volume,
          }))
        );
        setError(null);
      } catch (cause: unknown) {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db, sessionId, reloadKey]);

  const finish = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  }, [navigation]);

  // Séance enregistrée par erreur (ou de test) : la retirer de l'historique.
  const askDelete = useCallback(() => {
    setConfirm({
      title: 'Supprimer cette séance',
      message:
        'Elle disparaît de l’historique et des stats. Tes charges ne changent pas.',
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () => {
        deleteCompletedSession(db, sessionId)
          .then(finish)
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : 'Erreur inconnue')
          );
      },
    });
  }, [db, sessionId, finish]);

  if (loading) {
    return (
      <View style={styles.container}>
        <StateView kind="loading" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StateView
          kind="error"
          title="Récapitulatif indisponible"
          message={error}
          action={<Button label="Terminer" onPress={finish} />}
        />
      </View>
    );
  }

  const records = blocks.filter(isRecord);
  const refCode = `ARN-LOG-${padIndex(sessionId, 3)}`;
  const metaParts = [
    date ? `${formatWeekdayShort(date)} ${formatDotDateYear(date)}` : null,
    `RÉF. ${refCode}`,
    `${padIndex(blocks.length)} EXOS`,
  ].filter((part): part is string => part !== null);

  const tiles: StatTile[] = [
    { label: 'T.01 CHARGE', value: formatNumber(totalVolume), unit: 'KG', unitBelow: true, accent: true },
    { label: 'T.02 DURÉE', value: formatDuration(durationSec), unit: 'MIN:S', unitBelow: true },
    totalReps > 0
      ? { label: 'T.03 RÉPS', value: formatNumber(totalReps), unit: 'UNITÉS', unitBelow: true }
      : {
          label: 'T.03 EFFORT',
          value: formatDuration(totalEffort),
          unit: 'TEMPS D’EFFORT',
          unitBelow: true,
        },
  ];

  /** Écart de charge avec le record précédent : « +5 KG » ou « +1 RÉP ». */
  const recordGain = (best: SetPerformance, previous: SetPerformance): string => {
    const kg = best.weight - previous.weight;
    if (kg > 0) return `+${formatWeight(kg)} KG`;
    return `+${Math.max(1, best.reps - previous.reps)} RÉP`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Badge label="STATUT : TERMINÉE" tone="success" />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroTitle}>{sessionName}</Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroMeta}>{metaParts.join(' · ')}</Text>
        </View>

        <StatTiles tiles={tiles} style={styles.tiles} />

        <View style={styles.section}>
          <SectionTitle hint="UNITÉ : RÉPS">Charge par muscle</SectionTitle>
          <View style={styles.sectionBody}>
            {muscles.length === 0 ? (
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptyText}>
                Aucune répétition à répartir : les exercices d’endurance, comptés au temps, ne
                comptent pas comme des répétitions.
              </Text>
            ) : (
              <MuscleBarChart muscles={muscles} format={formatNumber} />
            )}
          </View>
        </View>

        <View style={styles.section}>
          {history.length === 0 ? (
            <>
              <SectionTitle hint="CETTE SÉANCE">Évolution du volume</SectionTitle>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.emptyText, styles.sectionBody]}>
                Pas encore d’historique pour cette séance.
              </Text>
            </>
          ) : (
            <VolumeLineChart points={history} />
          )}
        </View>

        {records.length > 0 ? (
          <View style={styles.section}>
            <Card tone="marker">
              <View style={styles.recordsHead}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.recordsTitle}>Records battus</Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.recordsCount}>×{padIndex(records.length)}</Text>
              </View>
              {records.map((block) => {
                if (block.bestSet === null || block.previousBest === null) return null;
                return (
                  <View key={block.id}>
                    <DashedLine />
                    <View style={styles.recordRow}>
                      <View style={styles.recordBody}>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.recordName} numberOfLines={1}>
                          {block.name}
                        </Text>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.recordMeta}>
                          NOUV.{' '}
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.recordStrong}>{compactSet(block.bestSet)}</Text>
                          {' / ANC. '}
                          {compactSet(block.previousBest)}
                        </Text>
                      </View>
                      <Badge label={recordGain(block.bestSet, block.previousBest)} tone="marker" />
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle hint={`${padIndex(blocks.length)} ENTRÉE${blocks.length > 1 ? 'S' : ''}`}>
            Détail exercices
          </SectionTitle>
          {blocks.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.emptyText, styles.sectionBody]}>
              Aucune série enregistrée pour cette séance.
            </Text>
          ) : (
            blocks.map((block, index) => (
              <View key={block.id}>
                <View style={styles.exercise}>
                  <View style={styles.exerciseHead}>
                    <View style={styles.codeBox}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.codeText}>EX-{padIndex(index + 1)}</Text>
                    </View>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.exerciseName} numberOfLines={1}>
                      {block.name}
                    </Text>
                    <Badge label={block.isPoly ? 'POLY' : 'MONO'} tone="outline" />
                    {isRecord(block) ? <Badge label="RECORD" tone="marker" /> : null}
                  </View>
                  <View style={styles.exerciseFoot}>
                    <View style={styles.setList}>
                      {block.sets.map((set, setIndex) => (
                        <View key={setIndex} style={styles.setBox}>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.setText}>
                            {set.durationSec > 0
                              ? formatDuration(set.durationSec)
                              : `${formatWeight(set.weight)}×${set.reps}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.exerciseVolume}>
                      {block.timed
                        ? formatDuration(block.duration)
                        : `${formatNumber(block.volume)} KG`}
                    </Text>
                  </View>
                </View>
                <DashedLine />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Terminer" code="ENREG." size="lg" onPress={finish} />
        <Button
          label="Corriger la saisie"
          variant="secondary"
          onPress={() => navigation.navigate('CompletedSessionEdit', { sessionId })}
          style={styles.deleteButton}
        />
        <Button
          label="Supprimer de l’historique"
          variant="tertiary"
          onPress={askDelete}
          style={styles.deleteButton}
        />
      </View>

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );
}

/** « 200×8 » : série compacte pour la fiche de record. */
function compactSet(set: SetPerformance): string {
  return `${formatWeight(set.weight)}×${set.reps}`;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.sm,
  },
  section: {
    marginTop: spacing.xxl,
  },
  sectionBody: {
    marginTop: spacing.md,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroTitle: {
    ...text.screenTitle,
    color: theme.colors.text,
  },
  heroMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  tiles: {
    marginTop: spacing.xl,
  },
  recordsHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  recordsTitle: {
    ...text.sectionTitle,
    color: theme.colors.marker,
  },
  recordsCount: {
    ...text.monoValue,
    color: theme.colors.marker,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  recordBody: {
    flex: 1,
  },
  recordName: {
    ...text.cardTitle,
    color: theme.colors.text,
  },
  recordMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  recordStrong: {
    fontFamily: fontFamily.monoBold,
    color: theme.colors.text,
  },
  emptyText: {
    ...text.meta,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  exercise: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeBox: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  codeText: {
    ...text.caption,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  exerciseName: {
    ...text.cardTitle,
    color: theme.colors.text,
    flexShrink: 1,
  },
  exerciseFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  setList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  setBox: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  setText: {
    ...text.caption,
    color: theme.colors.text,
  },
  exerciseVolume: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  deleteButton: {
    marginTop: spacing.xs,
  },
});
