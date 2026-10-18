import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { exerciseImages } from '../data/exerciseImages';
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

  // Réinitialise l'état de chargement du GIF quand on change d'exercice.
  useEffect(() => {
    setGifIndex(0);
    setGifFailed(false);
  }, [exercise?.id]);

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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
                label={exercise.is_poly === 1 ? 'Poly' : 'Mono'}
                tone={exercise.is_poly === 1 ? 'action' : 'neutral'}
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
