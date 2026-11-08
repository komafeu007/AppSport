import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DurationField from '../components/DurationField';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import PlateCalculatorModal from '../components/PlateCalculatorModal';
import {
  Appear,
  Badge,
  Button,
  Card,
  ConfirmSheet,
  Icon,
  IconButton,
  PopIn,
  PressableScale,
  Row,
  StateView,
  Thumb,
  type ConfirmRequest,
} from '../components/ui';
import { exerciseImages } from '../data/exerciseImages';
import { isEndurance } from '../domain/exerciseCatalog';
import { DEFAULT_BAR_WEIGHT, DEFAULT_PLATES, formatWeight, sortWeightsDesc } from '../domain/plates';
import {
  beatsSet,
  clamp,
  DEFAULT_ENDURANCE_DURATION,
  DURATION_RANGE,
  fitWeights,
  formatPerformance,
  parseWeights,
  REPS_RANGE,
  WEIGHT_RANGE,
} from '../domain/workoutRules';
import { formatDuration, formatKg } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { useAccount } from '../services/account';
import {
  abandonActiveWorkout,
  loadActiveWorkout,
  saveActiveWorkout,
} from '../services/activeWorkout';
import {
  getExerciseBestSets,
  getLastSetsForExercise,
  getProgram,
  getProgramExercises,
  programExerciseToExercise,
  saveWorkoutPlan,
  saveWorkoutSession,
  type ExerciseBestSet,
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
  type WorkoutDraft,
} from '../services/preferences';
import {
  cancelRestDone,
  ensureRestNotifications,
  logPendingRestNotifications,
  presentRestDoneNow,
  scheduleRestDone,
} from '../services/restAlert';
import { useReduceMotion } from '../theme/motion';
import { useThemedStyles, useTheme, type Theme } from '../theme';
import { duration, easing, radius, spacing, spring, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveWorkout'>;

interface LiveSet {
  key: string;
  weight: number;
  reps: number;
  /** Durée d'effort réalisée (endurance), en secondes. */
  durationSec: number;
  completed: boolean;
}

interface PreviousSet {
  weight: number;
  reps: number;
  durationSec: number;
}

interface LiveExercise {
  workoutExoId: number;
  exercise: Exercise;
  repsMin: number;
  repsMax: number;
  /** Exercice d'endurance : la cible est une durée, pas des répétitions. */
  endurance: boolean;
  /** Durée cible par série (endurance), en secondes. */
  durationSec: number;
  /** Repos après une série, en secondes. */
  restTime: number;
  /** Bloc de superset : les exos consécutifs partageant la même valeur s'enchaînent. */
  supersetGroup: number | null;
  /** Record absolu à battre sur cet exercice (null = jamais fait). */
  bestSet: ExerciseBestSet | null;
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

function buildPlans(exercises: LiveExercise[]): SaveWorkoutPlan[] {
  return exercises.map((exercise) => ({
    workout_exo_id: exercise.workoutExoId,
    exercise_id: exercise.exercise.id,
    target_weight: exercise.sets[0]?.weight ?? exercise.baseWeight,
    set_weights: exercise.sets.map((set) => set.weight),
  }));
}

/** true si l'exercice est le dernier de son bloc de superset (ou hors superset). */
function isLastOfSuperset(exercises: LiveExercise[], index: number): boolean {
  const group = exercises[index]?.supersetGroup;
  if (group == null) return true;
  return exercises[index + 1]?.supersetGroup !== group;
}

/** Haltère du jeu d'icônes unique (ouvre le calculateur de disques). */
function BarbellIcon({ color }: { color: string }) {
  return <Icon name="dumbbell" size={22} color={color} />;
}

/**
 * Champ poids : saisie clavier + logo qui ouvre le calculateur de disques
 * (le + et le − ont été supprimés).
 */
function WeightField({
  value,
  onChange,
  onOpenCalculator,
  accessibilityLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  onOpenCalculator: () => void;
  accessibilityLabel: string;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const [draft, setDraft] = useState(() => formatWeight(value));

  useEffect(() => {
    setDraft(formatWeight(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    // Poids conservé tel quel (jamais arrondi), seulement borné.
    const next = Number.isFinite(parsed) ? clamp(parsed, WEIGHT_RANGE) : value;
    onChange(next);
    setDraft(formatWeight(next));
  };

  return (
    <View style={styles.weightBox}>
      <TextInput
        style={styles.weightInput}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
        returnKeyType="done"
        accessibilityLabel={accessibilityLabel}
      />
      <PressableScale
        style={styles.calcButton}
        onPress={onOpenCalculator}
        accessibilityLabel="Chargement des disques"
        scaleTo={0.88}
      >
        <BarbellIcon color={theme.colors.action} />
      </PressableScale>
    </View>
  );
}

/** Coche de série/exercice : le remplissage et la coche sont animés (ressort). */
function CheckToggle({
  checked,
  onPress,
  accessibilityLabel,
  // 44 pt de largeur tactile : une coche de série se valide au pouce, en séance.
  width = 44,
}: {
  checked: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  width?: number;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(checked ? 1 : 0);
      return;
    }
    Animated.spring(progress, {
      toValue: checked ? 1 : 0,
      useNativeDriver: false,
      ...spring,
    }).start();
  }, [checked, progress, reduceMotion]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.surfaceAlt, theme.colors.action],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.action],
  });
  const mutedOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1.12, 1],
  });

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[styles.check, { width, backgroundColor, borderColor, transform: [{ scale }] }]}
      >
        <Animated.View style={{ opacity: mutedOpacity }}>
          <Icon name="check" size={18} color={theme.colors.textMuted} />
        </Animated.View>
        <Animated.View style={[styles.checkOverlay, { opacity: progress }]}>
          <Icon name="check" size={18} color={theme.colors.background} />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Ligne de série : elle **s'éclaire** brièvement quand elle passe à « validée »
 * (une bande de surface qui s'efface), en plus du ressort de la coche. L'effet
 * ne joue que sur la transition non validée → validée, pas au montage.
 */
function SetRow({ completed, children }: { completed: boolean; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReduceMotion();
  const flash = useRef(new Animated.Value(0)).current;
  const wasCompleted = useRef(completed);

  useEffect(() => {
    if (!reduceMotion && completed && !wasCompleted.current) {
      flash.setValue(1);
      Animated.timing(flash, {
        toValue: 0,
        duration: duration.slow,
        easing: easing.exit,
        useNativeDriver: true,
      }).start();
    }
    wasCompleted.current = completed;
  }, [completed, flash, reduceMotion]);

  return (
    <View style={styles.setRow}>
      <Animated.View pointerEvents="none" style={[styles.setFlash, { opacity: flash }]} />
      {children}
    </View>
  );
}

export default function LiveWorkoutScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const db = useSQLiteContext();
  const { accountId } = useAccount();
  const programId = route.params.programId;

  const [nom, setNom] = useState('');
  const [liveExercises, setLiveExercises] = useState<LiveExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  /** Chrono d'effort en cours (série d'endurance mesurée) ; null = arrêté. */
  const [chrono, setChrono] = useState<{
    exIndex: number;
    setIndex: number;
    startedAt: number;
  } | null>(null);
  /** Dernier rafraîchissement de l'affichage du chrono (re-rendu périodique). */
  const [chronoNow, setChronoNow] = useState(0);

  // Réglages du calculateur de disques (barre + disques), persistés en préférences.
  const [barWeight, setBarWeightState] = useState(DEFAULT_BAR_WEIGHT);
  const [customBars, setCustomBarsState] = useState<number[]>([]);
  const [plates, setPlatesState] = useState<number[]>([...DEFAULT_PLATES]);
  const [customPlates, setCustomPlatesState] = useState<number[]>([]);
  /** Série dont on affiche le calculateur de chargement (null = fermé). */
  const [calc, setCalc] = useState<{ exIndex: number; setIndex: number } | null>(null);
  /** Exercice affiché en grand (image + tuto). */
  const [detail, setDetail] = useState<Exercise | null>(null);
  /**
   * Exercice terminé rouvert pour correction (null = tous les exercices finis
   * restent repliés en ligne compacte, comme dans l'éditeur).
   */
  const [reopenedId, setReopenedId] = useState<number | null>(null);
  /** Carte de confirmation/erreur (remplace les `Alert.alert`). */
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  /** Secondes cumulées avant le segment courant (reprise d'une séance quittée). */
  const baseElapsedRef = useRef(0);
  /** Début du segment courant (horodatage ms) : le chrono se met en pause en quittant. */
  const segmentStartRef = useRef(Date.now());
  /** Dernière valeur du chrono (pour le brouillon écrit en quittant). */
  const elapsedRef = useRef(0);
  const keySeq = useRef(0);
  /** Fin du repos (horodatage ms) ; null = aucun repos en cours. */
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  /** Secondes restantes, recalculées depuis `restEndsAt` (juste même après un retour au premier plan). */
  const [restRemaining, setRestRemaining] = useState(0);
  /** Durée initiale du repos en cours (barre de progression). */
  const restTotal = useRef(0);
  /** Bref indicateur « repos terminé » après la fin du temps d'attente. */
  const [restDone, setRestDone] = useState(false);
  /** Clavier ouvert : affiche le chrono juste au-dessus. */
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /** Hauteur de l'en-tête de pile (barre d'état comprise) : décalage du clavier. */
  const headerHeight = useHeaderHeight();
  /** Identifiant de la notification de fin de repos programmée. */
  const restNotifId = useRef<string | null>(null);
  /** Identifie le cycle de repos courant : invalide une programmation « en vol ». */
  const restSessionRef = useRef(0);
  /** Bip de fin de repos (fichier local). */
  const restBeep = useAudioPlayer(require('../../assets/sounds/rest-done.wav'));
  /** Le poids a-t-il été modifié ? Évite d'écraser le plan (et les autres séances) au chargement. */
  const planDirty = useRef(false);
  /** Auto-défilement : position Y des cartes et dernier état « exercice terminé ». */
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<number[]>([]);
  const allDoneRef = useRef<boolean[]>([]);
  /** Dernier état des cases cochées (pour détecter les passages à « coché »). */
  const completedRef = useRef<boolean[][]>([]);
  /**
   * Séance en cours mise de côté, tenue à jour à chaque changement : c'est elle
   * qui est écrite en quittant l'écran, pour pouvoir reprendre sans recommencer.
   */
  const draftRef = useRef<WorkoutDraft | null>(null);
  /** Horodatage de la dernière écriture du brouillon (on écrit au plus toutes les 5 s). */
  const draftSavedAt = useRef(0);
  /** Séance restaurée au chargement : on défile alors jusqu'à l'exercice en cours. */
  const resumedRef = useRef(false);

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
          rows.map((row) => getLastSetsForExercise(db, accountId ?? -1, row.exercise_id ?? 0))
        );
        const bestRows = await getExerciseBestSets(db, accountId ?? -1);
        const bestByExercise = new Map(bestRows.map((row) => [row.exercise_id, row]));
        // Séance mise de côté : on la reprend au lieu de repartir de zéro.
        const draft = accountId === null ? null : await loadActiveWorkout(accountId);
        if (!mounted) return;
        setNom(program?.nom_seance ?? 'Séance');
        setBarWeightState(savedBar);
        setCustomBarsState(savedCustomBars);
        setPlatesState(savedPlates);
        setCustomPlatesState(savedCustomPlates);

        // Le brouillon ne concerne que la séance qu'il a mise de côté : ouvrir une
        // autre séance la démarre à zéro (le brouillon reste dans la bulle).
        const restored = draft !== null && draft.program_id === programId ? draft : null;
        if (restored !== null) {
          baseElapsedRef.current = Math.max(0, Math.round(restored.elapsed_sec));
          segmentStartRef.current = Date.now();
          elapsedRef.current = baseElapsedRef.current;
          setElapsed(baseElapsedRef.current);
          resumedRef.current = restored.exercises.some((entry) =>
            entry.sets.some((set) => set.completed)
          );
        }

        const built = rows.map((row, rowIndex) => {
          const exercise = programExerciseToExercise(row);
          const endurance = isEndurance(exercise);
          const baseWeight = row.target_weight ?? 0;
          const series = Math.max(1, row.series ?? 3);
          const weights = fitWeights(parseWeights(row.set_weights) ?? [], series, baseWeight);

          const previous: Array<PreviousSet | undefined> = [];
          for (const set of previousSets[rowIndex]) {
            previous[set.set_num - 1] = {
              weight: set.weight,
              reps: set.reps,
              durationSec: set.duration_sec ?? 0,
            };
          }

          const saved = restored?.exercises.find((entry) => entry.workout_exo_id === row.id);

          return {
            workoutExoId: row.id,
            exercise,
            repsMin: row.reps_min ?? REPS_RANGE.min,
            repsMax: row.reps_max ?? REPS_RANGE.min,
            endurance,
            durationSec: row.duration_sec ?? DEFAULT_ENDURANCE_DURATION,
            restTime: row.rest_time ?? 0,
            supersetGroup: row.superset_group,
            bestSet: endurance ? null : (bestByExercise.get(row.exercise_id ?? -1) ?? null),
            baseWeight,
            previous,
            sets: Array.from({ length: series }, (_, index) => {
              const kept = saved?.sets[index];
              return {
                key: nextKey(),
                weight: kept ? kept.weight : weights[index] ?? baseWeight,
                reps: kept?.reps ?? 0,
                durationSec: kept?.duration_sec ?? 0,
                completed: kept?.completed ?? false,
              };
            }),
          };
        });

        // L'état de départ est posé AVANT l'effet qui surveille les cases cochées,
        // sinon les séries déjà validées seraient prises pour des validations
        // fraîches (repos déclenché et défilement vers le haut au retour).
        completedRef.current = built.map((exercise) => exercise.sets.map((set) => set.completed));
        allDoneRef.current = built.map(
          (exercise) => exercise.sets.length > 0 && exercise.sets.every((set) => set.completed)
        );
        setLiveExercises(built);
        setLoading(false);
        setReady(true);

        if (built.length === 0 && restored !== null && accountId !== null) {
          // La séance mise de côté n'existe plus (programme supprimé ou vidé) :
          // on abandonne le brouillon plutôt que de laisser une bulle sans issue.
          resumedRef.current = false;
          draftRef.current = null;
          void abandonActiveWorkout(accountId);
        }
      } catch (cause: unknown) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db, programId, accountId]);

  // Chrono de la séance : cumul des segments précédents + segment courant. Il se
  // met en pause quand on quitte l'écran et reprend en revenant dessus.
  useEffect(() => {
    const tick = () => {
      const value =
        baseElapsedRef.current + Math.floor((Date.now() - segmentStartRef.current) / 1000);
      elapsedRef.current = value;
      setElapsed(value);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Clavier ouvert : le bas de l'écran remonte avec lui et le chrono de la séance
  // s'y affiche (l'en-tête, qui le porte d'habitude, a défilé hors de vue).
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Le chrono d'effort d'une série d'endurance rafraîchit son affichage en continu
  // (l'arrêt enregistre la durée mesurée dans la série).
  useEffect(() => {
    if (chrono === null) return;
    setChronoNow(Date.now());
    const id = setInterval(() => setChronoNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [chrono]);

  /**
   * Met la séance de côté pour pouvoir la reprendre après l'avoir quittée.
   * `force` écrit tout de suite (à la sortie de l'écran) ; sinon on limite les
   * écritures à une toutes les 5 s, le brouillon restant à jour en mémoire.
   */
  const persistDraft = (force = false) => {
    if (accountId === null || draftRef.current === null) return;
    const now = Date.now();
    if (!force && now - draftSavedAt.current < 5000) return;
    draftSavedAt.current = now;
    void saveActiveWorkout(accountId, {
      ...draftRef.current,
      elapsed_sec: elapsedRef.current,
    }).catch(() => {
      // Stockage indisponible : la séance reste utilisable, elle n'est juste pas reprenable.
    });
  };

  // Le brouillon suit chaque changement de la séance (séries, poids, reps, nom).
  useEffect(() => {
    if (!ready || accountId === null || liveExercises.length === 0) return;
    draftRef.current = {
      program_id: programId,
      nom,
      elapsed_sec: elapsedRef.current,
      exercises: liveExercises.map((exercise) => ({
        workout_exo_id: exercise.workoutExoId,
        sets: exercise.sets.map((set) => ({
          weight: set.weight,
          reps: set.reps,
          duration_sec: set.durationSec,
          completed: set.completed,
        })),
      })),
    };
    persistDraft();
  }, [liveExercises, nom, ready, programId, accountId]);

  // En quittant l'écran, on écrit la dernière version (le délai de 5 s n'a pas
  // forcément couru) : la séance reste reprenable depuis la bulle.
  useEffect(() => {
    return () => {
      if (draftRef.current === null) return;
      const pending = { ...draftRef.current, elapsed_sec: elapsedRef.current };
      draftRef.current = pending;
      persistDraft(true);
    };
    // `accountId` et `persistDraft` ne changent pas pendant la séance.
  }, [accountId]);

  // Sauvegarde « inter-séance » : le poids est écrit au fil de la séance
  // (jamais le nombre de séries), pour se reporter même sans terminer — et il est
  // synchronisé sur toutes les séances du compte qui utilisent le même exercice.
  useEffect(() => {
    if (!ready || !planDirty.current) return;
    const plans = buildPlans(liveExercises);
    const id = setTimeout(() => {
      void saveWorkoutPlan(db, accountId ?? null, plans);
    }, 800);
    return () => clearTimeout(id);
  }, [liveExercises, ready, db, accountId]);

  /** Joue le bip de fin de repos (silencieux si indisponible). */
  const playRestBeep = () => {
    try {
      restBeep.seekTo(0).catch(() => {});
      restBeep.play();
    } catch {
      // Son indisponible : la notification reste le filet de sécurité.
    }
  };

  /**
   * Lance (ou relance) le repos après une série.
   *
   * Aucune notification n'est posée ici : au premier plan, la fin du repos est
   * signalée par le bip et par une notification **immédiate** (chemins fiables
   * en Expo Go). La notification **différée** n'est programmée que si l'app
   * passe en arrière-plan — c'est le seul cas où elle est indispensable, le JS
   * étant alors suspendu (cf. l'effet sur `AppState` ci-dessous).
   */
  const startRest = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    if (total <= 0) return;
    const previous = restNotifId.current;
    restNotifId.current = null;
    restSessionRef.current += 1;
    void cancelRestDone(previous);
    restTotal.current = total;
    setRestDone(false);
    setRestRemaining(total);
    setRestEndsAt(Date.now() + total * 1000);
  };

  /** Passe le temps d'attente : arrête le repos et annule la notification. */
  const skipRest = () => {
    const id = restNotifId.current;
    restNotifId.current = null;
    restSessionRef.current += 1;
    void cancelRestDone(id);
    setRestEndsAt(null);
    setRestRemaining(0);
  };

  /** Ajoute (ou retire) du temps au repos en cours. */
  const shiftRest = (deltaSeconds: number) => {
    if (restEndsAt === null) return;
    const next = restEndsAt + deltaSeconds * 1000;
    if (next <= Date.now()) {
      skipRest();
      return;
    }
    setRestEndsAt(next);
  };

  // Décompte du repos, recalculé depuis l'horodatage (reste exact après un
  // passage en arrière-plan, où les minuteurs JS sont suspendus).
  useEffect(() => {
    if (restEndsAt === null) return;
    const tick = () => {
      setRestRemaining(Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  // Pendant un repos, on suit l'état de l'app : dès qu'elle quitte le premier
  // plan, on programme une notification différée pour le temps restant (le JS
  // sera suspendu, ni le bip ni la notification immédiate ne partiront) ; au
  // retour au premier plan, on l'annule pour ne pas notifier deux fois.
  useEffect(() => {
    if (restEndsAt === null) return;

    const syncWithAppState = (state: AppStateStatus) => {
      const pending = restNotifId.current;
      restNotifId.current = null;
      // Le diagnostic se fait avant l'annulation : si la notification différée a
      // sonné pendant l'absence, elle a déjà quitté la liste d'attente.
      if (state === 'active') void logPendingRestNotifications();
      void cancelRestDone(pending);

      // Toute programmation encore en vol devient caduque.
      restSessionRef.current += 1;
      const session = restSessionRef.current;
      if (state === 'active') return;

      const remaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      if (remaining <= 1) return;
      scheduleRestDone(remaining)
        .then((id) => {
          if (restSessionRef.current !== session) {
            // Revenu au premier plan entre-temps : on annule cette notification
            // plutôt que de la laisser sonner pendant la séance.
            void cancelRestDone(id);
            return;
          }
          restNotifId.current = id;
        })
        .catch(() => {
          // Notifications indisponibles (permission refusée…) : tant pis.
        });
    };

    syncWithAppState(AppState.currentState);
    const subscription = AppState.addEventListener('change', syncWithAppState);
    return () => subscription.remove();
  }, [restEndsAt]);

  // Fin du repos : bip (si l'app est au premier plan) et indicateur « c'est parti ».
  useEffect(() => {
    if (restEndsAt === null || restRemaining > 0) return;
    const endedAt = restEndsAt;
    restNotifId.current = null;
    restSessionRef.current += 1;
    setRestEndsAt(null);
    setRestDone(true);
    // Au-delà de quelques secondes, on revient d'arrière-plan : la notification
    // différée a déjà prévenu, inutile de bipper (ni de renotifier) après coup.
    if (Date.now() - endedAt < 3000) {
      playRestBeep();
      void presentRestDoneNow();
    }
  }, [restEndsAt, restRemaining]);

  // L'indicateur « repos terminé » s'efface tout seul.
  useEffect(() => {
    if (!restDone) return;
    const id = setTimeout(() => setRestDone(false), 5000);
    return () => clearTimeout(id);
  }, [restDone]);

  // Canal de notification + permission (une fois par séance) ; à la fermeture,
  // on annule une éventuelle notification encore programmée.
  useEffect(() => {
    ensureRestNotifications().catch(() => {});
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      const id = restNotifId.current;
      restNotifId.current = null;
      void cancelRestDone(id);
    };
  }, []);

  // Déclenche le repos quand une série passe à « cochée », et défile vers
  // l'exercice suivant dès que **toutes** ses séries sont cochées.
  useEffect(() => {
    if (!ready || liveExercises.length === 0) return;

    const previousCompleted = completedRef.current;
    let restFor: number | null = null;
    let scrollTo = -1;

    liveExercises.forEach((exercise, exIndex) => {
      exercise.sets.forEach((set, setIndex) => {
        if (set.completed && !previousCompleted[exIndex]?.[setIndex]) {
          // Superset : pas de repos après un exercice intermédiaire.
          if (isLastOfSuperset(liveExercises, exIndex)) restFor = exercise.restTime;
        }
      });
    });

    const nextAllDone = liveExercises.map(
      (exercise) => exercise.sets.length > 0 && exercise.sets.every((set) => set.completed)
    );
    let justDoneId: number | null = null;
    nextAllDone.forEach((done, index) => {
      if (done && !allDoneRef.current[index]) {
        scrollTo = index + 1;
        justDoneId = liveExercises[index].workoutExoId;
      }
    });
    // Un exercice qu'on vient de terminer se replie, même s'il avait été rouvert
    // pour corriger une série.
    if (justDoneId !== null) {
      const doneId = justDoneId;
      // Le repli de la carte est animé : le défilement qui suit reste calé sur
      // la nouvelle hauteur (la mesure est relue après le rendu).
      animateNextLayout();
      setReopenedId((prev) => (prev === doneId ? null : prev));
    }

    completedRef.current = liveExercises.map((exercise) => exercise.sets.map((set) => set.completed));
    allDoneRef.current = nextAllDone;

    if (restFor !== null) startRest(restFor);
    if (scrollTo >= 0) {
      // L'exercice terminé vient de se replier : on relit sa position après le
      // nouveau rendu (la mesure d'avant repli est périmée).
      const timer = setTimeout(() => {
        const y = cardY.current[scrollTo];
        if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      }, 260);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [liveExercises, ready]);

  // Séance reprise : on se replace directement sur l'exercice en cours.
  useEffect(() => {
    if (!ready || !resumedRef.current) return;
    resumedRef.current = false;
    const index = liveExercises.findIndex(
      (exercise) => exercise.sets.length === 0 || exercise.sets.some((set) => !set.completed)
    );
    if (index <= 0) return;
    const timer = setTimeout(() => {
      const y = cardY.current[index];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [ready, liveExercises]);

  const changeWeight = (exIndex: number, setIndex: number, value: number) => {
    planDirty.current = true;
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

  const changeReps = (exIndex: number, setIndex: number, value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
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

  const changeDuration = (exIndex: number, setIndex: number, seconds: number) => {
    setLiveExercises((prev) =>
      prev.map((exercise, i) =>
        i === exIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, j) =>
                // Saisir une durée coche la série (durée zéro = décoche).
                j === setIndex ? { ...set, durationSec: seconds, completed: seconds > 0 } : set
              ),
            }
          : exercise
      )
    );
  };

  /**
   * Chrono d'effort d'une série d'endurance : un premier appui démarre la mesure,
   * un second l'arrête et enregistre le temps réalisé dans la série (qui est alors
   * validée). C'est l'alternative au clavier pour les courses et le cardio.
   */
  const toggleChrono = (exIndex: number, setIndex: number) => {
    if (chrono !== null && chrono.exIndex === exIndex && chrono.setIndex === setIndex) {
      const seconds = Math.max(
        1,
        Math.min(DURATION_RANGE.max, Math.round((Date.now() - chrono.startedAt) / 1000))
      );
      changeDuration(exIndex, setIndex, seconds);
      setChrono(null);
      return;
    }
    setChrono({ exIndex, setIndex, startedAt: Date.now() });
  };

  /**
   * Coche une série. Une série validée sans valeur est remplie avec la cible
   * (borne basse des reps, ou durée cible pour l'endurance) ; une valeur saisie
   * à la main n'est jamais écrasée.
   */
  const toggleSet = (exIndex: number, setIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((exercise, i) => {
        if (i !== exIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, j) => {
            if (j !== setIndex) return set;
            const completed = !set.completed;
            if (!completed) return { ...set, completed };
            return {
              ...set,
              completed,
              reps: exercise.endurance || set.reps > 0 ? set.reps : exercise.repsMin,
              durationSec:
                !exercise.endurance || set.durationSec > 0 ? set.durationSec : exercise.durationSec,
            };
          }),
        };
      })
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
          sets: exercise.sets.map((set) => {
            if (allDone) return { ...set, completed: false };
            // Même règle que série par série : une série vide est validée à la cible.
            return {
              ...set,
              completed: true,
              reps: exercise.endurance || set.reps > 0 ? set.reps : exercise.repsMin,
              durationSec:
                !exercise.endurance || set.durationSec > 0 ? set.durationSec : exercise.durationSec,
            };
          }),
        };
      })
    );
  };

  const addSet = (exIndex: number) => {
    planDirty.current = true;
    animateNextLayout();
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
              durationSec: 0,
              completed: false,
            },
          ],
        };
      })
    );
  };

  const removeSet = (exIndex: number) => {
    planDirty.current = true;
    animateNextLayout();
    if (chrono !== null && chrono.exIndex === exIndex) setChrono(null);
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
          if (set.completed || set.reps > 0 || set.durationSec > 0) {
            sets.push({
              exercise_id: exercise.exercise.id,
              set_num: index + 1,
              weight: set.weight,
              reps: set.reps,
              duration_sec: set.durationSec,
              completed: set.completed,
            });
          }
        });
      }

      const sessionId = await saveWorkoutSession(db, {
        program_id: programId,
        account_id: accountId,
        date: new Date().toISOString(),
        duration_sec: elapsedRef.current,
        total_volume: Math.round(volume * 100) / 100,
        sets,
        plans: buildPlans(liveExercises),
      });
      // La séance est terminée : elle n'est plus « en cours » (plus de bulle).
      draftRef.current = null;
      if (accountId !== null) await abandonActiveWorkout(accountId);
      // La séance en cours est remplacée par son récapitulatif (Stats).
      navigation.replace('SessionSummary', { sessionId });
    } catch (cause: unknown) {
      setSaving(false);
      setConfirm({
        title: 'Erreur',
        message: cause instanceof Error ? cause.message : 'Enregistrement impossible.',
        confirmLabel: 'Compris',
        hideCancel: true,
      });
    }
  };

  const onStop = () => {
    setConfirm({
      title: 'Arrêter la séance',
      message: 'Enregistrer les séries réalisées et terminer la séance ?',
      confirmLabel: 'Terminer',
      cancelLabel: 'Continuer',
      destructive: true,
      onConfirm: persist,
    });
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

  const volume = liveExercises.reduce(
    (total, exercise) =>
      total + exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
    0
  );
  // Temps d'effort cumulé des séries chronométrées (remplace le « 0 kg » d'une
  // séance d'endurance seule dans l'en-tête).
  const effortSeconds = liveExercises.reduce(
    (total, exercise) =>
      total + exercise.sets.reduce((sum, set) => sum + (set.completed ? set.durationSec : 0), 0),
    0
  );

  // Premier exercice dont toutes les séries ne sont pas encore validées.
  const currentIndex = liveExercises.findIndex(
    (exercise) => exercise.sets.length === 0 || exercise.sets.some((set) => !set.completed)
  );

  /** Exercice terminé : toutes ses séries sont validées. */
  const isDone = (exercise: LiveExercise) =>
    exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);

  /**
   * Exercice affiché en ligne compacte : terminé et non rouvert. Il reprend sa
   * carte pleine dès qu'on le touche pour corriger une série ou un poids.
   */
  const isFolded = (index: number) => {
    const exercise = liveExercises[index];
    return exercise !== undefined && isDone(exercise) && reopenedId !== exercise.workoutExoId;
  };

  // Chrono affiché au-dessus du clavier : l'effort mesuré prime sur le temps de séance.
  const keyboardClock =
    chrono !== null
      ? { label: 'Effort', seconds: Math.max(0, Math.floor((chronoNow - chrono.startedAt) / 1000)) }
      : { label: 'Temps', seconds: elapsed };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Méthode de la doc Expo (Android bord à bord : la fenêtre ne rétrécit
          plus) : `padding` sur les deux plateformes, décalé de l'en-tête. */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Appear>
          {/* À plat : la seule carte de l'écran est l'exercice en cours (§8.4). */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{nom}</Text>
            {/* Deux chiffres sans légende ne se lisent pas : chacun porte son nom. */}
            <View
              style={styles.headerMetrics}
              accessible
              accessibilityLabel={`Temps ${formatClock(elapsed)}. ${
                volume > 0 || effortSeconds === 0
                  ? `Volume ${formatKg(volume)}`
                  : `Effort ${formatDuration(effortSeconds)}`
              }.`}
            >
              <View style={styles.headerMetric}>
                <Text style={styles.headerTime}>{formatClock(elapsed)}</Text>
                <Text style={styles.headerMetricLabel}>temps</Text>
              </View>
              <View style={styles.headerMetric}>
                <Text style={styles.headerTotal}>
                  {volume > 0 || effortSeconds === 0
                    ? formatKg(volume)
                    : formatDuration(effortSeconds)}
                </Text>
                <Text style={styles.headerMetricLabel}>
                  {volume > 0 || effortSeconds === 0 ? 'volume' : 'effort'}
                </Text>
              </View>
            </View>
          </View>
        </Appear>

        {liveExercises.length === 0 ? (
          <Text style={styles.emptyText}>
            Cette séance n’a pas d’exercice. Modifie-la depuis « Mes séances ».
          </Text>
        ) : (
          liveExercises.map((exercise, exIndex) => {
            // L'exercice en cours est le seul mis en carte pleine, comme prévu par
            // la DA : une carte maximum par écran, réservée à l'action principale.
            const isCurrent = currentIndex === exIndex;
            const allDone = isDone(exercise);
            // L'exercice suivant est-il replié ? Sert à poser un écart plus large
            // autour de la carte ouverte, pour qu'elle se détache des lignes
            // terminées (et seulement d'elles).
            const nextFolded = isFolded(exIndex + 1);
            const best = exercise.bestSet;
            const recordBeaten =
              best !== null && exercise.sets.some((set) => set.reps > 0 && beatsSet(set, best));
            const doneVolume = exercise.sets.reduce(
              (total, set) => total + set.weight * set.reps,
              0
            );
            const doneEffort = exercise.sets.reduce((total, set) => total + set.durationSec, 0);
            const trackLayout = (event: LayoutChangeEvent) => {
              cardY.current[exIndex] = event.nativeEvent.layout.y;
            };

            // Exercice terminé : ligne compacte (thumb, nom, résumé), comme dans
            // l'éditeur. Un appui le rouvre en carte pleine pour corriger.
            if (isFolded(exIndex)) {
              return (
                <View
                  key={exercise.workoutExoId}
                  onLayout={trackLayout}
                  style={[styles.foldedFrame, !nextFolded && styles.aroundCard]}
                >
                  <Row inset={false} last>
                    <PressableScale
                      onPress={() => setDetail(exercise.exercise)}
                      accessibilityLabel="Voir l’exercice"
                      scaleTo={0.94}
                    >
                      <Thumb
                        source={
                          exercise.exercise.image
                            ? exerciseImages[exercise.exercise.image]
                            : undefined
                        }
                        size={40}
                      />
                    </PressableScale>
                    <PressableScale
                      style={styles.doneBody}
                      onPress={() => {
                        animateNextLayout();
                        setReopenedId(exercise.workoutExoId);
                      }}
                      accessibilityLabel={`Rouvrir ${exercise.exercise.nom}`}
                      scaleTo={0.99}
                    >
                      <Text style={styles.doneTitle} numberOfLines={1}>
                        {exercise.exercise.nom}
                      </Text>
                      <Text style={styles.doneMeta}>
                        {exercise.sets.length} série{exercise.sets.length > 1 ? 's' : ''} ·{' '}
                        {exercise.endurance
                          ? `${formatDuration(doneEffort)} d’effort`
                          : formatKg(doneVolume)}
                      </Text>
                    </PressableScale>
                    {recordBeaten ? (
                      <PopIn>
                        <Badge label="Record" tone="marker" />
                      </PopIn>
                    ) : null}
                    <CheckToggle
                      checked={allDone}
                      accessibilityLabel={`Décocher les séries de ${exercise.exercise.nom}`}
                      onPress={() => toggleAllSets(exIndex)}
                    />
                  </Row>
                </View>
              );
            }

            return (
              <View key={exercise.workoutExoId} onLayout={trackLayout}>
                <Appear>
                  <Card
                    tone={isCurrent || reopenedId === exercise.workoutExoId ? 'accent' : 'default'}
                    style={[
                      styles.card,
                      !isCurrent && reopenedId !== exercise.workoutExoId && styles.cardFlat,
                      exercise.supersetGroup != null && styles.cardSuperset,
                      nextFolded && styles.aroundCard,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleBlock}>
                        <PressableScale
                          onPress={() => setDetail(exercise.exercise)}
                          accessibilityLabel="Voir l’exercice"
                          scaleTo={0.94}
                        >
                          <Thumb
                            source={
                              exercise.exercise.image
                                ? exerciseImages[exercise.exercise.image]
                                : undefined
                            }
                            size={44}
                          />
                        </PressableScale>
                        {allDone ? (
                          <PressableScale
                            style={styles.cardTitleTap}
                            onPress={() => {
                              animateNextLayout();
                              setReopenedId(null);
                            }}
                            accessibilityLabel={`Replier ${exercise.exercise.nom}`}
                            scaleTo={0.99}
                          >
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {exercise.exercise.nom}
                            </Text>
                          </PressableScale>
                        ) : (
                          <Text style={[styles.cardTitle, styles.cardTitleStatic]} numberOfLines={1}>
                            {exercise.exercise.nom}
                          </Text>
                        )}
                      </View>
                      {exercise.endurance ? <Badge label="Endurance" tone="neutral" /> : null}
                      {recordBeaten ? (
                        <PopIn>
                          <Badge label="Record" tone="marker" />
                        </PopIn>
                      ) : null}
                      <CheckToggle
                        checked={allDone}
                        accessibilityLabel={`Valider toutes les séries de ${exercise.exercise.nom}`}
                        onPress={() => toggleAllSets(exIndex)}
                      />
                    </View>

                    {best !== null ? (
                      <Text
                        style={[styles.recordHint, recordBeaten && styles.recordHintNew]}
                        accessibilityLiveRegion={recordBeaten ? 'polite' : 'none'}
                      >
                        {recordBeaten
                          ? 'Nouveau record'
                          : `Record à battre : ${formatPerformance(best)}`}
                      </Text>
                    ) : null}

                    {exercise.endurance ? (
                      <Text style={styles.recordHint}>
                        Au temps, cible {formatDuration(exercise.durationSec)} par série. Lance le
                        chrono, puis arrête-le pour enregistrer la durée.
                      </Text>
                    ) : null}

                    {exercise.sets.map((set, setIndex) => {
                      const previous = exercise.previous[setIndex];
                      const running =
                        chrono !== null &&
                        chrono.exIndex === exIndex &&
                        chrono.setIndex === setIndex;
                      const liveSeconds =
                        chrono !== null && running
                          ? Math.max(0, Math.floor((chronoNow - chrono.startedAt) / 1000))
                          : 0;
                      return (
                        <SetRow key={set.key} completed={set.completed}>
                          <Text style={styles.setLabel}>{setIndex + 1}</Text>
                          <Text style={styles.previousText}>
                            {previous
                              ? exercise.endurance
                                ? formatDuration(previous.durationSec)
                                : `${formatWeight(previous.weight)}×${previous.reps}`
                              : '—'}
                          </Text>

                          {exercise.endurance ? (
                            <>
                              <IconButton
                                icon={running ? 'stop' : 'play'}
                                tone={running ? 'danger' : 'accent'}
                                active={running}
                                size={40}
                                accessibilityLabel={
                                  running ? 'Arrêter le chrono' : 'Lancer le chrono'
                                }
                                onPress={() => toggleChrono(exIndex, setIndex)}
                              />
                              <DurationField
                                value={running ? liveSeconds : set.durationSec}
                                onChange={(seconds) => changeDuration(exIndex, setIndex, seconds)}
                                placeholder={formatDuration(exercise.durationSec)}
                                style={styles.durationField}
                                inputStyle={styles.repsInput}
                                editable={!running}
                                accessibilityLabel={`Durée de la série ${setIndex + 1}`}
                              />
                            </>
                          ) : (
                            <>
                              <WeightField
                                value={set.weight}
                                onChange={(value) => changeWeight(exIndex, setIndex, value)}
                                onOpenCalculator={() => setCalc({ exIndex, setIndex })}
                                accessibilityLabel={`Poids de la série ${setIndex + 1}, en kilos`}
                              />

                              <TextInput
                                style={styles.repsInput}
                                value={set.reps > 0 ? String(set.reps) : ''}
                                onChangeText={(value) => changeReps(exIndex, setIndex, value)}
                                placeholder={`${exercise.repsMin}–${exercise.repsMax}`}
                                placeholderTextColor={theme.colors.textMuted}
                                keyboardType="number-pad"
                                returnKeyType="done"
                                accessibilityLabel={`Répétitions de la série ${setIndex + 1}`}
                              />
                            </>
                          )}

                          <CheckToggle
                            checked={set.completed}
                            accessibilityLabel={`Valider la série ${setIndex + 1}`}
                            onPress={() =>
                              running ? toggleChrono(exIndex, setIndex) : toggleSet(exIndex, setIndex)
                            }
                          />
                        </SetRow>
                      );
                    })}

                    <View style={styles.setActions}>
                      <Button
                        label="Retirer"
                        leading={<Icon name="minus" size={16} color={theme.colors.action} />}
                        variant="secondary"
                        size="sm"
                        style={styles.setActionButton}
                        onPress={() => removeSet(exIndex)}
                      />
                      <Button
                        label="Ajouter"
                        leading={<Icon name="plus" size={16} color={theme.colors.action} />}
                        variant="secondary"
                        size="sm"
                        style={styles.setActionButton}
                        onPress={() => addSet(exIndex)}
                      />
                    </View>
                  </Card>
                </Appear>
              </View>
            );
          })
        )}
      </ScrollView>

      <RestPanel
        remaining={restRemaining}
        total={restTotal.current}
        done={restDone}
        onShift={shiftRest}
        onSkip={skipRest}
      />

      {keyboardOpen ? (
        // Pendant la saisie, le bouton d'arrêt cède la place à **un seul** chrono,
        // juste au-dessus du clavier : le repos s'il tourne (son bandeau est déjà
        // là), sinon l'effort de la série d'endurance, sinon le temps de séance.
        // « OK » referme le pavé numérique (sans touche de validation sur iOS).
        restRemaining > 0 || restDone ? null : (
          <View
            style={styles.keyboardClock}
            accessible
            accessibilityLabel={`${keyboardClock.label} ${formatClock(keyboardClock.seconds)}.`}
          >
            <Text style={styles.keyboardClockLabel}>
              {keyboardClock.label}{' '}
              <Text style={styles.keyboardClockTime}>{formatClock(keyboardClock.seconds)}</Text>
            </Text>
            <Button label="OK" variant="secondary" size="sm" onPress={Keyboard.dismiss} />
          </View>
        )
      ) : (
        <View style={styles.footer}>
          <Button
            label="Arrêter la séance"
            variant="danger"
            size="lg"
            loading={saving}
            onPress={onStop}
          />
        </View>
      )}
      </KeyboardAvoidingView>

      {/* Toujours monté : la feuille garde son animation de fermeture. */}
      <PlateCalculatorModal
        visible={calc !== null}
        weight={calc ? (liveExercises[calc.exIndex]?.sets[calc.setIndex]?.weight ?? 0) : 0}
        barWeight={barWeight}
        customBars={customBars}
        plates={plates}
        customPlates={customPlates}
        onChangeWeight={(value) => {
          if (calc) changeWeight(calc.exIndex, calc.setIndex, value);
        }}
        onSelectBar={selectBar}
        onAddBar={addBar}
        onRemoveBar={removeBar}
        onTogglePlate={togglePlate}
        onAddPlate={addPlate}
        onRemovePlate={removePlate}
        onClose={() => setCalc(null)}
      />

      <ExerciseDetailModal
        exercise={detail}
        visible={detail !== null}
        onClose={() => setDetail(null)}
      />

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );
}

