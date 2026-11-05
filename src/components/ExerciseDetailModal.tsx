import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { exerciseImages } from '../data/exerciseImages';
import { isEndurance } from '../domain/exerciseCatalog';
import { exerciseTermLabel, exerciseTermLabels } from '../domain/exerciseLabels';
import { exerciseGifUrls } from '../lib/exerciseMedia';
import type { Exercise } from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { fontFamily, radius, spacing, text } from '../theme/tokens';
import ExerciseAlternatives from './ExerciseAlternatives';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Sheet, { useSheetDrag } from './ui/Sheet';

interface AlternativesConfig {
  /** Catalogue complet dans lequel chercher les substituts. */
  catalogue: readonly Exercise[];
  /** Ids jamais proposés (le reste de la séance). */
  excludeIds: readonly number[];
  /** Choisit un substitut à la place de l'exercice courant. */
  onReplace: (exercise: Exercise) => void;
  /** Ouvre la liste complète des exercices similaires. */
  onSeeAll: () => void;
}

interface Props {
  exercise: Exercise | null;
  visible: boolean;
  onClose: () => void;
  /** Vue « substitution » : propose des exercices voisins (absent = lecture seule). */
  alternatives?: AlternativesConfig;
}

/** Distance tirée vers le bas (px) qui referme le tuto. */
const DISMISS_DISTANCE = 72;
/** Vitesse du geste (px/s) qui referme le tuto. */
const DISMISS_VELOCITY = 700;
/** Déplacement (px) avant que le glissement ne prenne la main sur le défilement. */
const DRAG_START = 8;

