import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


import { Appear, SectionTitle, StateView } from '../components/ui';
import MuscleRadarChart from '../components/MuscleRadarChart';
import { exerciseTermLabel } from '../domain/exerciseLabels';
import type { RootStackParamList } from '../navigation/types';
import { getGroupPlanExercises, type GroupPlanExercise } from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { radius, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupStats'>;

/** Arrondi simple pour l'affichage des reps. */
function formatReps(value: number): string {
  return String(Math.round(value));
}

/**
 * Répartition musculaire d'un **groupe** de séances (un split) : ce que le
 * découpage programme, séries par muscle, sur l'ensemble de ses séances. Aucune
 * lecture de l'historique : ce n'est pas le bilan des séances déjà faites.
 *
 * La charge répartie est le **nombre de séries prévues** (muscle principal pour
 * tout, moitié pour chaque muscle secondaire), l'unité qui décrit un programme.
 */
export default function GroupStatsScreen({ route }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { groupId } = route.params;
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<GroupPlanExercise[]>([]);
  const [muscles, setMuscles] = useState<{ label: string; amount: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getGroupPlanExercises(db, groupId)
      .then((rows) => {
        if (!mounted) return;
        setExercises(rows);
        // On compte les reps par muscle principal (fort), sans secondaires ni
        // regroupement canonique : chaque muscle brut garde son propre total.
        const totals = new Map<string, number>();
        for (const row of rows) {
          const raw = row.target ?? row.muscle_group;
          const label = exerciseTermLabel(raw) || raw;
          const series = row.series ?? 0;
          if (series <= 0) continue;
          totals.set(label, (totals.get(label) ?? 0) + series);
        }
        const sorted = [...totals.entries()]
          .map(([label, amount]) => ({ label, amount }))
          .sort((a, b) => b.amount - a.amount);
        setMuscles(sorted);
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
  }, [db, groupId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <StateView kind="loading" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <StateView kind="error" title="Répartition indisponible" message={error} />
      </SafeAreaView>
    );
  }

  if (exercises.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <StateView
          kind="empty"
          title="Aucun exercice dans ce groupe"
          message="Ajoute une séance et ses exercices depuis l’onglet Séances : la répartition du groupe s’affichera ici."
        />
      </SafeAreaView>
    );
  }

  const muscleMax = Math.max(...muscles.map((muscle) => muscle.amount), 1);
  const radarSize = Math.min(width - spacing.xl * 2, 320);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Appear>
          <SectionTitle
            hint={`${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`}
          >
            Répartition par muscle
          </SectionTitle>

          {muscles.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun muscle reconnu dans les exercices de ce groupe.
            </Text>
          ) : (
            <>
              <View style={styles.radarWrap}>
                <MuscleRadarChart
                  data={muscles.map((muscle) => ({ label: muscle.label, value: muscle.amount }))}
                  size={radarSize}
                />
              </View>
              <View style={styles.legend}>
                {muscles.map((muscle) => (
                  <View key={muscle.label} style={styles.legendRow}>
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {muscle.label}
                    </Text>
                    <View style={styles.legendTrack}>
                      <View
                        style={[
                          styles.legendFill,
                          { width: `${Math.max(4, (muscle.amount / muscleMax) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.legendValue}>{formatReps(muscle.amount)}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.caption}>
                Séries prévues par muscle principal, sur l’ensemble des séances du groupe.
              </Text>
            </>
          )}
        </Appear>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
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
      minWidth: 32,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    caption: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginTop: spacing.lg,
      lineHeight: 18,
    },
    emptyText: {
      ...text.meta,
      color: theme.colors.textMuted,
      lineHeight: 20,
    },
  });
