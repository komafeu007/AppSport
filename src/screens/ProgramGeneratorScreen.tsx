import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Appear, Button, Card, IconButton, SectionTitle, StateView, Thumb } from '../components/ui';
import { exerciseImages } from '../data/exerciseImages';
import {
  describePlannedExercise,
  exerciseDisplayName,
  type GeneratedProgram,
  type PlannedExercise,
} from '../domain/programGenerator';
import type { RootStackParamList } from '../navigation/types';
import { useAccount } from '../services/account';
import { getAccount, type Account } from '../services/database';
import {
  BLOCK_WEEKS,
  buildPlan,
  newSeed,
  rerollExercise,
  savePlan,
  sessionSummary,
} from '../services/programGeneration';
import { useThemedStyles, type Theme } from '../theme';
import { radius, spacing, text } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'ProgramGenerator' | 'WelcomeGenerator'>;

/** Une ligne d'exercice planifié : vignette, nom, séries × reps, repos, et « relancer ». */
function ExerciseRow({
  planned,
  onReroll,
  rerolling = false,
}: {
  planned: PlannedExercise;
  /** Propose une autre variante de cet exercice (absent = pas de bouton). */
  onReroll?: () => void;
  rerolling?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { exercise } = planned;
  const source = exercise.image ? exerciseImages[exercise.image] : undefined;

  return (
    <View style={styles.exerciseRow}>
      <Thumb source={source} size={44} accessibilityLabel={exerciseDisplayName(exercise)} />
      <View style={styles.exerciseText}>
        <Text style={styles.exerciseName} numberOfLines={2}>
          {exerciseDisplayName(exercise)}
        </Text>
        <Text style={styles.exerciseMeta}>{describePlannedExercise(planned)}</Text>
      </View>
      {onReroll ? (
        <IconButton
          glyph={rerolling ? '⋯' : '↻'}
          tone="neutral"
          size={36}
          accessibilityLabel="Proposer un autre exercice"
          onPress={onReroll}
        />
      ) : null}
    </View>
  );
}

/**
 * Aperçu d'un programme généré (Module 2) : le moteur propose, l'utilisateur
 * valide. Rien n'est écrit en base avant « Enregistrer ce programme » — « Régénérer »
 * relance simplement le moteur avec une nouvelle graine.
 */
export default function ProgramGeneratorScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { accountId: activeAccountId, account: activeAccount, select } = useAccount();

  const targetAccountId = route.params?.accountId ?? activeAccountId;
  /** Pendant l'onboarding, le profil n'est pas encore actif : il le devient en sortant. */
  const fromOnboarding = route.params?.accountId != null && route.params.accountId !== activeAccountId;

  const [account, setAccount] = useState<Account | null>(activeAccount);
  const [seed, setSeed] = useState(() => newSeed());
  const [plan, setPlan] = useState<GeneratedProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Exercice en cours de « relance » : la ligne affiche un état d'attente. */
  const [rerolling, setRerolling] = useState<{
    sessionIndex: number;
    exerciseIndex: number;
  } | null>(null);

  // Profil visé : le compte actif, ou celui qu'on vient de créer (onboarding).
  useEffect(() => {
    if (targetAccountId == null) {
      setError('Aucun profil à équiper.');
      setLoading(false);
      return;
    }
    if (activeAccount && activeAccount.id === targetAccountId) {
      setAccount(activeAccount);
      return;
    }
    let mounted = true;
    getAccount(db, targetAccountId)
      .then((row) => {
        if (!mounted) return;
        if (!row) {
          setError('Profil introuvable.');
          setLoading(false);
          return;
        }
        setAccount(row);
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeAccount, db, targetAccountId]);

  // Génération : rejouée à chaque nouvelle graine (« Régénérer »).
  useEffect(() => {
    if (!account) return;
    let mounted = true;
    setLoading(true);
    buildPlan(db, account, seed)
      .then((result) => {
        if (!mounted) return;
        setPlan(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Génération impossible.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account, db, seed]);

  const handleSave = async () => {
    if (!plan || !account) return;
    setSaving(true);
    try {
      await savePlan(db, account.id, plan);
      if (fromOnboarding) {
        // Le profil devient actif : la navigation bascule sur la pile app.
        await select(account.id);
      } else {
        navigation.goBack();
      }
    } catch (cause: unknown) {
      setSaving(false);
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
  };

  /** Onboarding : entrer dans l'app sans programme généré (tout reste modifiable). */
  const handleSkip = async () => {
    if (!account) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    await select(account.id);
  };

  /** « Relancer » un exercice : variante du même muscle, le reste ne bouge pas. */
  const handleReroll = async (sessionIndex: number, exerciseIndex: number) => {
    if (!plan || !account || rerolling !== null) return;
    setRerolling({ sessionIndex, exerciseIndex });
    try {
      const replacement = await rerollExercise(db, account, plan, sessionIndex, exerciseIndex);
      if (replacement === null) {
        setError('Aucune autre variante disponible avec ce matériel pour cet exercice.');
        return;
      }
      setError(null);
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sessions: prev.sessions.map((session, sIndex) =>
            sIndex !== sessionIndex
              ? session
              : {
                  ...session,
                  exercises: session.exercises.map((item, eIndex) =>
                    eIndex === exerciseIndex ? replacement : item
                  ),
                }
          ),
        };
      });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Remplacement impossible.');
    } finally {
      setRerolling(null);
    }
  };

  if (loading && !plan) {
    return (
      <View style={styles.container}>
        <StateView kind="loading" />
      </View>
    );
  }

  if (error && !plan) {
    return (
      <View style={styles.container}>
        <StateView kind="error" message={error} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {plan ? (
          <>
            <Appear>
              <Card tone="accent">
                <SectionTitle hint={`bloc de ${BLOCK_WEEKS} semaines`}>
                  Pourquoi ce programme ?
                </SectionTitle>
                {plan.rationale.map((line) => (
                  <View key={line} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bullet}>{line}</Text>
                  </View>
                ))}
              </Card>
            </Appear>

            {plan.warnings.length > 0 ? (
              <Appear style={styles.section}>
                {plan.warnings.map((warning) => (
                  <View key={warning} style={styles.warning}>
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
              </Appear>
            ) : null}

            <Appear style={styles.section}>
              <SectionTitle hint="séries / semaine">Volume par muscle</SectionTitle>
              <View style={styles.volumeWrap}>
                {plan.weeklySets.map((item) => (
                  <View key={item.muscle} style={styles.volumeChip}>
                    <Text style={styles.volumeLabel}>{item.label}</Text>
                    <Text style={styles.volumeValue}>{item.sets}</Text>
                  </View>
                ))}
              </View>
            </Appear>

            <Appear style={styles.section}>
              <SectionTitle>{`Séances (${plan.sessions.length})`}</SectionTitle>
              {plan.sessions.map((session, sessionIndex) => {
                const summary = sessionSummary(session);
                return (
                  <View key={session.nom} style={styles.sessionCard}>
                    <Text style={styles.sessionName}>{session.nom}</Text>
                    <Text style={styles.sessionMeta}>
                      {summary.exercises} exercices · {summary.sets} séries · ≈ {summary.minutes} min
                    </Text>
                    {session.exercises.map((planned, exerciseIndex) => (
                      <ExerciseRow
                        key={`${session.nom}-${exerciseIndex}-${planned.exercise.id}`}
                        planned={planned}
                        onReroll={() => handleReroll(sessionIndex, exerciseIndex)}
                        rerolling={
                          rerolling?.sessionIndex === sessionIndex &&
                          rerolling.exerciseIndex === exerciseIndex
                        }
                      />
                    ))}
                  </View>
                );
              })}
            </Appear>

            <Text style={styles.note}>
              Le programme démarre sur tes charges habituelles et se règle en séance : dès que tu
              atteins le haut de la fourchette de répétitions, tu montes le poids et tu repars au
              minimum. Un exercice qui ne te convient pas ? Appuie sur ↻ pour en proposer un autre,
              et tout reste modifiable dans l’éditeur de séance.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Régénérer"
          variant="secondary"
          onPress={() => setSeed(newSeed())}
          disabled={saving || loading}
          style={styles.footerButton}
        />
        <Button
          label="Enregistrer ce programme"
          onPress={handleSave}
          loading={saving}
          disabled={!plan || loading}
          style={styles.footerButton}
        />
      </View>

      {fromOnboarding ? (
        <Button
          label="Plus tard — je crée mes séances moi-même"
          variant="tertiary"
          onPress={handleSkip}
          disabled={saving}
          style={styles.skip}
        />
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginTop: spacing.xl,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bulletDot: {
    ...text.body,
    color: theme.colors.action,
  },
  bullet: {
    ...text.body,
    color: theme.colors.text,
    flex: 1,
  },
  warning: {
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.danger,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  warningText: {
    ...text.meta,
    color: theme.colors.danger,
  },
  volumeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  volumeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  volumeLabel: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  volumeValue: {
    ...text.label,
    color: theme.colors.action,
  },
  sessionCard: {
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sessionName: {
    ...text.cardTitle,
    color: theme.colors.text,
  },
  sessionMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  exerciseText: {
    flex: 1,
  },
  exerciseName: {
    ...text.bodyStrong,
    color: theme.colors.text,
  },
  exerciseMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  note: {
    ...text.meta,
    color: theme.colors.textMuted,
    marginTop: spacing.xl,
  },
  error: {
    ...text.meta,
    color: theme.colors.danger,
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  footerButton: {
    flex: 1,
  },
  skip: {
    marginBottom: spacing.lg,
  },
});
