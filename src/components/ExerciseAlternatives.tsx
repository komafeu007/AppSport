import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { exerciseImages } from '../data/exerciseImages';
import { findExerciseAlternatives } from '../domain/exerciseAlternatives';
import { exerciseTermLabel } from '../domain/exerciseLabels';
import type { Exercise } from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { spacing, text } from '../theme/tokens';
import { PressableScale, SectionTitle, Thumb } from './ui';
import Row from './ui/Row';

interface Props {
  /** Exercice à remplacer. */
  base: Exercise;
  /** Catalogue complet dans lequel chercher. */
  catalogue: readonly Exercise[];
  /** Ids jamais proposés (le reste de la séance). */
  excludeIds: readonly number[];
  /** Choisit un substitut (mêmes muscles, autre exercice). */
  onReplace: (exercise: Exercise) => void;
  /** Ouvre la liste complète des exercices similaires. */
  onSeeAll: () => void;
  /** Nombre d'alternatives rapides affichées (défaut 3). */
  quickCount?: number;
}

/**
 * « Remplacer cet exercice » : propose quelques exercices qui travaillent les
 * mêmes muscles (avec, en tête, les variantes du même mouvement), puis un accès
 * à la liste complète des exercices similaires.
 */
export default function ExerciseAlternatives({
  base,
  catalogue,
  excludeIds,
  onReplace,
  onSeeAll,
  quickCount = 3,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const ranked = useMemo(
    () => findExerciseAlternatives(base, catalogue, { excludeIds }),
    [base, catalogue, excludeIds]
  );
  const quick = ranked.slice(0, quickCount);

  if (ranked.length === 0) return null;

  return (
    <View style={styles.root}>
      <SectionTitle>Remplacer cet exercice</SectionTitle>
      <Text style={styles.hint}>
        Mêmes muscles travaillés. Séries, reps et repos sont conservés ; les poids repartent de zéro.
      </Text>

      <View style={styles.list}>
        {quick.map((exercise, index) => {
          const source = exercise.image ? exerciseImages[exercise.image] : undefined;
          const meta = [exercise.target, exercise.equipment]
            .filter((value): value is string => Boolean(value))
            .map(exerciseTermLabel)
            .join(' · ');
          return (
            <Row
              key={exercise.id}
              last={index === quick.length - 1}
              onPress={() => onReplace(exercise)}
              accessibilityLabel={`Remplacer par ${exercise.nom}`}
            >
              <Thumb source={source} size={44} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {exercise.nom}
                </Text>
                {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
              </View>
              <Text style={styles.swap}>Changer</Text>
            </Row>
          );
        })}
      </View>

      <PressableScale
        style={styles.seeAll}
        scaleTo={0.97}
        accessibilityLabel="Voir tous les exercices similaires"
        onPress={onSeeAll}
      >
        <Text style={styles.seeAllText}>
          Voir tous les exercices similaires ({ranked.length})
        </Text>
      </PressableScale>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      marginTop: spacing.xxl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: spacing.lg,
    },
    hint: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginBottom: spacing.md,
    },
    list: {
      marginHorizontal: -spacing.xl,
    },
    rowBody: {
      flex: 1,
    },
    rowTitle: {
      ...text.cardTitle,
      color: theme.colors.text,
    },
    rowMeta: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    swap: {
      ...text.label,
      color: theme.colors.action,
    },
    seeAll: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    seeAllText: {
      ...text.label,
      color: theme.colors.action,
    },
  });
