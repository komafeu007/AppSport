import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { exerciseImages } from '../data/exerciseImages';
import type { Exercise } from '../services/database';
import { colors, neutrals } from '../theme/colors';

interface Props {
  exercise: Exercise | null;
  visible: boolean;
  onClose: () => void;
}

/** Découpe le texte d'instructions en étapes numérotables (phrases). */
function toSteps(text: string): string[] {
  return text
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

export default function ExerciseDetailModal({ exercise, visible, onClose }: Props) {
  const image = exercise?.image ? exerciseImages[exercise.image] : undefined;
  const steps = exercise?.instructions_fr ? toSteps(exercise.instructions_fr) : [];
  const secondary = exercise ? parseSecondaryMuscles(exercise.secondary_muscles) : [];
  const meta = exercise
    ? [exercise.target, exercise.category, exercise.equipment].filter(Boolean).join(' · ')
    : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Espace vide au-dessus de la feuille : l'appui referme la fiche. */}
        <Pressable
          style={styles.backdropDismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <View style={styles.sheet}>
          {exercise ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
                <View
                  style={[styles.badge, exercise.is_poly === 1 ? styles.badgePoly : styles.badgeMono]}
                >
                  <Text style={styles.badgeText}>{exercise.is_poly === 1 ? 'Poly' : 'Mono'}</Text>
                </View>
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
            </ScrollView>
          ) : null}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: neutrals.border,
    maxHeight: '90%',
  },
  content: {
    padding: 20,
    paddingBottom: 12,
  },
  scroll: {
    flexShrink: 1,
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: neutrals.surfaceAlt,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  imagePlaceholderText: {
    color: neutrals.textMuted,
    fontSize: 14,
  },
  title: {
    color: neutrals.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
  },
  subtitle: {
    color: neutrals.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgePoly: {
    backgroundColor: colors.accent,
  },
  badgeMono: {
    backgroundColor: colors.secondary,
  },
  badgeText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: neutrals.border,
    backgroundColor: neutrals.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    color: neutrals.text,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: 10,
  },
  sectionTitle: {
    color: neutrals.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 22,
    marginBottom: 10,
  },
  instructions: {
    color: neutrals.text,
    fontSize: 15,
    lineHeight: 22,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepIndex: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    width: 24,
  },
  stepText: {
    flex: 1,
    color: neutrals.text,
    fontSize: 15,
    lineHeight: 22,
  },
  closeButton: {
    margin: 20,
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
});
