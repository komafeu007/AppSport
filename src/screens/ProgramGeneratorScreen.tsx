import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Appear, Button, Card, SectionTitle, StateView, Thumb } from '../components/ui';
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
import { BLOCK_WEEKS, buildPlan, newSeed, savePlan, sessionSummary } from '../services/programGeneration';
import { colors, neutrals } from '../theme/colors';
import { radius, spacing, text } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'ProgramGenerator' | 'WelcomeGenerator'>;

/** Une ligne d'exercice planifié : vignette, nom, séries × reps et repos. */
function ExerciseRow({ planned }: { planned: PlannedExercise }) {
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
    </View>
  );
}

/**
 * Aperçu d'un programme généré (Module 2) : le moteur propose, l'utilisateur
 * valide. Rien n'est écrit en base avant « Enregistrer ce programme » — « Régénérer »
 * relance simplement le moteur avec une nouvelle graine.
 */
export default function ProgramGeneratorScreen({ navigation, route }: Props) {
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
              <Appear delay={60} style={styles.section}>
                {plan.warnings.map((warning) => (
                  <Card key={warning} tone="danger" style={styles.warning}>
                    <Text style={styles.warningText}>{warning}</Text>
                  </Card>
                ))}
              </Appear>
            ) : null}

            <Appear delay={100} style={styles.section}>
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

            <Appear delay={140} style={styles.section}>
              <SectionTitle>{`Séances (${plan.sessions.length})`}</SectionTitle>
              {plan.sessions.map((session) => {
                const summary = sessionSummary(session);
                return (
                  <Card key={session.nom} style={styles.sessionCard}>
                    <Text style={styles.sessionName}>{session.nom}</Text>
                    <Text style={styles.sessionMeta}>
                      {summary.exercises} exercices · {summary.sets} séries · ≈ {summary.minutes} min
                    </Text>
                    {session.exercises.map((planned) => (
                      <ExerciseRow key={`${session.nom}-${planned.exercise.id}`} planned={planned} />
                    ))}
                  </Card>
                );
              })}
            </Appear>

            <Text style={styles.note}>
              Le programme démarre sur tes charges habituelles et se règle en séance : dès que tu
              atteins le haut de la fourchette de répétitions, tu montes le poids et tu repars au
              minimum. Tout reste modifiable dans l’éditeur de séance.
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
          variant="ghost"
          onPress={handleSkip}
          disabled={saving}
          style={styles.skip}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.accent,
  },
  bullet: {
    ...text.body,
    color: neutrals.text,
    flex: 1,
  },
  warning: {
    marginBottom: spacing.sm,
  },
  warningText: {
    ...text.meta,
    color: colors.alert,
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
    borderRadius: radius.pill,
    backgroundColor: neutrals.surface,
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  volumeLabel: {
    ...text.caption,
    color: neutrals.textMuted,
  },
  volumeValue: {
    ...text.label,
    color: colors.accent,
  },
  sessionCard: {
    marginBottom: spacing.md,
  },
  sessionName: {
    ...text.cardTitle,
    color: neutrals.text,
  },
  sessionMeta: {
    ...text.caption,
    color: neutrals.textMuted,
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
    color: neutrals.text,
  },
  exerciseMeta: {
    ...text.caption,
    color: colors.secondary,
    marginTop: 2,
  },
  note: {
    ...text.meta,
    color: neutrals.textMuted,
    marginTop: spacing.xl,
  },
  error: {
    ...text.meta,
    color: colors.alert,
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
    backgroundColor: colors.background,
  },
  footerButton: {
    flex: 1,
  },
  skip: {
    marginBottom: spacing.lg,
  },
});
