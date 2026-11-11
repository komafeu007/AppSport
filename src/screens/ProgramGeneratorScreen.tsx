import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  DashedLine,
  Icon,
  IconButton,
  PressableScale,
  ScreenHeader,
  SectionTitle,
  StateView,
  StatTiles,
} from '../components/ui';
import { padIndex } from '../lib/format';
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
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { MAX_FONT_SCALE, fontFamily, spacing, text } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'ProgramGenerator' | 'WelcomeGenerator'>;

/** Libellé court de 4 lettres d'un muscle pour l'axe du graphique. */
const MUSCLE_SHORT: Record<string, string> = {
  pectoraux: 'PEC',
  dos: 'DOS',
  quadriceps: 'QUAD',
  épaules: 'ÉPA',
  epaules: 'ÉPA',
  ischios: 'ISCH',
  'ischio-jambiers': 'ISCH',
  abdos: 'ABDO',
  abdominaux: 'ABDO',
  fessiers: 'FESS',
  biceps: 'BICE',
  triceps: 'TRIC',
  mollets: 'MOLL',
  avant: 'AVBR',
};

function shortMuscle(label: string): string {
  const key = label.trim().toLowerCase();
  return MUSCLE_SHORT[key] ?? label.trim().slice(0, 4).toUpperCase();
}

/** Repos « 2:15 ». */
function restClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Une ligne d'exercice planifié : référence, nom, séries × reps, repos, et « relancer ». */
function ExerciseRow({
  planned,
  index,
  last,
  onReroll,
  rerolling = false,
}: {
  planned: PlannedExercise;
  index: number;
  last: boolean;
  /** Propose une autre variante de cet exercice (absent = pas de bouton). */
  onReroll?: () => void;
  rerolling?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { exercise } = planned;

  return (
    <View style={styles.exerciseRow}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.exerciseRef}>{`A.${padIndex(index + 1, 2)}`}</Text>
      <View style={styles.exerciseText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.exerciseName} numberOfLines={2}>
          {exerciseDisplayName(exercise)}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.exerciseMeta} accessibilityLabel={describePlannedExercise(planned)}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.exerciseScheme}>
            {`${planned.series}×${planned.repsMin}–${planned.repsMax}`}
          </Text>
          {` · REPOS ${restClock(planned.restTime)}`}
        </Text>
      </View>
      {onReroll ? (
        <IconButton
          icon={rerolling ? 'more' : 'swap'}
          tone="neutral"
          size={36}
          accessibilityLabel="Proposer un autre exercice"
          onPress={onReroll}
        />
      ) : null}
      {last ? null : <DashedLine style={styles.exerciseDivider} />}
    </View>
  );
}

/**
 * Aperçu d'un programme généré (Module 2) : le moteur propose, l'utilisateur
 * valide. Rien n'est écrit en base avant « Enregistrer ce programme » — « Régénérer »
 * relance simplement le moteur avec une nouvelle graine.
 */
