import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exerciseImages } from '../data/exerciseImages';
import {
  clamp,
  fitWeights,
  parseWeights,
  REPS_RANGE,
  WEIGHT_RANGE,
} from '../domain/workoutRules';
import { DEFAULT_BAR_WEIGHT, DEFAULT_PLATES, formatWeight, sortWeightsDesc } from '../domain/plates';
import type { RootStackParamList } from '../navigation/types';
import {
  getLastSetsForExercise,
  getProgram,
  getProgramExercises,
  programExerciseToExercise,
  saveWorkoutPlan,
  saveWorkoutSession,
  type Exercise,
  type SaveWorkoutPlan,
  type SaveWorkoutSet,
} from '../services/database';
import {
  getBarWeight,
  getCustomBars,
  getCustomPlates,
  getEnabledPlates,
  setBarWeight,
  setCustomBars,
  setCustomPlates,
  setEnabledPlates,
} from '../services/preferences';
import PlateCalculatorModal from '../components/PlateCalculatorModal';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import { colors, neutrals } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveWorkout'>;

interface LiveSet {
  key: string;
  weight: number;
  reps: number;
  completed: boolean;
}

interface PreviousSet {
  weight: number;
  reps: number;
}

interface LiveExercise {
  workoutExoId: number;
  exercise: Exercise;
  repsMin: number;
  repsMax: number;
  baseWeight: number;
  /** Valeurs de la dernière séance, indexées par n° de série. */
  previous: Array<PreviousSet | undefined>;
  sets: LiveSet[];
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Volume lisible avec séparateur de milliers : 1250 → « 1 250 kg ». */
function formatKg(value: number): string {
  const rounded = Math.round(value);
  return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kg`;
}

function buildPlans(exercises: LiveExercise[]): SaveWorkoutPlan[] {
  return exercises.map((exercise) => ({
    workout_exo_id: exercise.workoutExoId,
    target_weight: exercise.sets[0]?.weight ?? exercise.baseWeight,
    set_weights: exercise.sets.map((set) => set.weight),
  }));
}

/** Petit logo haltère dessiné (remplace les boutons − / +). */
function BarbellIcon({ color }: { color: string }) {
  return (
    <View style={styles.barbell}>
      <View style={[styles.barbellPlate, { backgroundColor: color }]} />
      <View style={[styles.barbellRod, { backgroundColor: color }]} />
      <View style={[styles.barbellPlate, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Champ poids : saisie clavier + logo qui ouvre le calculateur de disques
 * (le + et le − ont été supprimés).
 */
function WeightField({
  value,
  onChange,
  onOpenCalculator,
}: {
  value: number;
  onChange: (value: number) => void;
  onOpenCalculator: () => void;
}) {
  const [text, setText] = useState(() => formatWeight(value));

  useEffect(() => {
    setText(formatWeight(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(text.replace(',', '.'));
    // Poids conservé tel quel (jamais arrondi), seulement borné.
    const next = Number.isFinite(parsed) ? clamp(parsed, WEIGHT_RANGE) : value;
    onChange(next);
    setText(formatWeight(next));
  };

  return (
    <View style={styles.weightBox}>
      <TextInput
        style={styles.weightInput}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
        returnKeyType="done"
      />
      <Pressable
        style={styles.calcButton}
        onPress={onOpenCalculator}
        hitSlop={6}
        accessibilityLabel="Chargement des disques"
      >
        <BarbellIcon color={colors.secondary} />
      </Pressable>
    </View>
  );
}

export default function LiveWorkoutScreen({ navigation, route }: Props) {
  const db = useSQLiteContext();
  const programId = route.params.programId;

  const [nom, setNom] = useState('');
  const [liveExercises, setLiveExercises] = useState<LiveExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Réglages du calculateur de disques (barre + disques), persistés en préférences.
  const [barWeight, setBarWeightState] = useState(DEFAULT_BAR_WEIGHT);
  const [customBars, setCustomBarsState] = useState<number[]>([]);
  const [plates, setPlatesState] = useState<number[]>([...DEFAULT_PLATES]);
  const [customPlates, setCustomPlatesState] = useState<number[]>([]);
  /** Série dont on affiche le calculateur de chargement (null = fermé). */
  const [calc, setCalc] = useState<{ exIndex: number; setIndex: number } | null>(null);
  /** Exercice affiché en grand (image + tuto). */
  const [detail, setDetail] = useState<Exercise | null>(null);

  const startRef = useRef(Date.now());
  const keySeq = useRef(0);

  const nextKey = () => {
    keySeq.current += 1;
    return `set-${keySeq.current}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [program, rows] = await Promise.all([
          getProgram(db, programId),
          getProgramExercises(db, programId),
        ]);
        const [savedBar, savedCustomBars, savedPlates, savedCustomPlates] = await Promise.all([
          getBarWeight(),
          getCustomBars(),
          getEnabledPlates(),
          getCustomPlates(),
        ]);
        const previousSets = await Promise.all(
          rows.map((row) => getLastSetsForExercise(db, programId, row.exercise_id ?? 0))
        );
        if (!mounted) return;
        setNom(program?.nom_seance ?? 'Séance');
        setBarWeightState(savedBar);
        setCustomBarsState(savedCustomBars);
        setPlatesState(savedPlates);
        setCustomPlatesState(savedCustomPlates);

        setLiveExercises(
          rows.map((row, rowIndex) => {
            const exercise = programExerciseToExercise(row);
            const baseWeight = row.target_weight ?? 0;
            const series = Math.max(1, row.series ?? 3);
            const weights = fitWeights(parseWeights(row.set_weights) ?? [], series, baseWeight);

            const previous: Array<PreviousSet | undefined> = [];
            for (const set of previousSets[rowIndex]) {
              previous[set.set_num - 1] = { weight: set.weight, reps: set.reps };
            }

            return {
              workoutExoId: row.id,
              exercise,
              repsMin: row.reps_min ?? REPS_RANGE.min,
              repsMax: row.reps_max ?? REPS_RANGE.min,
              baseWeight,
              previous,
              sets: Array.from({ length: series }, (_, index) => ({
                key: nextKey(),
                weight: weights[index] ?? baseWeight,
                reps: 0,
                completed: false,
              })),
            };
          })
        );
        setLoading(false);
        setReady(true);
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

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Sauvegarde « inter-séance » : le poids est écrit au fil de la séance
  // (jamais le nombre de séries), pour se reporter même sans terminer.
  useEffect(() => {
    if (!ready) return;
    const plans = buildPlans(liveExercises);
    const id = setTimeout(() => {
      void saveWorkoutPlan(db, plans);
    }, 800);
    return () => clearTimeout(id);
  }, [liveExercises, ready, db]);

  const changeWeight = (exIndex: number, setIndex: number, value: number) => {
    setLiveExercises((prev) =>
      prev.map((exercise, i) => {
        if (i !== exIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, j) =>
            // La série 1 applique son poids à toutes ; les autres sont indépendantes.
            setIndex === 0 || j === setIndex ? { ...set, weight: value } : set
          ),
        };
      })
    );
  };

  const changeReps = (exIndex: number, setIndex: number, text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    const reps = digits ? Math.min(REPS_RANGE.max, Number.parseInt(digits, 10)) : 0;
    setLiveExercises((prev) =>
      prev.map((exercise, i) =>
        i === exIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, j) =>
                // Saisir des reps coche la série (vide = décoche).
                j === setIndex ? { ...set, reps, completed: reps > 0 } : set
              ),
            }
          : exercise
      )
    );
  };

  const toggleSet = (exIndex: number, setIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((exercise, i) =>
        i === exIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, j) =>
                j === setIndex ? { ...set, completed: !set.completed } : set
              ),
            }
          : exercise
      )
    );
  };

  /** Coche d'exercice : valide toutes les séries, ou les décoche si tout était validé. */
  const toggleAllSets = (exIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((exercise, i) => {
        if (i !== exIndex) return exercise;
        const allDone = exercise.sets.every((set) => set.completed);
        return {
          ...exercise,
          sets: exercise.sets.map((set) => ({ ...set, completed: !allDone })),
        };
      })
    );
  };

  const addSet = (exIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((exercise, i) => {
        if (i !== exIndex) return exercise;
        const last = exercise.sets[exercise.sets.length - 1];
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              key: nextKey(),
              weight: last ? last.weight : exercise.baseWeight,
              reps: 0,
              completed: false,
            },
          ],
        };
      })
    );
  };

  const removeSet = (exIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((exercise, i) =>
        i === exIndex && exercise.sets.length > 1
          ? { ...exercise, sets: exercise.sets.slice(0, -1) }
          : exercise
      )
    );
  };

  // --- Réglages du calculateur de disques -----------------------------------

  const selectBar = (value: number) => {
    setBarWeightState(value);
    void setBarWeight(value);
  };

  const addBar = (value: number) => {
    const next = sortWeightsDesc([...customBars, value]);
    setCustomBarsState(next);
    void setCustomBars(next);
    selectBar(value);
  };

  const removeBar = (value: number) => {
    const next = customBars.filter((item) => item !== value);
    setCustomBarsState(next);
    void setCustomBars(next);
    if (barWeight === value) selectBar(DEFAULT_BAR_WEIGHT);
  };

  const togglePlate = (value: number) => {
    const next = plates.includes(value)
      ? plates.filter((item) => item !== value)
      : sortWeightsDesc([...plates, value]);
    setPlatesState(next);
    void setEnabledPlates(next);
  };

  const addPlate = (value: number) => {
    const nextCustom = sortWeightsDesc([...customPlates, value]);
    setCustomPlatesState(nextCustom);
    void setCustomPlates(nextCustom);
    if (!plates.includes(value)) {
      const next = sortWeightsDesc([...plates, value]);
      setPlatesState(next);
      void setEnabledPlates(next);
    }
  };

  const removePlate = (value: number) => {
    const nextCustom = customPlates.filter((item) => item !== value);
    setCustomPlatesState(nextCustom);
    void setCustomPlates(nextCustom);
    if (plates.includes(value)) {
      const next = plates.filter((item) => item !== value);
      setPlatesState(next);
      void setEnabledPlates(next);
    }
  };

  const persist = async () => {
    try {
      setSaving(true);
      const sets: SaveWorkoutSet[] = [];
      let volume = 0;

      for (const exercise of liveExercises) {
        exercise.sets.forEach((set, index) => {
          volume += set.weight * set.reps;
          if (set.completed || set.reps > 0) {
            sets.push({
              exercise_id: exercise.exercise.id,
              set_num: index + 1,
              weight: set.weight,
              reps: set.reps,
              completed: set.completed,
            });
          }
        });
      }

      await saveWorkoutSession(db, {
        program_id: programId,
        date: new Date().toISOString(),
        duration_sec: elapsed,
        total_volume: Math.round(volume * 100) / 100,
        sets,
        plans: buildPlans(liveExercises),
      });
      navigation.goBack();
    } catch (cause: unknown) {
      setSaving(false);
      Alert.alert('Erreur', cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
  };

  const onStop = () => {
    Alert.alert('Arrêter la séance', 'Enregistrer les séries réalisées et terminer la séance ?', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Terminer', style: 'destructive', onPress: persist },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const volume = liveExercises.reduce(
    (total, exercise) =>
      total + exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
    0
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{nom}</Text>
          <View style={styles.headerMetrics}>
            <Text style={styles.headerTime}>{formatClock(elapsed)}</Text>
            <Text style={styles.headerTotal}>{formatKg(volume)}</Text>
          </View>
        </View>

        {liveExercises.length === 0 ? (
          <Text style={styles.emptyText}>
            Cette séance n’a pas d’exercice. Modifie-la depuis « Mes séances ».
          </Text>
        ) : (
          liveExercises.map((exercise, exIndex) => {
            const allDone =
              exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);
            const thumb = exercise.exercise.image
              ? exerciseImages[exercise.exercise.image]
              : undefined;
            return (
              <View key={exercise.workoutExoId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Pressable
                    style={styles.cardTitleBlock}
                    onPress={() => setDetail(exercise.exercise)}
                    accessibilityLabel="Voir l’exercice"
                  >
                    {thumb ? (
                      <Image source={thumb} style={styles.cardThumb} />
                    ) : (
                      <View style={[styles.cardThumb, styles.cardThumbPlaceholder]} />
                    )}
                    <Text style={styles.cardTitle}>
                      {exercise.exercise.nom_fr ?? exercise.exercise.nom}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.cardCheck, allDone && styles.cardCheckOn]}
                    onPress={() => toggleAllSets(exIndex)}
                    hitSlop={6}
                  >
                    <Text style={[styles.cardCheckText, allDone && styles.cardCheckTextOn]}>✓</Text>
                  </Pressable>
                </View>

                {exercise.sets.map((set, setIndex) => {
                  const previous = exercise.previous[setIndex];
                  return (
                    <View key={set.key} style={styles.setRow}>
                      <Text style={styles.setLabel}>{setIndex + 1}</Text>
                      <Text style={styles.previousText}>
                        {previous ? `${formatWeight(previous.weight)}×${previous.reps}` : '—'}
                      </Text>

                      <WeightField
                        value={set.weight}
                        onChange={(value) => changeWeight(exIndex, setIndex, value)}
                        onOpenCalculator={() => setCalc({ exIndex, setIndex })}
                      />

                      <TextInput
                        style={styles.repsInput}
                        value={set.reps > 0 ? String(set.reps) : ''}
                        onChangeText={(text) => changeReps(exIndex, setIndex, text)}
                        placeholder={`${exercise.repsMin}–${exercise.repsMax}`}
                        placeholderTextColor={neutrals.textMuted}
                        keyboardType="number-pad"
                        returnKeyType="done"
                      />

                      <Pressable
                        style={[styles.check, set.completed && styles.checkOn]}
                        onPress={() => toggleSet(exIndex, setIndex)}
                      >
                        <Text style={[styles.checkText, set.completed && styles.checkTextOn]}>✓</Text>
                      </Pressable>
                    </View>
                  );
                })}

                <View style={styles.setActions}>
                  <Pressable style={styles.setActionButton} onPress={() => removeSet(exIndex)}>
                    <Text style={styles.setActionText}>− Série</Text>
                  </Pressable>
                  <Pressable style={styles.setActionButton} onPress={() => addSet(exIndex)}>
                    <Text style={styles.setActionText}>+ Série</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.stopButton, saving && styles.stopButtonDisabled]}
          onPress={onStop}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.stopButtonText}>Arrêter la séance</Text>
          )}
        </Pressable>
      </View>

      {calc ? (
        <PlateCalculatorModal
          visible
          weight={liveExercises[calc.exIndex]?.sets[calc.setIndex]?.weight ?? 0}
          barWeight={barWeight}
          customBars={customBars}
          plates={plates}
          customPlates={customPlates}
          onChangeWeight={(value) => changeWeight(calc.exIndex, calc.setIndex, value)}
          onSelectBar={selectBar}
          onAddBar={addBar}
          onRemoveBar={removeBar}
          onTogglePlate={togglePlate}
          onAddPlate={addPlate}
          onRemovePlate={removePlate}
          onClose={() => setCalc(null)}
        />
      ) : null}

      <ExerciseDetailModal
        exercise={detail}
        visible={detail !== null}
        onClose={() => setDetail(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
    backgroundColor: neutrals.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: neutrals.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 18,
  },
  headerTitle: {
    color: neutrals.text,
    fontSize: 18,
    fontWeight: '800',
    maxWidth: '100%',
  },
  headerMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
  },
  headerTime: {
    color: colors.secondary,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  headerTotal: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
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
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  cardThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: neutrals.surfaceAlt,
  },
  cardThumbPlaceholder: {
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  cardTitle: {
    flex: 1,
    color: neutrals.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardCheck: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  cardCheckOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cardCheckText: {
    color: neutrals.textMuted,
    fontSize: 20,
    fontWeight: '800',
  },
  cardCheckTextOn: {
    color: colors.background,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    columnGap: 8,
  },
  setLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    width: 16,
    textAlign: 'center',
  },
  previousText: {
    color: neutrals.textMuted,
    fontSize: 11,
    minWidth: 40,
  },
  weightBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: neutrals.surfaceAlt,
    borderRadius: 10,
    height: 40,
    paddingLeft: 2,
  },
  weightInput: {
    flex: 1,
    textAlign: 'center',
    color: neutrals.text,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },
  calcButton: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barbell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barbellPlate: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
  },
  barbellRod: {
    width: 13,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 1,
  },
  repsInput: {
    width: 46,
    height: 40,
    textAlign: 'center',
    color: neutrals.text,
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: neutrals.surfaceAlt,
    borderRadius: 10,
  },
  check: {
    width: 36,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  checkOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkText: {
    color: neutrals.textMuted,
    fontSize: 18,
    fontWeight: '800',
  },
  checkTextOn: {
    color: colors.background,
  },
  setActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  setActionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: neutrals.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  setActionText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: neutrals.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.alert,
    fontSize: 15,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
    backgroundColor: colors.background,
  },
  stopButton: {
    backgroundColor: colors.alert,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopButtonDisabled: {
    opacity: 0.6,
  },
  stopButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
});
