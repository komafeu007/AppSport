import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
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

import DurationField from '../components/DurationField';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import ExerciseSearchList from '../components/ExerciseSearchList';
import {
  Appear,
  Badge,
  Button,
  Card,
  Chip,
  ConfirmSheet,
  IconButton,
  Input,
  PressableScale,
  SectionTitle,
  StateView,
  Thumb,
  type ConfirmRequest,
} from '../components/ui';
import { exerciseImages } from '../data/exerciseImages';
import { findExerciseAlternatives } from '../domain/exerciseAlternatives';
import { isEndurance } from '../domain/exerciseCatalog';
import {
  buildDegressiveWeights,
  clamp,
  defaultTargets,
  describeRules,
  ENDURANCE_HINT,
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
import { useAccount } from '../services/account';
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
import { useThemedStyles, type Theme } from '../theme';
import { radius, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionEditor'>;

interface DraftItem {
  /** Clé locale stable (indépendante de l'id en base). */
  key: string;
  exercise: Exercise;
  series: number;
  reps_min: number;
  reps_max: number;
  /** Durée d'effort par série (endurance), en secondes. */
  duration_sec: number;
  rest_time: number;
  /** Poids par série (kg) — toujours un poids par série ; la 1re série sert de référence. */
  set_weights: number[];
  /** Superset : enchaîne sans repos avec l'exercice **suivant**. */
  superset: boolean;
}

/**
 * Id de groupe de superset par exercice : deux exercices consécutifs liés
 * partagent la même valeur. Réattribué à chaque enregistrement.
 */
function computeSupersetGroups(items: DraftItem[]): Array<number | null> {
  const groups: Array<number | null> = items.map(() => null);
  let nextGroup = 0;
  for (let index = 0; index < items.length - 1; index++) {
    if (!items[index].superset) continue;
    const group = groups[index] ?? (groups[index] = ++nextGroup);
    groups[index + 1] = group;
  }
  return groups;
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
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { accountId } = useAccount();
  const programId = route.params?.programId;
  const initialGroupId = route.params?.groupId ?? null;

  const [nom, setNom] = useState('');
  const [groupId, setGroupId] = useState<number | null>(initialGroupId);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  /** Sélecteur d'exercice ouvert : ajout simple ou remplacement d'un exercice. */
  const [picker, setPicker] = useState<
    { mode: 'add' } | { mode: 'replace'; itemKey: string } | null
  >(null);
  /** Fiche exercice ouverte (avec, en bas, des substituts à la même place). */
  const [detail, setDetail] = useState<{ exercise: Exercise; itemKey: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const keyRef = useRef(0);

  /** Message d'information dans une carte de confirmation (un seul bouton). */
  const notify = (title: string, message: string) => {
    setConfirm({ title, message, confirmLabel: 'Compris', hideCancel: true });
  };

  const nextKey = () => {
    keyRef.current += 1;
    return `item-${keyRef.current}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (accountId === null) {
        setLoading(false);
        return;
      }
      try {
        const [all, groupRows] = await Promise.all([
          getAllExercises(db),
          getSessionGroups(db, accountId),
        ]);
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
            rows.map((row, index) => {
              const exercise = programExerciseToExercise(row);
              const endurance = isEndurance(exercise);
              const defaults = defaultTargets(exercise.is_poly, endurance);
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
                reps_min: endurance ? 0 : bounds.reps_min,
                reps_max: endurance ? 0 : bounds.reps_max,
                duration_sec: row.duration_sec ?? defaults.duration_sec,
                rest_time: row.rest_time ?? defaults.rest_time,
                set_weights: fitWeights(parseWeights(row.set_weights) ?? [], series, baseWeight),
                // Rattaché au suivant s'ils partagent le même groupe de superset.
                superset:
                  row.superset_group != null &&
                  row.superset_group === (rows[index + 1]?.superset_group ?? null),
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
  }, [accountId, db, programId]);

  const updateItem = (
    key: string,
    patch: Partial<
      Pick<
        DraftItem,
        'series' | 'reps_min' | 'reps_max' | 'duration_sec' | 'rest_time' | 'set_weights' | 'superset'
      >
    >
  ) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const addExercise = (exercise: Exercise) => {
    setItems((prev) => {
      if (prev.some((item) => item.exercise.id === exercise.id)) return prev;
      const endurance = isEndurance(exercise);
      const defaults = defaultTargets(exercise.is_poly, endurance);
      return [
        ...prev,
        {
          key: nextKey(),
          exercise,
          series: defaults.series,
          reps_min: defaults.reps_min,
          reps_max: defaults.reps_max,
          duration_sec: defaults.duration_sec,
          rest_time: defaults.rest_time,
          set_weights: Array.from({ length: defaults.series }, () => defaults.target_weight),
          superset: false,
        },
      ];
    });
  };

  const removeExercise = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  /**
   * Remplace l'exercice d'un item par un autre qui travaille les mêmes muscles :
   * on conserve séries / cible / repos, mais les poids repartent de zéro (ils
   * étaient propres à l'ancien mouvement). Si le mode change (musculation ↔
   * endurance), on repart des valeurs par défaut du nouveau mode.
   * Refusé si déjà présent ailleurs.
   */
  const replaceExercise = (itemKey: string, exercise: Exercise) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== itemKey) return item;
        if (prev.some((other) => other.key !== itemKey && other.exercise.id === exercise.id)) {
          return item;
        }
        const endurance = isEndurance(exercise);
        const defaults = defaultTargets(exercise.is_poly, endurance);
        const modeChanged = isEndurance(item.exercise) !== endurance;
        return {
          ...item,
          exercise,
          ...(modeChanged
            ? {
                series: defaults.series,
                reps_min: defaults.reps_min,
                reps_max: defaults.reps_max,
                duration_sec: defaults.duration_sec,
                rest_time: defaults.rest_time,
              }
            : {}),
          set_weights: Array.from(
            { length: modeChanged ? defaults.series : item.series },
            () => defaults.target_weight
          ),
        };
      })
    );
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
      notify('Nom requis', 'Donne un nom à la séance avant d’enregistrer.');
      return;
    }
    if (items.length === 0) {
      notify('Aucun exercice', 'Ajoute au moins un exercice à la séance.');
      return;
    }
    if (accountId === null) {
      notify('Aucun profil', 'Choisis un profil avant de créer une séance.');
      return;
    }
    try {
      setSaving(true);
      const supersetGroups = computeSupersetGroups(items);
      await saveProgram(db, {
        id: programId,
        account_id: accountId,
        nom_seance: name,
        group_id: groupId,
        exercises: items.map((item, index) => ({
          exercise_id: item.exercise.id,
          series: item.series,
          reps_min: item.reps_min,
          reps_max: item.reps_max,
          duration_sec: isEndurance(item.exercise) ? item.duration_sec : null,
          rest_time: item.rest_time,
          target_weight: item.set_weights[0] ?? 0,
          set_weights: item.set_weights,
          superset_group: supersetGroups[index],
        })),
      });
      navigation.goBack();
    } catch (cause: unknown) {
      setSaving(false);
      notify('Erreur', cause instanceof Error ? cause.message : 'Enregistrement impossible.');
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
  const hasEndurance = items.some((item) => isEndurance(item.exercise));
  const hasStrength = items.some((item) => !isEndurance(item.exercise));
  const editorHint =
    hasEndurance && hasStrength
      ? `${ENDURANCE_HINT}\n${PROGRESSION_HINT}`
      : hasEndurance
        ? ENDURANCE_HINT
        : PROGRESSION_HINT;

  /** Item dont on remplace l'exercice (sélecteur ouvert en mode « replace »). */
  const pickerTarget =
    picker?.mode === 'replace'
      ? (items.find((item) => item.key === picker.itemKey) ?? null)
      : null;
  /** En remplacement : la liste se limite aux exercices qui partagent les muscles. */
  const pickerExercises =
    pickerTarget !== null
      ? findExerciseAlternatives(pickerTarget.exercise, exercises, {
          excludeIds: items
            .filter((item) => item.key !== pickerTarget.key)
            .map((item) => item.exercise.id),
        })
      : exercises;
  const pickerSelectedIds =
    pickerTarget !== null
      ? items.filter((item) => item.key !== pickerTarget.key).map((item) => item.exercise.id)
      : selectedIds;

  const onPickExercise = (exercise: Exercise) => {
    if (picker?.mode === 'replace') {
      replaceExercise(picker.itemKey, exercise);
      setPicker(null);
      return;
    }
    addExercise(exercise);
  };

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

        <Text style={styles.progressionHint}>{editorHint}</Text>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>
            Aucun exercice. Les séries, la cible (reps ou durée), le repos et le poids sont
            préremplis selon la règle polyarticulaire / monoarticulaire, puis restent modifiables.
          </Text>
        ) : (
          items.map((item, index) => {
            const endurance = isEndurance(item.exercise);
            return (
              <Appear key={item.key}>
                <Card
                  style={[
                    styles.card,
                    (item.superset || (index > 0 && items[index - 1].superset)) && styles.cardSuperset,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIndex}>{index + 1}</Text>
                    <PressableScale
                      style={styles.cardTap}
                      onPress={() => setDetail({ exercise: item.exercise, itemKey: item.key })}
                      accessibilityLabel={`Voir et remplacer ${item.exercise.nom}`}
                      scaleTo={0.97}
                    >
                      <Thumb
                        source={
                          item.exercise.image ? exerciseImages[item.exercise.image] : undefined
                        }
                        size={44}
                      />
                      <View style={styles.cardTitleBlock}>
                        <Text style={styles.cardTitle}>{item.exercise.nom}</Text>
                        <Badge
                          label={
                            endurance ? 'Endurance' : item.exercise.is_poly === 1 ? 'Poly' : 'Mono'
                          }
                          tone={
                            endurance
                              ? 'neutral'
                              : item.exercise.is_poly === 1
                                ? 'action'
                                : 'neutral'
                          }
                        />
                      </View>
                    </PressableScale>
                    <IconButton
                      glyph="×"
                      tone="danger"
                      accessibilityLabel={`Retirer ${item.exercise.nom}`}
                      onPress={() => removeExercise(item.key)}
                    />
                  </View>

                  <Text style={styles.rules}>
                    {describeRules(item.exercise.is_poly, endurance)}
                  </Text>

                  {item.superset || (index > 0 && items[index - 1].superset) ? (
                    <Text style={styles.supersetNote}>
                      Superset : enchaîne sans repos avec l’exercice lié, repos après le dernier.
                    </Text>
                  ) : null}

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
                    {endurance ? (
                      <DurationField
                        label="Durée par série"
                        value={item.duration_sec}
                        hint
                        style={styles.field}
                        inputStyle={styles.durationInput}
                        onChange={(value) => updateItem(item.key, { duration_sec: value })}
                      />
                    ) : (
                      <>
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
                      </>
                    )}
                    <StepperField
                      label="Repos (s)"
                      value={item.rest_time}
                      range={REST_RANGE}
                      hint={formatRest(item.rest_time)}
                      onChange={(value) => updateItem(item.key, { rest_time: value })}
                    />
                  </View>

                  {endurance ? null : (
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
                  )}

                  {index < items.length - 1 ? (
                    <View style={styles.supersetRow}>
                      <Chip
                        label={item.superset ? '⇄ Superset avec le suivant' : 'Marquer en superset'}
                        selected={item.superset}
                        onPress={() => updateItem(item.key, { superset: !item.superset })}
                      />
                    </View>
                  ) : null}
                </Card>
              </Appear>
            );
          })
        )}

        <Button
          label="+ Ajouter un exercice"
          variant="secondary"
          size="lg"
          style={styles.addButton}
          onPress={() => setPicker({ mode: 'add' })}
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
        visible={picker !== null}
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <SafeAreaView style={styles.pickerContainer} edges={['top', 'bottom']}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle} numberOfLines={2}>
              {pickerTarget ? `Remplacer « ${pickerTarget.exercise.nom} »` : 'Ajouter un exercice'}
            </Text>
            <Button label="Terminé" size="sm" onPress={() => setPicker(null)} />
          </View>
          {pickerTarget ? (
            <Text style={styles.pickerSubtitle}>
              Exercices qui travaillent les mêmes muscles. Séries, cible (reps ou durée) et repos
              sont conservés ; les poids repartent de zéro.
            </Text>
          ) : null}
          <ExerciseSearchList
            exercises={pickerExercises}
            onSelectExercise={onPickExercise}
            selectedIds={pickerSelectedIds}
            emptyText={pickerTarget ? 'Aucun exercice similaire trouvé' : undefined}
          />
        </SafeAreaView>
      </Modal>

      <ExerciseDetailModal
        exercise={detail?.exercise ?? null}
        visible={detail !== null}
        onClose={() => setDetail(null)}
        alternatives={
          detail
            ? {
                catalogue: exercises,
                excludeIds: items
                  .filter((item) => item.key !== detail.itemKey)
                  .map((item) => item.exercise.id),
                onReplace: (exercise) => {
                  replaceExercise(detail.itemKey, exercise);
                  setDetail(null);
                },
                onSeeAll: () => {
                  setPicker({ mode: 'replace', itemKey: detail.itemKey });
                  setDetail(null);
                },
              }
            : undefined
        }
      />

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </KeyboardAvoidingView>
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
  label: {
    ...text.label,
    color: theme.colors.textMuted,
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
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  sectionCount: {
    ...text.caption,
    color: theme.colors.action,
  },
  progressionHint: {
    ...text.caption,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...text.meta,
    color: theme.colors.textMuted,
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
    color: theme.colors.textMuted,
    width: 18,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...text.subtitle,
    color: theme.colors.text,
  },
  rules: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.md,
  },
  cardSuperset: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.action,
  },
  supersetNote: {
    ...text.caption,
    color: theme.colors.action,
    marginTop: spacing.xs,
  },
  supersetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    color: theme.colors.textMuted,
    marginBottom: spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  stepButton: {
    width: 36,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  stepButtonText: {
    ...text.title,
    color: theme.colors.action,
    lineHeight: 24,
  },
  stepInput: {
    flex: 1,
    height: 44,
    textAlign: 'center',
    ...text.subtitle,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radius.control,
  },
  durationInput: {
    height: 44,
    minHeight: 44,
  },
  fieldHint: {
    ...text.micro,
    color: theme.colors.action,
    marginTop: spacing.xs,
  },
  setWeights: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  setWeightsHint: {
    ...text.micro,
    color: theme.colors.textMuted,
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
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    color: theme.colors.text,
  },
  pickerSubtitle: {
    ...text.caption,
    color: theme.colors.textMuted,
    lineHeight: 18,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
  },
});
