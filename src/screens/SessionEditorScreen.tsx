import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ExerciseSearchList from '../components/ExerciseSearchList';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import { exerciseImages } from '../data/exerciseImages';
import {
  buildDegressiveWeights,
  clamp,
  defaultTargets,
  describeRules,
  fitWeights,
  formatRest,
  normalizeRepBounds,
  parseWeights,
  PROGRESSION_HINT,
  REPS_RANGE,
  REST_RANGE,
  roundToStep,
  SERIES_RANGE,
  WEIGHT_RANGE,
  type NumericRange,
} from '../domain/workoutRules';
import type { RootStackParamList } from '../navigation/types';
import {
  getAllExercises,
  getProgram,
  getProgramExercises,
  getSessionGroups,
  programExerciseToExercise,
  saveProgram,
  type Exercise,
  type SessionGroup,
} from '../services/database';
import { colors, neutrals } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionEditor'>;

interface DraftItem {
  /** Clé locale stable (indépendante de l'id en base). */
  key: string;
  exercise: Exercise;
  series: number;
  reps_min: number;
  reps_max: number;
  rest_time: number;
  /** Poids par série (kg) — toujours un poids par série ; la 1re série sert de référence. */
  set_weights: number[];
}

function StepperField({
  label,
  value,
  range,
  onChange,
  hint,
  snap = true,
}: {
  label: string;
  value: number;
  range: NumericRange;
  onChange: (value: number) => void;
  hint?: string;
  /** false = valeur saisie conservée telle quelle (poids : jamais arrondi). */
  snap?: boolean;
}) {
  const [text, setText] = useState(() => String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(text.replace(',', '.'));
    const next = Number.isFinite(parsed)
      ? snap
        ? roundToStep(parsed, range)
        : clamp(parsed, range)
      : value;
    onChange(next);
    setText(String(next));
  };

  const adjust = (direction: 1 | -1) => {
    const increment = range.buttonStep ?? range.step;
    const raw = value + direction * increment;
    onChange(snap ? roundToStep(raw, range) : clamp(raw, range));
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Pressable style={styles.stepButton} onPress={() => adjust(-1)} hitSlop={6}>
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <TextInput
          style={styles.stepInput}
          value={text}
          onChangeText={setText}
          onBlur={commit}
          keyboardType={snap ? 'numeric' : 'decimal-pad'}
          selectTextOnFocus
          returnKeyType="done"
        />
        <Pressable style={styles.stepButton} onPress={() => adjust(1)} hitSlop={6}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export default function SessionEditorScreen({ navigation, route }: Props) {
  const db = useSQLiteContext();
  const programId = route.params?.programId;
  const initialGroupId = route.params?.groupId ?? null;

  const [nom, setNom] = useState('');
  const [groupId, setGroupId] = useState<number | null>(initialGroupId);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(0);

  const nextKey = () => {
    keyRef.current += 1;
    return `item-${keyRef.current}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [all, groupRows] = await Promise.all([getAllExercises(db), getSessionGroups(db)]);
        if (!mounted) return;
        setExercises(all);
        setGroups(groupRows);

        if (programId) {
          const [program, rows] = await Promise.all([
            getProgram(db, programId),
            getProgramExercises(db, programId),
          ]);
          if (!mounted) return;
          if (program) {
            setNom(program.nom_seance);
            setGroupId(program.group_id);
          }
          setItems(
            rows.map((row) => {
              const exercise = programExerciseToExercise(row);
              const defaults = defaultTargets(exercise.is_poly);
              const bounds = normalizeRepBounds(
                row.reps_min ?? defaults.reps_min,
                row.reps_max ?? defaults.reps_max
              );
              const series = row.series ?? defaults.series;
              const baseWeight = row.target_weight ?? defaults.target_weight;
              return {
                key: nextKey(),
                exercise,
                series,
                reps_min: bounds.reps_min,
                reps_max: bounds.reps_max,
                rest_time: row.rest_time ?? defaults.rest_time,
                set_weights: fitWeights(
                  parseWeights(row.set_weights) ?? [],
                  series,
                  baseWeight
                ),
              };
            })
          );
        }
        setLoading(false);
      } catch (cause: unknown) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db, programId]);

  const updateItem = (
    key: string,
    patch: Partial<
      Pick<DraftItem, 'series' | 'reps_min' | 'reps_max' | 'rest_time' | 'set_weights'>
    >
  ) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const addExercise = (exercise: Exercise) => {
    setItems((prev) => {
      if (prev.some((item) => item.exercise.id === exercise.id)) return prev;
      const defaults = defaultTargets(exercise.is_poly);
      return [
        ...prev,
        {
          key: nextKey(),
          exercise,
          series: defaults.series,
          reps_min: defaults.reps_min,
          reps_max: defaults.reps_max,
          rest_time: defaults.rest_time,
          set_weights: Array.from({ length: defaults.series }, () => defaults.target_weight),
        },
      ];
    });
  };

  const removeExercise = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  /**
   * La série 1 sert de référence : la modifier applique le poids à toutes les séries.
   * Modifier une série suivante ne change qu'elle (elle reste sauvegardée).
   */
  const setWeightAt = (item: DraftItem, index: number, value: number) => {
    const weights =
      index === 0
        ? Array.from({ length: item.series }, () => value)
        : item.set_weights.map((weight, i) => (i === index ? value : weight));
    updateItem(item.key, { set_weights: weights });
  };

  /** Remplit des poids dégressifs (−10 % par série) à partir de la première série. */
  const applyDegressive = (item: DraftItem) => {
    const first = item.set_weights[0] ?? 0;
    updateItem(item.key, { set_weights: buildDegressiveWeights(first, item.series) });
  };

  const onSave = async () => {
    const name = nom.trim();
    if (!name) {
      Alert.alert('Nom requis', 'Donne un nom à la séance avant d’enregistrer.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Aucun exercice', 'Ajoute au moins un exercice à la séance.');
      return;
    }
    try {
      setSaving(true);
      await saveProgram(db, {
        id: programId,
        nom_seance: name,
        group_id: groupId,
        exercises: items.map((item) => ({
          exercise_id: item.exercise.id,
          series: item.series,
          reps_min: item.reps_min,
          reps_max: item.reps_max,
          rest_time: item.rest_time,
          target_weight: item.set_weights[0] ?? 0,
          set_weights: item.set_weights,
        })),
      });
      navigation.goBack();
    } catch (cause: unknown) {
      setSaving(false);
      Alert.alert('Erreur', cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const selectedIds = items.map((item) => item.exercise.id);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nom de la séance</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Ex. Séance Poitrine / Triceps"
          placeholderTextColor={neutrals.textMuted}
          value={nom}
          onChangeText={setNom}
          returnKeyType="done"
        />

        <Text style={[styles.label, styles.labelSpaced]}>Groupe / split</Text>
        {groups.length === 0 ? (
          <Text style={styles.groupEmptyText}>
            Aucun groupe. Crées-en un depuis « Mes séances » (PPL, Maison, Upper/Lower…).
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              style={[styles.chip, groupId === null && styles.chipActive]}
              onPress={() => setGroupId(null)}
            >
              <Text style={[styles.chipText, groupId === null && styles.chipTextActive]}>
                Sans groupe
              </Text>
            </Pressable>
            {groups.map((group) => (
              <Pressable
                key={group.id}
                style={[styles.chip, groupId === group.id && styles.chipActive]}
                onPress={() => setGroupId(group.id)}
              >
                <Text style={[styles.chipText, groupId === group.id && styles.chipTextActive]}>
                  {group.nom}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Exercices</Text>
          <Text style={styles.sectionCount}>
            {items.length} exercice{items.length > 1 ? 's' : ''}
          </Text>
        </View>

        <Text style={styles.progressionHint}>{PROGRESSION_HINT}</Text>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>
            Aucun exercice. Les séries, la fourchette de reps, le repos et le poids sont préremplis
            selon la règle polyarticulaire / monoarticulaire, puis restent modifiables.
          </Text>
        ) : (
          items.map((item, index) => {
            const image = item.exercise.image ? exerciseImages[item.exercise.image] : undefined;
            return (
              <View key={item.key} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIndex}>{index + 1}</Text>
                  <Pressable
                    onPress={() => setDetail(item.exercise)}
                    hitSlop={6}
                    accessibilityLabel="Voir l’exercice"
                  >
                    {image ? (
                      <Image source={image} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]} />
                    )}
                  </Pressable>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.cardTitle}>
                      {item.exercise.nom_fr ?? item.exercise.nom}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        item.exercise.is_poly === 1 ? styles.badgePoly : styles.badgeMono,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {item.exercise.is_poly === 1 ? 'Poly' : 'Mono'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeExercise(item.key)}
                    hitSlop={8}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </Pressable>
                </View>

                <Text style={styles.rules}>{describeRules(item.exercise.is_poly)}</Text>

                <View style={styles.fields}>
                  <StepperField
                    label="Séries"
                    value={item.series}
                    range={SERIES_RANGE}
                    onChange={(value) =>
                      updateItem(item.key, {
                        series: value,
                        set_weights: fitWeights(item.set_weights, value, item.set_weights[0] ?? 0),
                      })
                    }
                  />
                  <StepperField
                    label="Reps min"
                    value={item.reps_min}
                    range={REPS_RANGE}
                    onChange={(value) =>
                      updateItem(item.key, {
                        reps_min: value,
                        ...(value > item.reps_max ? { reps_max: value } : {}),
                      })
                    }
                  />
                  <StepperField
                    label="Reps max"
                    value={item.reps_max}
                    range={REPS_RANGE}
                    onChange={(value) =>
                      updateItem(item.key, {
                        reps_max: value,
                        ...(value < item.reps_min ? { reps_min: value } : {}),
                      })
                    }
                  />
                  <StepperField
                    label="Repos (s)"
                    value={item.rest_time}
                    range={REST_RANGE}
                    hint={formatRest(item.rest_time)}
                    onChange={(value) => updateItem(item.key, { rest_time: value })}
                  />
                </View>

                <View style={styles.setWeights}>
                  <Text style={styles.fieldLabel}>Poids par série (kg)</Text>
                  <Text style={styles.setWeightsHint}>
                    La série 1 s’applique à toutes : modifie-la pour changer tout le monde. Une
                    série modifiée plus bas garde son propre poids.
                  </Text>
                  <View style={styles.fields}>
                    {item.set_weights.map((weight, setIndex) => (
                      <StepperField
                        key={`${item.key}-set-${setIndex}`}
                        label={`Série ${setIndex + 1}`}
                        value={weight}
                        range={WEIGHT_RANGE}
                        onChange={(value) => setWeightAt(item, setIndex, value)}
                        snap={false}
                      />
                    ))}
                  </View>
                  <Pressable style={styles.degressiveButton} onPress={() => applyDegressive(item)}>
                    <Text style={styles.degressiveButtonText}>Dégressif auto (−10 %/série)</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <Pressable style={styles.addButton} onPress={() => setPickerVisible(true)}>
          <Text style={styles.addButtonText}>+ Ajouter un exercice</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Enregistrer la séance</Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.pickerContainer} edges={['top', 'bottom']}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Ajouter un exercice</Text>
            <Pressable style={styles.pickerDone} onPress={() => setPickerVisible(false)}>
              <Text style={styles.pickerDoneText}>Terminé</Text>
            </Pressable>
          </View>
          <ExerciseSearchList
            exercises={exercises}
            onSelectExercise={addExercise}
            selectedIds={selectedIds}
          />
        </SafeAreaView>
      </Modal>

      <ExerciseDetailModal
        exercise={detail}
        visible={detail !== null}
        onClose={() => setDetail(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 8,
  },
  label: {
    color: neutrals.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  labelSpaced: {
    marginTop: 20,
  },
  chips: {
    gap: 8,
    paddingTop: 8,
    paddingRight: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: neutrals.border,
    backgroundColor: neutrals.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipText: {
    color: neutrals.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.background,
  },
  groupEmptyText: {
    color: neutrals.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  nameInput: {
    backgroundColor: neutrals.surface,
    borderWidth: 1,
    borderColor: neutrals.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: neutrals.text,
    fontSize: 16,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    color: neutrals.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressionHint: {
    color: neutrals.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyText: {
    color: neutrals.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: neutrals.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: neutrals.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIndex: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    width: 20,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: neutrals.surfaceAlt,
  },
  thumbPlaceholder: {
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  cardTitleBlock: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    color: neutrals.text,
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgePoly: {
    backgroundColor: colors.accent,
  },
  badgeMono: {
    backgroundColor: colors.secondary,
  },
  badgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neutrals.surfaceAlt,
  },
  removeButtonText: {
    color: colors.alert,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  rules: {
    color: neutrals.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
  fields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -4,
  },
  field: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  fieldLabel: {
    color: neutrals.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButton: {
    width: 36,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neutrals.surfaceAlt,
  },
  stepButtonText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  stepInput: {
    flex: 1,
    height: 40,
    marginHorizontal: 6,
    textAlign: 'center',
    color: neutrals.text,
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: neutrals.surfaceAlt,
    borderRadius: 10,
  },
  fieldHint: {
    color: colors.secondary,
    fontSize: 11,
    marginTop: 4,
  },
  toggle: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neutrals.surfaceAlt,
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  toggleOn: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  toggleText: {
    color: neutrals.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  toggleTextOn: {
    color: colors.background,
  },
  setWeights: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
  },
  setWeightsHint: {
    color: neutrals.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 4,
    marginHorizontal: 4,
  },
  degressiveButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
    marginLeft: 4,
  },
  degressiveButtonText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
    backgroundColor: colors.background,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: colors.alert,
    fontSize: 15,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pickerTitle: {
    color: neutrals.text,
    fontSize: 22,
    fontWeight: '800',
  },
  pickerDone: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pickerDoneText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
});
