import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { exerciseImages } from '../data/exerciseImages';
import { exerciseTermLabel } from '../domain/exerciseLabels';
import { buildExerciseSections, type ExerciseSection } from '../lib/exerciseSearch';
import type { Exercise } from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { spacing, text } from '../theme/tokens';
import ExerciseDetailModal from './ExerciseDetailModal';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Input from './ui/Input';
import PressableScale from './ui/PressableScale';
import Row from './ui/Row';
import SectionTitle from './ui/SectionTitle';
import StateView from './ui/StateView';
import Thumb from './ui/Thumb';

export interface ExerciseListHeaderInfo {
  /** Nombre de résultats pour la recherche courante. */
  resultCount: number;
  /** Nombre total d'exercices disponibles. */
  total: number;
  /** Terme effectivement appliqué (validé via le bouton Rechercher). */
  searchTerm: string;
}

interface ExerciseSearchListProps {
  exercises: Exercise[];
  /** Appelé au tap d'une ligne (ouvrir le détail, ou sélectionner dans le picker). */
  onSelectExercise: (exercise: Exercise) => void;
  /** Ids déjà présents (picker) : ligne marquée « Ajouté » et non sélectionnable. */
  selectedIds?: number[];
  placeholder?: string;
  /** En-tête rendu au-dessus de la barre de recherche (titre, compteur…). */
  renderHeader?: (info: ExerciseListHeaderInfo) => ReactNode;
  emptyText?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

function ExerciseRow({
  exercise,
  selected,
  onPress,
  onOpenDetail,
}: {
  exercise: Exercise;
  selected: boolean;
  onPress: () => void;
  onOpenDetail: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const source = exercise.image ? exerciseImages[exercise.image] : undefined;

  return (
    <Row
      style={selected ? styles.rowSelected : undefined}
      onPress={onPress}
      disabled={selected}
      accessibilityLabel={selected ? `${exercise.nom} (déjà ajouté)` : exercise.nom}
    >
      <PressableScale onPress={onOpenDetail} accessibilityLabel="Voir l’exercice" scaleTo={0.92}>
        <Thumb source={source} size={56} />
      </PressableScale>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>{exercise.nom}</Text>
          <Badge
            label={exercise.is_poly === 1 ? 'Poly' : 'Mono'}
            tone={exercise.is_poly === 1 ? 'action' : 'neutral'}
          />
        </View>
        <Text style={styles.rowMeta}>
          {[exercise.target, exercise.category, exercise.equipment]
            .filter((value): value is string => Boolean(value))
            .map(exerciseTermLabel)
            .join(' · ')}
        </Text>
      </View>
      {selected ? <Text style={styles.added}>Ajouté</Text> : null}
    </Row>
  );
}

export default function ExerciseSearchList({
  exercises,
  onSelectExercise,
  selectedIds,
  placeholder = 'Rechercher un exercice ou un muscle…',
  renderHeader,
  emptyText = 'Aucun résultat',
  contentContainerStyle,
}: ExerciseSearchListProps) {
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [detail, setDetail] = useState<Exercise | null>(null);
  const listRef = useRef<SectionList<Exercise, ExerciseSection>>(null);

  const sections = useMemo(
    () => buildExerciseSections(exercises, searchTerm),
    [exercises, searchTerm]
  );

  const resultCount = useMemo(
    () => sections.reduce((total, section) => total + section.data.length, 0),
    [sections]
  );

  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  const submitSearch = useCallback(() => {
    setSearchTerm(query);
    // Remonte en haut de la liste une fois les nouveaux résultats rendus.
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: false });
      } catch {
        // Liste vide ou pas encore prête : rien à faire.
      }
    });
  }, [query]);

  return (
    <>
      {renderHeader?.({ resultCount, total: exercises.length, searchTerm })}

      <View style={styles.searchRow}>
        <Input
          style={styles.search}
          placeholder={placeholder}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Button label="Rechercher" onPress={submitSearch} />
      </View>

      {resultCount === 0 ? (
        <StateView
          kind="empty"
          message={
            searchTerm.trim() ? `Aucun résultat pour « ${searchTerm.trim()} »` : emptyText
          }
        />
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ExerciseRow
              exercise={item}
              selected={selected.has(item.id)}
              onPress={() => onSelectExercise(item)}
              onOpenDetail={() => setDetail(item)}
            />
          )}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeader}>
                <SectionTitle>{section.title}</SectionTitle>
              </View>
            ) : null
          }
          contentContainerStyle={[styles.listContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}

      <ExerciseDetailModal
        exercise={detail}
        visible={detail !== null}
        onClose={() => setDetail(null)}
      />
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    search: {
      flex: 1,
    },
    listContent: {
      paddingBottom: spacing.xxl,
    },
    sectionHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
      backgroundColor: theme.colors.background,
    },
    rowSelected: {
      opacity: 0.6,
    },
    rowBody: {
      flex: 1,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    rowTitle: {
      ...text.cardTitle,
      color: theme.colors.text,
      flexShrink: 1,
    },
    rowMeta: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginTop: spacing.xs,
    },
    added: {
      ...text.caption,
      color: theme.colors.success,
      marginLeft: spacing.sm,
    },
  });
