import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
} from 'react-native';

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
import Sheet from './ui/Sheet';

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

/** Vitesse d'un geste vers le bas (points/ms) qui referme le tuto. */
const DISMISS_VELOCITY = 0.5;
/** Traction vers le bas (px, rebond iOS) qui referme le tuto. */
const DISMISS_PULL = 64;

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
  /** Le contenu est en haut : tirer vers le bas referme la fiche. */
  const atTop = useRef(true);
  /** Le geste en cours a commencé alors que le contenu était en haut. */
  const draggedFromTop = useRef(false);
  /** Plus grande traction vers le bas pendant le geste (rebond iOS, en px). */
  const pulledDown = useRef(0);

  // Réinitialise l'état de chargement du GIF quand on change d'exercice.
  useEffect(() => {
    setGifIndex(0);
    setGifFailed(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    atTop.current = true;
  }, [exercise?.id]);

  // Une nouvelle ouverture repart du haut : le geste de fermeture est actif.
  useEffect(() => {
    if (!visible) return;
    atTop.current = true;
    draggedFromTop.current = false;
    pulledDown.current = 0;
  }, [visible]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    atTop.current = offset <= 0;
    if (draggedFromTop.current && offset < 0) {
      pulledDown.current = Math.max(pulledDown.current, -offset);
    }
  };

  const handleScrollBeginDrag = () => {
    draggedFromTop.current = atTop.current;
    pulledDown.current = 0;
  };

  /*
   * Fermeture au glissement vers le bas, **depuis le haut seulement**.
   *
   * Le geste est lu sur le `ScrollView` lui-même (`onScrollBeginDrag` /
   * `onScrollEndDrag`) : un `PanResponder` ou les événements tactiles ne
   * suffisent pas, car la vue défilante native prend la main dès les premiers
   * pixels et annule le geste côté JS. À l'inverse, elle signale toujours le
   * début et la fin du glissement, avec sa vitesse (points/ms) : un geste
   * vers le bas qui part du haut n'a rien à faire défiler, il referme la fiche.
   * Sur iOS le rebond du contenu donne en plus la distance tirée.
   */
  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!draggedFromTop.current) return;
    draggedFromTop.current = false;
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    const pulled = pulledDown.current;
    pulledDown.current = 0;
    if (velocity > DISMISS_VELOCITY || pulled > DISMISS_PULL) onClose();
  };

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
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        // Android : pas de halo de survol au sommet (le geste referme la fiche).
        overScrollMode="never"
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
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Fermer" onPress={onClose} size="lg" />
      </View>
    </Sheet>
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
      marginTop: spacing.md - 2,
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
