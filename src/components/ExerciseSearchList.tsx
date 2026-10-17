import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { exerciseImages } from '../data/exerciseImages';
import { buildExerciseSections, type ExerciseSection } from '../lib/exerciseSearch';
import type { Exercise } from '../services/database';
import { colors, neutrals } from '../theme/colors';
import ExerciseDetailModal from './ExerciseDetailModal';

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
  const source = exercise.image ? exerciseImages[exercise.image] : undefined;
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      disabled={selected}
    >
      <Pressable onPress={onOpenDetail} hitSlop={6} accessibilityLabel="Voir l’exercice">
        {source ? (
          <Image source={source} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
      </Pressable>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>{exercise.nom_fr ?? exercise.nom}</Text>
          <View
            style={[styles.badge, exercise.is_poly === 1 ? styles.badgePoly : styles.badgeMono]}
          >
            <Text style={styles.badgeText}>{exercise.is_poly === 1 ? 'Poly' : 'Mono'}</Text>
          </View>
        </View>
        <Text style={styles.rowEn}>{exercise.nom}</Text>
        <Text style={styles.rowMeta}>
          {[exercise.target, exercise.category, exercise.equipment].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {selected && <Text style={styles.added}>Ajouté</Text>}
    </Pressable>
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
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [detail, setDetail] = useState<Exercise | null>(null);
  const listRef = useRef<SectionList<Exercise, ExerciseSection>>(null);

  const sections = useMemo(() => buildExerciseSections(exercises, searchTerm), [exercises, searchTerm]);

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
        <TextInput
          style={styles.search}
          placeholder={placeholder}
          placeholderTextColor={neutrals.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Pressable style={styles.searchButton} onPress={submitSearch}>
          <Text style={styles.searchButtonText}>Rechercher</Text>
        </Pressable>
      </View>

      {resultCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {searchTerm.trim() ? `Aucun résultat pour « ${searchTerm.trim()} »` : emptyText}
          </Text>
        </View>
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
            section.title ? <Text style={styles.sectionHeader}>{section.title}</Text> : null
          }
          contentContainerStyle={[styles.listContent, contentContainerStyle]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  search: {
    flex: 1,
    backgroundColor: neutrals.surface,
    borderWidth: 1,
    borderColor: neutrals.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: neutrals.text,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sectionHeader: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: neutrals.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: neutrals.border,
    padding: 12,
    alignItems: 'center',
  },
  rowSelected: {
    borderColor: colors.accent,
    opacity: 0.75,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: neutrals.surfaceAlt,
  },
  thumbPlaceholder: {
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  rowBody: {
    flex: 1,
    marginLeft: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: neutrals.text,
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    paddingRight: 8,
  },
  rowEn: {
    color: neutrals.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  rowMeta: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  separator: {
    height: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgePoly: {
    backgroundColor: colors.accent,
  },
  badgeMono: {
    backgroundColor: colors.secondary,
  },
  badgeText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  added: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  emptyText: {
    color: neutrals.textMuted,
    fontSize: 15,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
