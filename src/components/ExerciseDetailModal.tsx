import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { exerciseImages } from '../data/exerciseImages';
import type { Exercise } from '../services/database';
import { colors, neutrals } from '../theme/colors';
import { radius, spacing, text } from '../theme/tokens';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Sheet from './ui/Sheet';

interface Props {
  exercise: Exercise | null;
  visible: boolean;
  onClose: () => void;
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

/** Fiche détaillée d'un exercice (image + tutoriel), en feuille basse. */
export default function ExerciseDetailModal({ exercise, visible, onClose }: Props) {
  const image = exercise?.image ? exerciseImages[exercise.image] : undefined;
  const steps = exercise?.instructions_fr ? toSteps(exercise.instructions_fr) : [];
  const secondary = exercise ? parseSecondaryMuscles(exercise.secondary_muscles) : [];
  const meta = exercise
    ? [exercise.target, exercise.category, exercise.equipment].filter(Boolean).join(' · ')
    : '';

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {exercise ? (
          <>
            {image ? (
              <Image source={image} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>Pas d’image</Text>
              </View>
            )}

            <Text style={styles.title}>{exercise.nom_fr ?? exercise.nom}</Text>
            {exercise.nom_fr ? <Text style={styles.subtitle}>{exercise.nom}</Text> : null}

            <View style={styles.badges}>
              <Badge
                label={exercise.is_poly === 1 ? 'Poly' : 'Mono'}
                tone={exercise.is_poly === 1 ? 'accent' : 'secondary'}
              />
              {exercise.target ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{exercise.target}</Text>
                </View>
              ) : null}
              {exercise.equipment ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{exercise.equipment}</Text>
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
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Fermer" onPress={onClose} size="lg" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: neutrals.surfaceAlt,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  imagePlaceholderText: {
    ...text.meta,
    color: neutrals.textMuted,
  },
  title: {
    ...text.cardTitle,
    color: neutrals.text,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...text.caption,
    color: neutrals.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: neutrals.border,
    backgroundColor: neutrals.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagText: {
    ...text.caption,
    color: neutrals.text,
    fontWeight: '700',
  },
  meta: {
    ...text.meta,
    color: colors.secondary,
    marginTop: spacing.md - 2,
  },
  sectionTitle: {
    ...text.overline,
    color: neutrals.textMuted,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  instructions: {
    ...text.body,
    color: neutrals.text,
    lineHeight: 22,
  },
  step: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  stepIndex: {
    ...text.body,
    color: colors.accent,
    fontWeight: '800',
    width: 24,
  },
  stepText: {
    ...text.body,
    flex: 1,
    color: neutrals.text,
    lineHeight: 22,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
  },
});