/**
 * Anime le **changement de hauteur** qui suit (repli/dépliage d'un exercice,
 * ajout ou retrait d'une série). `LayoutAnimation` suffit : Fabric l'applique
 * sans réglage, et la durée reste celle des autres transitions.
 */
function animateNextLayout() {
  LayoutAnimation.configureNext({
    duration: duration.base,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

interface RestPanelProps {
  /** Secondes restantes (0 = repos fini). */
  remaining: number;
  /** Durée initiale du repos (jauge). */
  total: number;
  /** Repos écoulé : affiche « enchaîne ! » à la place du décompte. */
  done: boolean;
  onShift: (deltaSeconds: number) => void;
  onSkip: () => void;
}

/**
 * Bandeau de repos : il **glisse depuis le bas** quand un repos démarre (il
 * arrive sous le doigt juste après la coche d'une série) et repart de même, puis
 * sa jauge se vide en continu au lieu de sauter d'un cran chaque seconde.
 */
function RestPanel({ remaining, total, done, onShift, onSkip }: RestPanelProps) {
  const styles = useThemedStyles(createStyles);
  const active = remaining > 0;
  const visible = active || done;
  const [rendered, setRendered] = useState(visible);
  const slide = useRef(new Animated.Value(visible ? 0 : 1)).current;
  const fill = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(slide, {
        toValue: 0,
        duration: duration.base,
        easing: easing.enter,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(slide, {
      toValue: 1,
      duration: duration.fast,
      easing: easing.exit,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [slide, visible]);

  /*
   * Jauge : `scaleX` (origine à gauche) pilotée nativement, recalée à chaque
   * battement du décompte (250 ms). Une largeur animée obligerait à passer par
   * le fil JS ; ici le rail se vide sans à-coups, même pendant un « +15 s ».
   */
  useEffect(() => {
    if (total <= 0) return;
    if (remaining >= total) {
      fill.setValue(1);
      return;
    }
    Animated.timing(fill, {
      toValue: Math.max(0, Math.min(1, remaining / total)),
      duration: 280,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [fill, remaining, total]);

  if (!rendered) return null;

  return (
    <Animated.View
      style={[
        styles.restBar,
        {
          opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [0, spacing.xxl],
              }),
            },
          ],
        },
      ]}
    >
      {active ? (
        <>
          <View style={styles.restRow}>
            <Text style={styles.restLabel}>
              Repos <Text style={styles.restTime}>{formatClock(remaining)}</Text>
            </Text>
            <View style={styles.restActions}>
              <Button
                label="−15 s"
                variant="secondary"
                size="sm"
                style={styles.restButton}
                onPress={() => onShift(-15)}
              />
              <Button
                label="Passer"
                variant="secondary"
                size="sm"
                style={styles.restButton}
                onPress={onSkip}
              />
              <Button
                label="+15 s"
                variant="secondary"
                size="sm"
                style={styles.restButton}
                onPress={() => onShift(15)}
              />
            </View>
          </View>
          <View style={styles.restTrack}>
            <Animated.View style={[styles.restFill, { transform: [{ scaleX: fill }] }]} />
          </View>
        </>
      ) : (
        <Text style={styles.restDoneText}>Repos terminé. Série suivante.</Text>
      )}
    </Animated.View>
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
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: 2,
    paddingBottom: spacing.lg,
    marginBottom: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    ...text.title,
    color: theme.colors.text,
    maxWidth: '100%',
  },
  headerMetrics: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: spacing.md,
  },
  headerMetric: {
    alignItems: 'flex-end',
  },
  headerMetricLabel: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: -spacing.xs,
  },
  headerTime: {
    ...text.numL,
    color: theme.colors.action,
    fontVariant: ['tabular-nums'],
  },
  headerTotal: {
    ...text.subtitle,
    color: theme.colors.action,
  },
  card: {
    marginBottom: spacing.xl,
  },
  /**
   * Écart autour de la carte ouverte (exercice en cours ou rouvert) : plus large
   * que celui des lignes terminées, pour que la carte se détache de la pile des
   * exercices déjà faits.
   */
  aroundCard: {
    marginBottom: spacing.xxxl,
  },
  // Un exercice déjà terminé passe à plat : seule la carte de l'exercice en
  // cours reste pleine (une carte maximum par écran, §8.4).
  cardFlat: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    borderRadius: radius.none,
    paddingHorizontal: 0,
  },
  cardSuperset: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.action,
  },
  /** Ligne compacte d'un exercice terminé (même esprit que l'éditeur). */
  doneBody: {
    flex: 1,
    rowGap: 2,
    justifyContent: 'center',
  },
  doneTitle: {
    ...text.subtitle,
    color: theme.colors.text,
  },
  doneMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  /**
   * Cadre de l'exercice replié : même contour que la carte ouverte (2 px
   * `action`), mais un écart plus serré entre deux lignes terminées qu'autour de
   * la carte ouverte (voir `aroundCard`).
   */
  foldedFrame: {
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: theme.colors.action,
    borderRadius: radius.card,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: spacing.md,
  },
  recordHint: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginBottom: spacing.md,
  },
  recordHintNew: {
    ...text.label,
    color: theme.colors.text,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  /** Zone du titre : elle plie/déplie un exercice terminé (le tuto est sur l'image). */
  cardTitleTap: {
    flex: 1,
  },
  cardTitleStatic: {
    flex: 1,
  },
  cardTitle: {
    ...text.subtitle,
    flex: 1,
    color: theme.colors.text,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    columnGap: spacing.sm,
    // Le halo de validation déborde un peu de la ligne (voir `setFlash`).
    position: 'relative',
  },
  setFlash: {
    position: 'absolute',
    top: -spacing.xs,
    bottom: -spacing.xs,
    left: -spacing.sm,
    right: -spacing.sm,
    borderRadius: radius.control,
    backgroundColor: theme.colors.surfaceAlt,
  },
  setLabel: {
    ...text.label,
    color: theme.colors.textMuted,
    width: 16,
    textAlign: 'center',
  },
  previousText: {
    ...text.micro,
    color: theme.colors.textMuted,
    minWidth: 40,
  },
  durationField: {
    flex: 1,
  },
  weightBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radius.control,
    minHeight: 48,
    paddingLeft: 2,
  },
  weightInput: {
    flex: 1,
    textAlign: 'center',
    ...text.title,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  calcButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repsInput: {
    width: 56,
    minHeight: 48,
    textAlign: 'center',
    ...text.title,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radius.control,
  },
  check: {
    minHeight: 48,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  checkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  setActionButton: {
    flex: 1,
  },
  emptyText: {
    ...text.meta,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  keyboardClock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  keyboardClockLabel: {
    ...text.meta,
    color: theme.colors.textMuted,
  },
  keyboardClockTime: {
    ...text.title,
    color: theme.colors.action,
    fontVariant: ['tabular-nums'],
  },
  restBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: theme.colors.background,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  restActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  restButton: {
    paddingHorizontal: 10,
  },
  restDoneText: {
    ...text.bodyStrong,
    color: theme.colors.success,
  },
  restLabel: {
    ...text.meta,
    color: theme.colors.textMuted,
  },
  restTime: {
    ...text.title,
    color: theme.colors.action,
    fontVariant: ['tabular-nums'],
  },
  restTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  restFill: {
    height: 6,
    width: '100%',
    // La jauge se vide en `scaleX` depuis la gauche (pas de marge animée).
    transformOrigin: 'left',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.marker,
  },
});
