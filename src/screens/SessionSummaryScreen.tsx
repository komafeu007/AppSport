import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MuscleRadarChart from '../components/MuscleRadarChart';
import VolumeLineChart, { type VolumeLinePoint } from '../components/VolumeLineChart';
import {
  Appear,
  Badge,
  Button,
  Card,
  SectionTitle,
  StateView,
  Thumb,
} from '../components/ui';
import { exerciseImages } from '../data/exerciseImages';
import { aggregateMuscleVolume, parseSecondaryMuscles } from '../domain/muscles';
import { formatWeight } from '../domain/plates';
import { beatsSet, formatPerformance, type SetPerformance } from '../domain/workoutRules';
import { formatDuration, formatKg, formatNumber, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import {
  getExerciseBestSetsBefore,
  getSessionSets,
  getSessionSummary,
  getVolumeHistory,
  type ExerciseBestSet,
  type SessionSetDetail,
} from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { radius, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

/** Résumé agrégé d'un exercice réalisé. */
interface ExerciseBlock {
  id: number;
  name: string;
  image: string | null;
  isPoly: number;
  sets: Array<{ weight: number; reps: number }>;
  reps: number;
  volume: number;
  /** Meilleure série jamais faite sur cet exo **avant** cette séance ; null si 1re fois. */
  previousBest: ExerciseBestSet | null;
  /** Meilleure série de cette séance sur cet exo (poids puis reps). */
  bestSet: SetPerformance | null;
}

/** true si la séance a battu le record absolu de cet exercice. */
function isRecord(block: ExerciseBlock): boolean {
  if (block.previousBest === null || block.bestSet === null) return false;
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
        previousBest: bestBefore.get(row.exercise_id) ?? null,
        bestSet: null,
      });
    }
    const block = blocks[index];
    block.sets.push({ weight: row.weight, reps: row.reps });
    block.reps += row.reps;
    block.volume += row.weight * row.reps;
    // Un vrai record suppose des reps réalisées (une case cochée sans reps ne compte pas).
    if (row.reps > 0 && (block.bestSet === null || beatsSet(row, block.bestSet))) {
      block.bestSet = { weight: row.weight, reps: row.reps };
    }
  }

  return blocks;
}

