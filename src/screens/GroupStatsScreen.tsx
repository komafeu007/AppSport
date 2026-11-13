import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


import { Appear, SectionTitle, StateView } from '../components/ui';
import MuscleLegend from '../components/MuscleLegend';
import MuscleRadarChart from '../components/MuscleRadarChart';
import {
  aggregateMuscleAmount,
  parseSecondaryMuscles,
  type MuscleAmount,
} from '../domain/muscles';
import type { RootStackParamList } from '../navigation/types';
import { getGroupPlanExercises, type GroupPlanExercise } from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { scale, MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupStats'>;

/** Séries affichées : entier, ou une décimale quand un muscle secondaire compte pour moitié. */
function formatSets(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

/**
 * Répartition musculaire d'un **groupe** de séances (un split) : ce que le
 * découpage programme, séries par muscle, sur l'ensemble de ses séances. Aucune
 * lecture de l'historique : ce n'est pas le bilan des séances déjà faites.
 *
 * Même agencement que le récapitulatif de fin de séance : les muscles bruts du
 * catalogue (lats, traps, abductors…) sont rangés dans les axes d'affichage
 * (`MUSCLE_AXES`, jambes regroupées), et la charge se répartit pareil — tout
 * pour le muscle principal, la moitié pour chaque muscle secondaire. Seule
 * l'unité change : ce sont les **séries prévues**, l'unité qui décrit un
 * programme.
 */
export default function GroupStatsScreen({ route }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { groupId } = route.params;
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<GroupPlanExercise[]>([]);
  const [muscles, setMuscles] = useState<MuscleAmount[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getGroupPlanExercises(db, groupId)
      .then((rows) => {
        if (!mounted) return;
        setExercises(rows);
        // Mêmes axes que le récapitulatif de fin de séance (jambes regroupées) :
        // chaque muscle brut du dataset est ramené à sa clé canonique, et les
        // secondaires comptent pour moitié (ordre anatomique, pas décroissant).
        setMuscles(
          aggregateMuscleAmount(
            rows.map((row) => ({
              target: row.target,
              muscle_group: row.muscle_group,
              secondary: parseSecondaryMuscles(row.secondary_muscles),
              amount: row.series ?? 0,
            }))
          )
        );
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
          message="Ajoute une séance dans l’onglet Séances."
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
            hint={`en séries, ${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`}
          >
            Répartition par muscle
          </SectionTitle>

          {muscles.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptyText}>
              Aucun muscle reconnu dans ce groupe.
            </Text>
          ) : (
            <>
              {muscles.length >= 3 ? (
                <View style={styles.radarWrap}>
                  <MuscleRadarChart
                    data={muscles.map((muscle) => ({ label: muscle.label, value: muscle.amount }))}
                    size={radarSize}
                  />
                </View>
              ) : null}
              <MuscleLegend muscles={muscles} max={muscleMax} format={formatSets} valueWidth={32} />

              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>
                Séries prévues par groupe musculaire, sur l’ensemble des séances du split : tout
                pour le muscle principal, la moitié pour chaque muscle secondaire.
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
    caption: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginTop: spacing.lg,
      lineHeight: scale(18),
    },
    emptyText: {
      ...text.meta,
      color: theme.colors.textMuted,
      lineHeight: scale(20),
    },
  });