export default function ProgramGeneratorScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
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
  /** Séances dépliées (la première l'est d'office). */
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
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
        setError('Aucune autre variante avec ton matériel.');
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

  const totalSets = plan ? plan.sessions.reduce((n, session) => n + sessionSummary(session).sets, 0) : 0;
  const avgMinutes =
    plan && plan.sessions.length > 0
      ? Math.round(
          plan.sessions.reduce((n, session) => n + session.estimatedMinutes, 0) /
            plan.sessions.length
        )
      : 0;
  const maxSets = plan ? Math.max(1, ...plan.weeklySets.map((item) => item.sets)) : 1;
  const topTwo = plan
    ? [...plan.weeklySets]
        .sort((a, b) => b.sets - a.sets)
        .slice(0, 2)
        .map((item) => item.muscle)
    : [];
  const sessionCount = plan?.sessions.length ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker="Aperçu"
          title={route.params && 'reason' in route.params && route.params.reason === 'bloc' ? 'Nouveau bloc' : 'Ton programme'}
          compact
          style={styles.header}
        />
        {plan ? (
          <View style={styles.body}>
            <View style={styles.previewTag}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.previewTagText}>APERÇU · NON ENREGISTRÉ</Text>
            </View>

            <StatTiles
              style={styles.section}
              tiles={[
                { label: 'FRÉQ.', value: `${sessionCount}×`, unit: '/SEM', accent: true },
                { label: 'SÉRIES', value: String(totalSets) },
                { label: 'DURÉE', value: `≈${avgMinutes}′` },
              ]}
            />

            <View style={styles.section}>
              <SectionTitle hint="SÉRIES / SEM.">Volume par muscle</SectionTitle>
              <View style={styles.chart}>
                {plan.weeklySets.map((item) => {
                  const top = topTwo.includes(item.muscle);
                  return (
                    <View
                      key={item.muscle}
                      style={styles.barCol}
                      accessible
                      accessibilityLabel={`${item.label} : ${item.sets} séries par semaine`}
                    >
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.barValue}>{item.sets}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            top ? styles.barTop : styles.barPlain,
                            { height: Math.max(4, Math.round((item.sets / maxSets) * 96)) },
                          ]}
                        >
                          {top ? null : <View style={styles.barCut} />}
                        </View>
                      </View>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.barLabel} numberOfLines={1}>
                        {shortMuscle(item.label)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <SectionTitle hint={`${sessionCount} MODULES`}>Séances</SectionTitle>
              {plan.sessions.map((session, sessionIndex) => {
                const summary = sessionSummary(session);
                const open = expanded[sessionIndex] === true;
                const toggle = () =>
                  setExpanded((prev) => ({ ...prev, [sessionIndex]: !prev[sessionIndex] }));
                return (
                  <View key={session.nom} style={styles.module}>
                    <PressableScale
                      onPress={toggle}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      accessibilityLabel={`${session.nom}, ${summary.exercises} exercices, ${summary.sets} séries`}
                      scaleTo={0.99}
                      style={styles.moduleHeader}
                    >
                      <View style={styles.moduleTitleWrap}>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.moduleKicker} numberOfLines={1}>
                          {open
                            ? `MODULE ${sessionIndex + 1}/${sessionCount} · ${padIndex(summary.exercises, 2)} EXOS · ${padIndex(summary.sets, 2)} SÉRIES`
                            : `MOD. ${sessionIndex + 1}/${sessionCount}`}
                        </Text>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.moduleName} numberOfLines={1}>
                          {session.nom}
                        </Text>
                      </View>
                      {open ? (
                        <View style={styles.moduleSquare} />
                      ) : (
                        <View style={styles.modulePlus}>
                          <Icon name="plus" size={18} color={theme.colors.text} />
                        </View>
                      )}
                    </PressableScale>
                    {open ? (
                      <View style={styles.moduleBody}>
                        {session.exercises.map((planned, exerciseIndex) => (
                          <ExerciseRow
                            key={`${session.nom}-${exerciseIndex}-${planned.exercise.id}`}
                            planned={planned}
                            index={exerciseIndex}
                            last={exerciseIndex === session.exercises.length - 1}
                            onReroll={() => handleReroll(sessionIndex, exerciseIndex)}
                            rerolling={
                              rerolling?.sessionIndex === sessionIndex &&
                              rerolling.exerciseIndex === exerciseIndex
                            }
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={[styles.protocol, styles.section]}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.protocolTitle}>{`PROTOCOLE · BLOC DE ${BLOCK_WEEKS} SEMAINES`}</Text>
              {plan.rationale.map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.bullet}>{line}</Text>
                </View>
              ))}
              {plan.warnings.map((warning) => (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={warning} style={styles.warningText}>
                  {warning}
                </Text>
              ))}
            </View>

            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.note}>
              Le programme part de tes charges habituelles. Tu montes le poids dès que tu atteins le haut de la fourchette. Un exercice ne te convient pas ? Relance-le avec le bouton d’échange. Tout reste modifiable dans l’éditeur.
            </Text>

            {error ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Les barres d'action fixes réservent la zone système du bas. */}
      <View style={{ paddingBottom: insets.bottom + spacing.md }}>
        <View style={styles.footer}>
          <Button
            label="Relancer"
            variant="secondary"
            leading={<Icon name="refresh" size={18} color={theme.colors.text} />}
            onPress={() => setSeed(newSeed())}
            disabled={saving || loading}
            style={styles.footerSecondary}
          />
          <Button
            label="Enregistrer"
            code="OK"
            onPress={handleSave}
            loading={saving}
            disabled={!plan || loading}
            style={styles.footerButton}
          />
        </View>

        {fromOnboarding ? (
          <Button
            label="Créer mes séances moi-même"
            variant="tertiary"
            onPress={handleSkip}
            disabled={saving}
            style={styles.skip}
          />
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.xl,
  },
  section: {
    marginTop: spacing.xl,
  },
  previewTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.action,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  previewTagText: {
    ...text.caption,
    color: theme.colors.action,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  barValue: {
    ...text.monoValue,
    color: theme.colors.text,
  },
  barTrack: {
    height: 96,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    overflow: 'hidden',
  },
  barTop: {
    backgroundColor: theme.colors.action,
  },
  barPlain: {
    backgroundColor: theme.colors.selectedSurface,
  },
  // Petite coupe en biais en bas à droite des barres crème.
  barCut: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: theme.colors.background,
    transform: [{ rotate: '45deg' }],
  },
  barLabel: {
    ...text.caption,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  module: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  moduleTitleWrap: {
    flex: 1,
    gap: 2,
  },
  moduleKicker: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  moduleName: {
    ...text.title,
    color: theme.colors.text,
  },
  moduleSquare: {
    width: 10,
    height: 10,
    backgroundColor: theme.colors.action,
  },
  modulePlus: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  moduleBody: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderStrong,
    paddingHorizontal: spacing.lg,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  exerciseRef: {
    ...text.caption,
    color: theme.colors.textMuted,
    width: 36,
  },
  exerciseText: {
    flex: 1,
  },
  exerciseName: {
    ...text.cardTitle,
    color: theme.colors.text,
  },
  exerciseMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  exerciseScheme: {
    fontFamily: fontFamily.monoBold,
    color: theme.colors.action,
  },
  exerciseDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  protocol: {
    borderWidth: 1,
    borderColor: theme.colors.success,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  protocolTitle: {
    ...text.caption,
    color: theme.colors.success,
    marginBottom: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    backgroundColor: theme.colors.success,
    // Centre la puce sur la première ligne de texte (22 px).
    marginTop: 8,
  },
  bullet: {
    ...text.body,
    color: theme.colors.text,
    flex: 1,
  },
  warningText: {
    ...text.meta,
    color: theme.colors.danger,
    marginTop: spacing.sm,
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
  footerSecondary: {
    flex: 2,
  },
  footerButton: {
    flex: 3,
  },
  skip: {
    marginBottom: spacing.lg,
  },
});