export default function SessionSummaryScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { sessionId } = route.params;
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('Séance');
  const [date, setDate] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [muscles, setMuscles] = useState<ReturnType<typeof aggregateMuscleVolume>>([]);
  const [history, setHistory] = useState<VolumeLinePoint[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const summary = await getSessionSummary(db, sessionId);
        if (!summary) throw new Error('Séance introuvable.');
        const rows = await getSessionSets(db, sessionId);
        const volume = rows.reduce((total, row) => total + row.weight * row.reps, 0);
        const reps = rows.reduce((total, row) => total + row.reps, 0);

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
        setBlocks(groupByExercise(rows, bestBefore));
        setMuscles(
          aggregateMuscleVolume(
            rows.map((row) => ({
              target: row.target,
              muscle_group: row.muscle_group,
              secondary: parseSecondaryMuscles(row.secondary_muscles),
              volume: row.weight * row.reps,
            }))
          )
        );
        setHistory(
          historyRows.map((point) => ({
            label: formatShortDate(point.date),
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
  }, [db, sessionId]);

  const finish = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  }, [navigation]);

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

  const radarSize = Math.min(width - spacing.xl * 2 - spacing.lg * 2, 300);
  const muscleMax = Math.max(...muscles.map((muscle) => muscle.volume), 1);
  const records = blocks.filter(isRecord);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Appear>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{sessionName}</Text>
            <Text style={styles.heroSub}>
              Séance terminée{date ? ` · ${formatShortDate(date)}` : ''}
            </Text>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, styles.statVolume]}>
                  {formatNumber(totalVolume)}
                </Text>
                <Text style={styles.statLabel}>kg soulevés</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, styles.statTime]}>
                  {formatDuration(durationSec)}
                </Text>
                <Text style={styles.statLabel}>temps</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{totalReps}</Text>
                <Text style={styles.statLabel}>répétitions</Text>
              </View>
            </View>
          </View>
        </Appear>

        <Appear style={styles.section}>
          <View style={styles.flat}>
            <SectionTitle>Répartition par muscle</SectionTitle>
            {muscles.length === 0 ? (
              <Text style={styles.emptyText}>
                Aucune série enregistrée : rien à répartir pour cette séance.
              </Text>
            ) : (
              <>
                {muscles.length >= 3 ? (
                  <View style={styles.radarWrap}>
                    <MuscleRadarChart
                      size={radarSize}
                      data={muscles.map((muscle) => ({
                        label: muscle.label,
                        value: muscle.volume,
                      }))}
                    />
                  </View>
                ) : null}

                <View style={styles.legend}>
                  {muscles.map((muscle) => (
                    <View key={muscle.key} style={styles.legendRow}>
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {muscle.label}
                      </Text>
                      <View style={styles.legendTrack}>
                        <View
                          style={[
                            styles.legendFill,
                            { width: `${Math.max(4, (muscle.volume / muscleMax) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.legendValue}>{formatKg(muscle.volume)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </Appear>

        <Appear style={styles.section}>
          <View style={styles.flat}>
            <SectionTitle hint="cette séance">Évolution du volume</SectionTitle>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>Pas encore d’historique pour cette séance.</Text>
            ) : (
              <>
                <VolumeLineChart points={history} />
                <Text style={styles.chartHint}>
                  {history.length <= 1
                    ? 'Première fois : refais cette séance pour voir la courbe grimper.'
                    : `${history.length} dernières séances, du plus ancien au plus récent.`}
                </Text>
              </>
            )}
          </View>
        </Appear>

        {records.length > 0 ? (
          <Appear style={styles.section}>
            <Card tone="marker">
              <SectionTitle hint="cette séance">Records</SectionTitle>
              {records.map((block) => {
                if (block.bestSet === null || block.previousBest === null) return null;
                return (
                  <View key={block.id} style={styles.recordRow}>
                    <View style={styles.recordBody}>
                      <Text style={styles.recordName} numberOfLines={1}>
                        {block.name}
                      </Text>
                      <Text style={styles.recordMeta}>
                        {formatPerformance(block.bestSet)} (avant :{' '}
                        {formatPerformance(block.previousBest)})
                      </Text>
                    </View>
                    <Badge label="Record" tone="marker" />
                  </View>
                );
              })}
            </Card>
          </Appear>
        ) : null}

        <Appear style={styles.section}>
          <View style={styles.flat}>
            <SectionTitle hint={`${blocks.length} exercice${blocks.length > 1 ? 's' : ''}`}>
              Détail des exercices
            </SectionTitle>
            {blocks.length === 0 ? (
              <Text style={styles.emptyText}>Aucune série enregistrée pour cette séance.</Text>
            ) : (
              blocks.map((block, index) => (
                <View
                  key={block.id}
                  style={[styles.exercise, index > 0 && styles.exerciseDivider]}
                >
                  <Thumb
                    source={block.image ? exerciseImages[block.image] : undefined}
                    size={44}
                    accessibilityLabel={block.name}
                  />
                  <View style={styles.exerciseBody}>
                    <View style={styles.exerciseHead}>
                      <Text style={styles.exerciseName} numberOfLines={1}>
                        {block.name}
                      </Text>
                      <Badge label={block.isPoly ? 'Poly' : 'Mono'} tone="neutral" />
                      {isRecord(block) ? <Badge label="Record" tone="marker" /> : null}
                    </View>
                    <Text style={styles.exerciseMeta}>
                      {block.sets.length} série{block.sets.length > 1 ? 's' : ''} · {block.reps}{' '}
                      reps · {formatKg(block.volume)}
                    </Text>
                    <Text style={styles.exerciseSets} numberOfLines={2}>
                      {block.sets
                        .map((set) => `${formatWeight(set.weight)}×${set.reps}`)
                        .join('  ·  ')}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </Appear>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Terminer" size="lg" onPress={finish} />
      </View>
    </SafeAreaView>
  );
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
    marginTop: spacing.lg,
  },
  hero: {
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  flat: {
    paddingVertical: spacing.xs,
  },
  heroTitle: {
    ...text.title,
    color: theme.colors.text,
  },
  heroSub: {
    ...text.meta,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...text.numM,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  statVolume: {
    color: theme.colors.action,
  },
  statTime: {
    color: theme.colors.action,
  },
  statLabel: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border,
  },
  radarWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  legend: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendLabel: {
    ...text.label,
    color: theme.colors.text,
    width: 88,
  },
  legendTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  legendFill: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.action,
  },
  legendValue: {
    ...text.caption,
    color: theme.colors.textMuted,
    minWidth: 64,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chartHint: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.sm,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  recordBody: {
    flex: 1,
  },
  recordName: {
    ...text.bodyStrong,
    color: theme.colors.text,
  },
  recordMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    ...text.meta,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  exerciseDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  exerciseBody: {
    flex: 1,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseName: {
    ...text.bodyStrong,
    color: theme.colors.text,
    flexShrink: 1,
  },
  exerciseMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  exerciseSets: {
    ...text.micro,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
});