/** Découpe le texte d'instructions en étapes numérotables (phrases). */
function toSteps(value: string): string[] {
  return value
    .split('. ')
    .map((part, index, parts) => (index < parts.length - 1 ? `${part}.` : part))
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSecondaryMuscles(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

/** Fiche détaillée d'un exercice (démonstration animée + tutoriel), en feuille basse. */
export default function ExerciseDetailModal({ exercise, visible, onClose, alternatives }: Props) {
  const styles = useThemedStyles(createStyles);
  const thumb = exercise?.image ? exerciseImages[exercise.image] : undefined;
  const gifUrls = useMemo(() => exerciseGifUrls(exercise?.image), [exercise?.image]);
  const [gifIndex, setGifIndex] = useState(0);
  const [gifFailed, setGifFailed] = useState(false);

  const scrollRef = useRef<ScrollViewType>(null);

  // Réinitialise l'état de chargement du GIF quand on change d'exercice.
  useEffect(() => {
    setGifIndex(0);
    setGifFailed(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [exercise?.id]);

  // Une nouvelle ouverture repart du haut : le geste de fermeture est actif.
  useEffect(() => {
    if (!visible) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [visible]);

  const gifUrl = gifFailed ? undefined : gifUrls[gifIndex];

  const handleGifError = () => {
    if (gifIndex + 1 < gifUrls.length) setGifIndex((index) => index + 1);
    else setGifFailed(true);
  };

  const steps = exercise?.instructions_fr ? toSteps(exercise.instructions_fr) : [];
  const secondary = exercise ? exerciseTermLabels(parseSecondaryMuscles(exercise.secondary_muscles)) : [];
  const meta = exercise
    ? [exercise.target, exercise.category, exercise.equipment]
        .filter((value): value is string => Boolean(value))
        .map(exerciseTermLabel)
        .join(' · ')
    : '';

  return (
    <Sheet visible={visible} onClose={onClose}>
      <DragScroll
        scrollRef={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {exercise ? (
          <>
            {gifUrl ? (
              <Image
                source={gifUrl}
                placeholder={thumb}
                style={styles.image}
                contentFit="contain"
                placeholderContentFit="contain"
                transition={180}
                cachePolicy="memory-disk"
                accessibilityLabel={`Démonstration de ${exercise.nom}`}
                onError={handleGifError}
              />
            ) : thumb ? (
              <Image
                source={thumb}
                style={styles.image}
                contentFit="contain"
                placeholderContentFit="contain"
                accessibilityLabel={exercise.nom}
              />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>Pas d’image</Text>
              </View>
            )}

            {gifFailed ? (
              <Text style={styles.mediaHint}>
                Démonstration animée indisponible — vignette statique affichée.
              </Text>
            ) : null}

            <Text style={styles.title}>{exercise.nom}</Text>

            <View style={styles.badges}>
              <Badge
                label={
                  isEndurance(exercise) ? 'Endurance' : exercise.is_poly === 1 ? 'Poly' : 'Mono'
                }
                tone={
                  isEndurance(exercise) || exercise.is_poly !== 1 ? 'neutral' : 'action'
                }
              />
              {exercise.target ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{exerciseTermLabel(exercise.target)}</Text>
                </View>
              ) : null}
              {exercise.equipment ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{exerciseTermLabel(exercise.equipment)}</Text>
                </View>
              ) : null}
            </View>

            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {secondary.length > 0 ? (
              <Text style={styles.meta}>Muscles secondaires : {secondary.join(', ')}</Text>
            ) : null}

            <Text style={styles.sectionTitle}>Tutoriel</Text>
            {steps.length === 0 ? (
              <Text style={styles.instructions}>Pas d’instructions disponibles.</Text>
            ) : steps.length === 1 ? (
              <Text style={styles.instructions}>{steps[0]}</Text>
            ) : (
              steps.map((step, index) => (
                <View key={step + String(index)} style={styles.step}>
                  <Text style={styles.stepIndex}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))
            )}

            {alternatives ? (
              <ExerciseAlternatives
                base={exercise}
                catalogue={alternatives.catalogue}
                excludeIds={alternatives.excludeIds}
                onReplace={alternatives.onReplace}
                onSeeAll={alternatives.onSeeAll}
              />
            ) : null}
          </>
        ) : null}
      </DragScroll>

      <View style={styles.footer}>
        <Button label="Fermer" onPress={onClose} size="lg" />
      </View>
    </Sheet>
  );
}

interface DragScrollProps {
  scrollRef: RefObject<ScrollViewType | null>;
  style: StyleProp<ViewStyle>;
  contentContainerStyle: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * `ScrollView` de la feuille qui **suit le doigt**.
 *
 * Le geste est un `Pan` de Gesture Handler composé *simultanément* avec le
 * geste natif de défilement (`Gesture.Native`) : la vue défilante garde la main
 * sur le scroll, et le pan ne prend le relais que si le contenu est déjà tout en
 * haut — un glissement vers le bas y est alors une fermeture, pas un défilement.
 * C'est la seule façon d'obtenir ce suivi : un `PanResponder` (ou les
 * événements tactiles) est annulé par la vue défilante native dès les premiers
 * pixels, et ses rappels de défilement ne donnent que la vitesse, jamais la
 * position du doigt.
 */
function DragScroll({ scrollRef, style, contentContainerStyle, children }: DragScrollProps) {
  const sheetDrag = useSheetDrag();
  /** Le contenu est tout en haut. */
  const atTop = useRef(true);
  /** Le geste en cours a commencé alors que le contenu était en haut. */
  const fromTop = useRef(false);

  const gesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Native(),
        Gesture.Pan()
          // Reanimated n'est pas installé : les rappels restent sur le fil JS.
          .runOnJS(true)
          // S'active en descendant seulement : tirer vers le haut défile.
          .activeOffsetY([-100000, DRAG_START])
          .failOffsetY([-16, 100000])
          .failOffsetX([-24, 24])
          .onStart(() => {
            fromTop.current = atTop.current;
          })
          .onUpdate((event) => {
            if (!fromTop.current) return;
            // On retire le seuil d'activation : la feuille ne saute pas de
            // 8 px au moment où le geste prend la main.
            sheetDrag?.follow(Math.max(0, event.translationY - DRAG_START));
          })
          .onEnd((event) => {
            if (!fromTop.current) return;
            fromTop.current = false;
            const dismiss =
              event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
            sheetDrag?.release(dismiss);
          })
          .onFinalize((_event, success) => {
            // Geste interrompu (appel entrant, doigt levé hors zone…) : la
            // feuille reprend sa place au lieu de rester à mi-chemin.
            if (success || !fromTop.current) return;
            fromTop.current = false;
            sheetDrag?.release(false);
          })
      ),
    [sheetDrag]
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.current = event.nativeEvent.contentOffset.y <= 0;
  };

  return (
    <GestureDetector gesture={gesture}>
      <ScrollView
        ref={scrollRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        // Pas de rebond : c'est la feuille qui suit le doigt, pas le contenu.
        bounces={false}
        overScrollMode="never"
      >
        {children}
      </ScrollView>
    </GestureDetector>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      flexShrink: 1,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.md,
    },
    image: {
      width: '100%',
      height: 240,
      borderRadius: radius.card,
      backgroundColor: theme.colors.surfaceAlt,
    },
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    imagePlaceholderText: {
      ...text.meta,
      color: theme.colors.textMuted,
    },
    mediaHint: {
      ...text.micro,
      color: theme.colors.textMuted,
      marginTop: spacing.sm,
    },
    title: {
      ...text.cardTitle,
      color: theme.colors.text,
      marginTop: spacing.lg,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    tag: {
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    tagText: {
      ...text.label,
      color: theme.colors.text,
    },
    meta: {
      ...text.meta,
      color: theme.colors.textMuted,
      marginTop: spacing.sm,
    },
    sectionTitle: {
      ...text.cardTitle,
      color: theme.colors.text,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    instructions: {
      ...text.body,
      color: theme.colors.text,
    },
    step: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    stepIndex: {
      ...text.body,
      fontFamily: fontFamily.textBold,
      color: theme.colors.action,
      width: 24,
    },
    stepText: {
      ...text.body,
      flex: 1,
      color: theme.colors.text,
    },
    footer: {
      padding: spacing.xl,
      paddingTop: spacing.sm,
    },
  });
