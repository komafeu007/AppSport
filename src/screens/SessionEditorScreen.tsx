import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ExerciseDetailModal from '../components/ExerciseDetailModal';
import ExerciseSearchList from '../components/ExerciseSearchList';
import {
  Appear,
  Badge,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  PressableScale,
  SectionTitle,
  StateView,
  Thumb,
} from '../components/ui';
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
import { radius, spacing, text } from '../theme/tokens';

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

/** Champ numérique avec − / + (séries, reps, repos, poids d'une série). */
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
        <PressableScale
          style={styles.stepButton}
          onPress={() => adjust(-1)}
          accessibilityLabel={`Diminuer ${label}`}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </PressableScale>
        <TextInput
          style={styles.stepInput}
          value={text}
          onChangeText={setText}
          onBlur={commit}
          keyboardType={snap ? 'numeric' : 'decimal-pad'}
          selectTextOnFocus
          returnKeyType="done"
        />
        <PressableScale
          style={styles.stepButton}
          onPress={() => adjust(1)}
          accessibilityLabel={`Augmenter ${label}`}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </PressableScale>
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
                set_weights: fitWeights(parseWeights(row.set_weights) ?? [], series, baseWeight),
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
    patch: Partial<Pick<DraftItem, 'series' | 'reps_min' | 'reps_max' | 'rest_time' | 'set_weights'>>
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
      Alert.alert('Nom requis', 'Donne un nom à la séance avant d’enregistrer.', undefined, {
        cancelable: true,
      });
      return;
    }
    if (items.length === 0) {
      Alert.alert('Aucun exercice', 'Ajoute au moins un exercice à la séance.', undefined, {
        cancelable: true,
      });
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
      Alert.alert(
        'Erreur',
        cause instanceof Error ? cause.message : 'Enregistrement impossible.',
        undefined,
        { cancelable: true }
      );
    }
  };

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
        <StateView kind="error" message={error} />
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
        <Input
          style={styles.nameInput}
          placeholder="Ex. Séance Poitrine / Triceps"
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
            <Chip
              label="Sans groupe"
              selected={groupId === null}
              onPress={() => setGroupId(null)}
            />
            {groups.map((group) => (
              <Chip
                key={group.id}
                label={group.nom}
                selected={groupId === group.id}
                onPress={() => setGroupId(group.id)}
              />
            ))}
          </ScrollView>
        )}

        <SectionTitle
          style={styles.sectionHeader}
          right={
            <Text style={styles.sectionCount}>
              {items.length} exercice{items.length > 1 ? 's' : ''}
            </Text>
          }
        >
          Exercices
        </SectionTitle>

        <Text style={styles.progressionHint}>{PROGRESSION_HINT}</Text>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>
            Aucun exercice. Les séries, la fourchette de reps, le repos et le poids sont préremplis
            selon la règle polyarticulaire / monoarticulaire, puis restent modifiables.
          </Text>
        ) : (
          items.map((item, index) => (
            <Appear key={item.key} delay={Math.min(index * 60, 240)} offset={10}>
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIndex}>{index + 1}</Text>
                  <PressableScale
                    onPress={() => setDetail(item.exercise)}
                    accessibilityLabel="Voir l’exercice"
                    scaleTo={0.92}
                  >
                    <Thumb
                      source={
                        item.exercise.image ? exerciseImages[item.exercise.image] : undefined
                      }
                      size={44}
                    />
                  </PressableScale>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.cardTitle}>
                      {item.exercise.nom_fr ?? item.exercise.nom}
                    </Text>
                    <Badge
                      label={item.exercise.is_poly === 1 ? 'Poly' : 'Mono'}
                      tone={item.exercise.is_poly === 1 ? 'accent' : 'secondary'}
                    />
                  </View>
                  <IconButton
                    glyph="×"
                    tone="danger"
                    accessibilityLabel={`Retirer ${item.exercise.nom_fr ?? item.exercise.nom}`}
                    onPress={() => removeExercise(item.key)}
                  />
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
                  <Button
                    label="Dégressif auto (−10 %/série)"
                    variant="secondary"
                    size="sm"
                    style={styles.degressive}
                    onPress={() => applyDegressive(item)}
                  />
                </View>
              </Card>
            </Appear>
          ))
        )}

        <Button
          label="+ Ajouter un exercice"
          variant="secondary"
          size="lg"
          style={styles.addButton}
          onPress={() => setPickerVisible(true)}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Enregistrer la séance"
          size="lg"
          loading={saving}
          onPress={onSave}
        />
      </View>

      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.pickerContainer} edges={['top', 'bottom']}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Ajouter un exercice</Text>
            <Button label="Terminé" size="sm" onPress={() => setPickerVisible(false)} />
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
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.sm,
  },
  label: {
    ...text.overline,
    color: neutrals.textMuted,
  },
  labelSpaced: {
    marginTop: spacing.xl,
  },
  nameInput: {
    marginTop: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingRight: spacing.sm,
  },
  groupEmptyText: {
    ...text.meta,
    color: neutrals.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  sectionCount: {
    ...text.caption,
    color: colors.secondary,
    fontWeight: '700',
  },
  progressionHint: {
    ...text.caption,
    color: neutrals.textMuted,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...text.meta,
    color: neutrals.textMuted,
    lineHeight: 20,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIndex: {
    ...text.bodyStrong,
    color: colors.accent,
    fontWeight: '800',
    width: 18,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTitle: {
    ...text.subtitle,
    color: neutrals.text,
  },
  rules: {
    ...text.caption,
    color: neutrals.textMuted,
    marginTop: spacing.md,
  },
  fields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    marginHorizontal: -spacing.xs,
  },
  field: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...text.caption,
    color: neutrals.textMuted,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  stepButton: {
    width: 36,
    height: 40,
    borderRadius: radius.control,
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
    textAlign: 'center',
    ...text.subtitle,
    color: neutrals.text,
    backgroundColor: neutrals.surfaceAlt,
    borderRadius: radius.control,
  },
  fieldHint: {
    ...text.micro,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  setWeights: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
  },
  setWeightsHint: {
    ...text.micro,
    color: neutrals.textMuted,
    lineHeight: 16,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  degressive: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  addButton: {
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
    backgroundColor: colors.background,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  pickerTitle: {
    ...text.cardTitle,
    color: neutrals.text,
  },
});
