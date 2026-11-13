import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DurationField from '../components/DurationField';
import {
  Button,
  ConfirmSheet,
  DashedLine,
  IconButton,
  ScreenHeader,
  SectionTitle,
  StateView,
  type ConfirmRequest,
} from '../components/ui';
import { formatWeight } from '../domain/plates';
import { clamp, REPS_RANGE, WEIGHT_RANGE } from '../domain/workoutRules';
import { padIndex } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import {
  getSessionSets,
  getSessionSummary,
  updateCompletedSession,
  type SaveWorkoutSet,
} from '../services/database';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { scale, MAX_FONT_SCALE, fontFamily, radius, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'CompletedSessionEdit'>;

interface EditSet {
  weight: number;
  reps: number;
  durationSec: number;
  completed: boolean;
}

interface EditExercise {
  id: number;
  name: string;
  /** Exercice chronométré (endurance) : on corrige la durée, pas les reps/charge. */
  timed: boolean;
  sets: EditSet[];
}

/** Champ numérique compact (poids ou reps), validé à la sortie du champ. */
function NumberField({
  value,
  onChange,
  format,
  parse,
  decimal,
  accessibilityLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  parse: (raw: number) => number;
  decimal?: boolean;
  accessibilityLabel: string;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const [draft, setDraft] = useState(() => format(value));

  useEffect(() => {
    setDraft(format(value));
  }, [value, format]);

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    const next = draft.trim() !== '' && Number.isFinite(parsed) ? parse(parsed) : value;
    onChange(next);
    setDraft(format(next));
  };

  return (
    <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={styles.numberInput}
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      returnKeyType="done"
      placeholderTextColor={theme.colors.textMuted}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const formatReps = (value: number) => String(value);
const parseWeight = (raw: number) => clamp(raw, WEIGHT_RANGE);
// 0 rep reste possible : une série notée par erreur peut aussi être supprimée.
const parseReps = (raw: number) => Math.round(clamp(raw, { ...REPS_RANGE, min: 0 }));

/**
 * Correction d'une séance terminée (erreur de saisie) : poids, reps ou durée de
 * chaque série, séries ajoutées ou retirées, durée totale. Rien n'est écrit
 * avant « Enregistrer ».
 */
export default function CompletedSessionEditScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const headerHeight = useHeaderHeight();
  const { sessionId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessionName, setSessionName] = useState('Séance');
  const [durationSec, setDurationSec] = useState(0);
  const [exercises, setExercises] = useState<EditExercise[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const summary = await getSessionSummary(db, sessionId);
        if (!summary) throw new Error('Séance introuvable.');
        const rows = await getSessionSets(db, sessionId);
        const list: EditExercise[] = [];
        const indexById = new Map<number, number>();
        for (const row of rows) {
          let index = indexById.get(row.exercise_id);
          if (index === undefined) {
            index = list.length;
            indexById.set(row.exercise_id, index);
            list.push({ id: row.exercise_id, name: row.nom, timed: false, sets: [] });
          }
          const durationValue = row.duration_sec ?? 0;
          list[index].sets.push({
            weight: row.weight,
            reps: row.reps,
            durationSec: durationValue,
            completed: row.completed === 1,
          });
          if (durationValue > 0) list[index].timed = true;
        }
        if (!mounted) return;
        setSessionName(summary.nom_seance ?? 'Séance');
        setDurationSec(summary.duration_sec ?? 0);
        setExercises(list);
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

  const updateSet = useCallback(
    (exIndex: number, setIndex: number, patch: Partial<EditSet>) => {
      setExercises((current) =>
        current.map((exercise, i) =>
          i !== exIndex
            ? exercise
            : {
                ...exercise,
                sets: exercise.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)),
              }
        )
      );
      setDirty(true);
    },
    []
  );

  const addSet = useCallback((exIndex: number) => {
    setExercises((current) =>
      current.map((exercise, i) => {
        if (i !== exIndex) return exercise;
        const last = exercise.sets[exercise.sets.length - 1];
        const next: EditSet = last
          ? { ...last, completed: true }
          : { weight: 0, reps: 0, durationSec: 0, completed: true };
        return { ...exercise, sets: [...exercise.sets, next] };
      })
    );
    setDirty(true);
  }, []);

  const removeSet = useCallback((exIndex: number, setIndex: number) => {
    setExercises((current) =>
      current.map((exercise, i) =>
        i !== exIndex
          ? exercise
          : { ...exercise, sets: exercise.sets.filter((_, j) => j !== setIndex) }
      )
    );
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const sets: SaveWorkoutSet[] = [];
      for (const exercise of exercises) {
        exercise.sets.forEach((set, index) => {
          sets.push({
            exercise_id: exercise.id,
            set_num: index + 1,
            weight: exercise.timed ? 0 : set.weight,
            reps: exercise.timed ? 0 : set.reps,
            duration_sec: exercise.timed ? set.durationSec : 0,
            completed: set.completed,
          });
        });
      }
      await updateCompletedSession(db, sessionId, { duration_sec: durationSec, sets });
      navigation.goBack();
    } catch (cause: unknown) {
      setSaving(false);
      setConfirm({
        title: 'Erreur',
        message: cause instanceof Error ? cause.message : 'Enregistrement impossible.',
        confirmLabel: 'OK',
        onConfirm: () => {},
      });
    }
  }, [db, sessionId, durationSec, exercises, navigation]);

  const cancel = useCallback(() => {
    if (!dirty) {
      navigation.goBack();
      return;
    }
    setConfirm({
      title: 'Abandonner les corrections',
      message: 'Tes modifications ne seront pas enregistrées.',
      confirmLabel: 'Abandonner',
      destructive: true,
      onConfirm: () => navigation.goBack(),
    });
  }, [dirty, navigation]);

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
          title="Séance indisponible"
          message={error}
          action={<Button label="Retour" onPress={() => navigation.goBack()} />}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            kicker="Correction"
            title={sessionName}
            subtitle="Volume et records sont recalculés."
            compact
          />

          <View style={styles.section}>
            <SectionTitle>Durée de la séance</SectionTitle>
            <DurationField
              value={durationSec}
              onChange={(value) => {
                setDurationSec(value);
                setDirty(true);
              }}
              hint
              style={styles.sectionBody}
              accessibilityLabel="Durée de la séance"
            />
          </View>

          <View style={styles.section}>
            <SectionTitle hint={`${padIndex(exercises.length)} EXOS`}>Séries</SectionTitle>
            {exercises.length === 0 ? (
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.emptyText, styles.sectionBody]}>
                Aucune série enregistrée pour cette séance.
              </Text>
            ) : null}
            {exercises.map((exercise, exIndex) => (
              <View key={exercise.id}>
                <View style={styles.exercise}>
                  <View style={styles.exerciseHead}>
                    <View style={styles.codeBox}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.codeText}>EX-{padIndex(exIndex + 1)}</Text>
                    </View>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.exerciseName} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                  </View>

                  <View style={styles.columns}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.columnLabel, styles.setCol]}>SÉRIE</Text>
                    {exercise.timed ? (
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.columnLabel, styles.fieldCol]}>DURÉE</Text>
                    ) : (
                      <>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.columnLabel, styles.fieldCol]}>KG</Text>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.columnLabel, styles.fieldCol]}>RÉPS</Text>
                      </>
                    )}
                    <View style={styles.actionCol} />
                  </View>

                  {exercise.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setRow}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.setNum, styles.setCol]}>{padIndex(setIndex + 1)}</Text>
                      {exercise.timed ? (
                        <DurationField
                          value={set.durationSec}
                          onChange={(value) => updateSet(exIndex, setIndex, { durationSec: value })}
                          style={styles.fieldCol}
                          accessibilityLabel={`Durée de la série ${setIndex + 1}`}
                        />
                      ) : (
                        <>
                          <View style={styles.fieldCol}>
                            <NumberField
                              value={set.weight}
                              onChange={(value) => updateSet(exIndex, setIndex, { weight: value })}
                              format={formatWeight}
                              parse={parseWeight}
                              decimal
                              accessibilityLabel={`Poids de la série ${setIndex + 1}`}
                            />
                          </View>
                          <View style={styles.fieldCol}>
                            <NumberField
                              value={set.reps}
                              onChange={(value) => updateSet(exIndex, setIndex, { reps: value })}
                              format={formatReps}
                              parse={parseReps}
                              accessibilityLabel={`Répétitions de la série ${setIndex + 1}`}
                            />
                          </View>
                        </>
                      )}
                      <View style={styles.actionCol}>
                        <IconButton
                          icon="close"
                          tone="danger"
                          onPress={() => removeSet(exIndex, setIndex)}
                          accessibilityLabel={`Supprimer la série ${setIndex + 1}`}
                        />
                      </View>
                    </View>
                  ))}

                  <Button
                    label="Ajouter une série"
                    variant="tertiary"
                    onPress={() => addSet(exIndex)}
                  />
                </View>
                <DashedLine />
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Enregistrer"
            code="CORR."
            size="lg"
            onPress={save}
            disabled={saving || !dirty}
          />
          <Button
            label="Annuler"
            variant="tertiary"
            onPress={cancel}
            style={styles.cancelButton}
          />
        </View>
      </KeyboardAvoidingView>

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    section: {
      marginTop: spacing.xxl,
    },
    sectionBody: {
      marginTop: spacing.md,
    },
    emptyText: {
      ...text.meta,
      color: theme.colors.textMuted,
    },
    exercise: {
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    exerciseHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    codeBox: {
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 1,
    },
    codeText: {
      ...text.caption,
      fontSize: scale(10),
      color: theme.colors.textMuted,
    },
    exerciseName: {
      ...text.cardTitle,
      color: theme.colors.text,
      flexShrink: 1,
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    columnLabel: {
      ...text.caption,
      color: theme.colors.textMuted,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    setCol: {
      width: scale(44),
    },
    fieldCol: {
      flex: 1,
    },
    actionCol: {
      width: scale(44),
      alignItems: 'center',
    },
    setNum: {
      ...text.monoValue,
      color: theme.colors.textMuted,
    },
    numberInput: {
      minHeight: scale(48),
      textAlign: 'center',
      ...text.subtitle,
      fontFamily: fontFamily.monoMedium,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderStrong,
      borderRadius: radius.control,
      paddingHorizontal: spacing.sm,
      fontVariant: ['tabular-nums'],
    },
    footer: {
      padding: spacing.xl,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    cancelButton: {
      marginTop: spacing.xs,
    },
  });
