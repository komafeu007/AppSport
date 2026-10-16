import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exerciseImages } from '../data/exerciseImages';
import {
  getAllExercises,
  getDatabaseInfo,
  type DatabaseInfo,
  type Exercise,
} from '../services/database';
import { colors, neutrals } from '../theme/colors';

/** Les GIF (122 Mo au total) ne sont pas embarqués : chargés à la demande depuis GitHub. */
const GIF_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/';

function gifUrlFor(image: string | null): string | null {
  return image ? GIF_BASE + image.replace(/\.jpg$/i, '.gif') : null;
}

function parseSecondary(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const ACCENTS: Record<string, string> = {
  à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', î: 'i', ï: 'i',
  ô: 'o', ö: 'o', ù: 'u', û: 'u', ü: 'u', ç: 'c', œ: 'oe',
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[àâäéèêëîïôöùûüçœ]/g, (c) => ACCENTS[c] ?? c);
}

/** Requêtes FR -> termes EN du dataset (les muscles sont stockés en anglais). */
const MUSCLE_ALIASES: Record<string, string[]> = {
  pec: ['pectorals'],
  pecs: ['pectorals'],
  pectoraux: ['pectorals'],
  poitrine: ['pectorals', 'chest'],
  epaule: ['delts', 'shoulders'],
  epaules: ['delts', 'shoulders'],
  dos: ['back', 'lats', 'latissimus'],
  jambe: ['quads', 'hamstrings', 'glutes'],
  jambes: ['quads', 'hamstrings', 'glutes'],
  cuisse: ['quads'],
  cuisses: ['quads'],
  ischio: ['hamstrings'],
  ischios: ['hamstrings'],
  fessier: ['glutes'],
  fessiers: ['glutes'],
  mollet: ['calves'],
  mollets: ['calves'],
  abdo: ['abs', 'waist'],
  abdos: ['abs', 'waist'],
  bras: ['upper arms'],
  avantbras: ['forearms'],
  trapeze: ['traps'],
  trapezes: ['traps'],
  cou: ['neck'],
  cardio: ['cardiovascular system', 'cardio'],
};

/** Mots de mouvement : si le terme cherché est immédiatement suivi de l'un d'eux, c'est un match "central". */
const MOVEMENT_WORDS = new Set([
  'press', 'squat', 'deadlift', 'curl', 'row', 'raise', 'extension', 'fly', 'flye',
  'pulldown', 'pull', 'push', 'lunge', 'dip', 'crunch', 'plank', 'thrust', 'bridge',
  'shrug', 'kickback', 'pushdown', 'pullover', 'crossover', 'clean', 'snatch', 'jerk',
  'march', 'walk', 'run', 'jump', 'swing', 'twist', 'rotation', 'stretch', 'climber',
]);

/** Mouvements classiques : bonus pour faire remonter les exercices "principaux". */
const CLASSIC_PHRASES = [
  'bench press', 'incline bench press', 'decline bench press',
  'full squat', 'front squat', 'back squat', 'hack squat',
  'deadlift', 'romanian deadlift', 'stiff leg deadlift',
  'pull-up', 'chin-up', 'push-up', 'dip', 'overhead press', 'military press',
  'shoulder press', 'lateral raise', 'front raise', 'rear delt',
  'barbell row', 'dumbbell row', 'seated row', 'lat pulldown', 'upright row',
  'biceps curl', 'hammer curl', 'preacher curl', 'triceps extension', 'triceps pushdown',
  'leg press', 'leg extension', 'leg curl', 'calf raise', 'lunge', 'shrug',
  'plank', 'crunch', 'hip thrust', 'glute bridge', 'face pull', 'good morning',
  'pullover', 'pushdown', 'push down',
];

function classicBonus(name: string | null | undefined, terms: string[]): number {
  if (!name) return 0;
  const n = normalize(name);
  return CLASSIC_PHRASES.some(
    (phrase) => n.includes(phrase) && terms.some((term) => term.length > 0 && phrase.includes(term))
  )
    ? 5
    : 0;
}

function queryTerms(query: string): string[] {
  const base = normalize(query.trim());
  if (!base) return [];
  return [base, ...(MUSCLE_ALIASES[base] ?? []).map(normalize)];
}

/**
 * Score de pertinence d'un terme dans un texte (0 = pas de match).
 * Plus le score est élevé, plus le match est "central".
 */
function matchScore(text: string | null | undefined, terms: string[]): number {
  if (!text) return 0;
  const t = normalize(text);
  let best = 0;

  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i];
    if (!term) continue;
    const idx = t.indexOf(term);
    if (idx < 0) continue;

    let s = 1; // sous-chaîne
    if (t === term) s = 5; // nom identique
    else if (idx === 0) s = 4; // commence par le terme
    else if (/[\s\-/()]/.test(t[idx - 1] ?? '')) s = 3; // début de mot

    // bonus si le mot suivant est un mouvement (ex. "bench press" avant "bench front squat")
    const after = t
      .slice(idx + term.length)
      .replace(/^[\s\-/()]+/, '')
      .split(/[\s\-/()]+/)[0];
    if (after && MOVEMENT_WORDS.has(after)) s += 1.2;

    // léger bonus : match plus tôt dans le nom et nom plus court
    s += Math.max(0, (30 - Math.min(idx, 30)) / 200);
    s += Math.max(0, (40 - Math.min(t.length, 40)) / 200);

    // un alias (i > 0) pèse un peu moins que le terme saisi
    if (i > 0) s *= 0.9;

    if (s > best) best = s;
  }
  return best;
}

function ExerciseRow({ exercise, onPress }: { exercise: Exercise; onPress: () => void }) {
  const source = exercise.image ? exerciseImages[exercise.image] : undefined;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {source ? (
        <Image source={source} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>{exercise.nom_fr ?? exercise.nom}</Text>
          <View style={[styles.badge, exercise.is_poly === 1 ? styles.badgePoly : styles.badgeMono]}>
            <Text style={styles.badgeText}>{exercise.is_poly === 1 ? 'Poly' : 'Mono'}</Text>
          </View>
        </View>
        <Text style={styles.rowEn}>{exercise.nom}</Text>
        <Text style={styles.rowMeta}>
          {[exercise.target, exercise.category, exercise.equipment].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const [gifReady, setGifReady] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const local = exercise.image ? exerciseImages[exercise.image] : undefined;
  const gif = gifUrlFor(exercise.image);

  return (
    <View style={styles.mediaBox}>
      {local ? (
        <Image source={local} style={styles.mediaImage} />
      ) : (
        <View style={[styles.mediaImage, styles.mediaPlaceholder]} />
      )}
      {gif && !gifFailed && (
        <Image
          source={{ uri: gif }}
          style={[styles.mediaImage, styles.mediaOverlay, { opacity: gifReady ? 1 : 0 }]}
          onLoad={() => setGifReady(true)}
          onError={() => setGifFailed(true)}
        />
      )}
    </View>
  );
}

function DetailModal({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const secondary = exercise ? parseSecondary(exercise.secondary_muscles) : [];
  return (
    <Modal visible={exercise !== null} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          {exercise && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{exercise.nom_fr ?? exercise.nom}</Text>
              <Text style={styles.modalSub}>
                {[exercise.nom, exercise.equipment].filter(Boolean).join(' · ')}
              </Text>

              <ExerciseMedia key={exercise.id} exercise={exercise} />

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {[exercise.target, exercise.category].filter(Boolean).join(' · ') || '—'}
                </Text>
                <View
                  style={[styles.badge, exercise.is_poly === 1 ? styles.badgePoly : styles.badgeMono]}
                >
                  <Text style={styles.badgeText}>{exercise.is_poly === 1 ? 'Poly' : 'Mono'}</Text>
                </View>
              </View>

              {secondary.length > 0 && (
                <Text style={styles.secondaryText}>{secondary.join(' · ')}</Text>
              )}

              <Text style={styles.sectionTitle}>Instructions</Text>
              <Text style={styles.modalText}>{exercise.instructions_fr ?? '—'}</Text>
            </ScrollView>
          )}
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type ExerciseSection = { title: string; data: Exercise[] };

interface Ranked {
  exercise: Exercise;
  score: number;
}

function sortByRelevance(a: Ranked, b: Ranked): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.exercise.nom.length !== b.exercise.nom.length) {
    return a.exercise.nom.length - b.exercise.nom.length;
  }
  return a.exercise.nom.localeCompare(b.exercise.nom);
}

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getAllExercises(db), getDatabaseInfo(db)])
      .then(([rows, diagnostics]) => {
        if (!mounted) return;
        setExercises(rows);
        setInfo(diagnostics);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
      });
    return () => {
      mounted = false;
    };
  }, [db]);

  const sections = useMemo<ExerciseSection[]>(() => {
    const terms = queryTerms(searchTerm);
    if (terms.length === 0) {
      return [{ title: '', data: exercises }];
    }

    const primary: Ranked[] = [];
    const secondary: Ranked[] = [];

    for (const ex of exercises) {
      const baseName = Math.max(matchScore(ex.nom, terms), matchScore(ex.nom_fr, terms));
      const nameScore = baseName > 0 ? baseName + classicBonus(ex.nom, terms) : 0;
      const targetScore = matchScore(ex.target, terms);
      const categoryScore = matchScore(ex.category, terms);
      // nom > muscle cible > partie du corps
      const primaryScore = Math.max(nameScore * 3, targetScore * 2, categoryScore);

      const secondaryScore = Math.max(
        0,
        ...parseSecondary(ex.secondary_muscles).map((m) => matchScore(m, terms))
      );

      if (primaryScore > 0) primary.push({ exercise: ex, score: primaryScore });
      else if (secondaryScore > 0) secondary.push({ exercise: ex, score: secondaryScore });
    }

    primary.sort(sortByRelevance);
    secondary.sort(sortByRelevance);

    const result: ExerciseSection[] = [];
    if (primary.length > 0) {
      result.push({
        title: secondary.length > 0 ? 'Principal' : '',
        data: primary.map((r) => r.exercise),
      });
    }
    if (secondary.length > 0) {
      result.push({ title: 'Secondaire', data: secondary.map((r) => r.exercise) });
    }
    return result;
  }, [exercises, searchTerm]);

  const resultCount = useMemo(
    () => sections.reduce((total, section) => total + section.data.length, 0),
    [sections]
  );

  const searching = searchTerm.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>AppSport Local</Text>
        <Text style={styles.subtitle}>
          {searching
            ? `${resultCount} résultat${resultCount > 1 ? 's' : ''} pour « ${searchTerm.trim()} »`
            : `${exercises.length} exercice${exercises.length > 1 ? 's' : ''} au catalogue`}
        </Text>
        {info && (
          <Text style={styles.diagnostics}>
            SQLite {info.sqliteVersion} · schéma v{info.schemaVersion} · {info.exerciseCount} lignes
          </Text>
        )}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="Rechercher un exercice ou un muscle…"
            placeholderTextColor={neutrals.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setSearchTerm(query)}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          <Pressable style={styles.searchButton} onPress={() => setSearchTerm(query)}>
            <Text style={styles.searchButtonText}>Rechercher</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : resultCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucun résultat pour « {searchTerm.trim()} »</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ExerciseRow exercise={item} onPress={() => setSelected(item)} />
          )}
          renderSectionHeader={({ section }) =>
            section.title ? <Text style={styles.sectionHeader}>{section.title}</Text> : null
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}

      <DetailModal exercise={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: neutrals.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.secondary,
    fontSize: 14,
    marginTop: 4,
  },
  diagnostics: {
    color: neutrals.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  search: {
    flex: 1,
    backgroundColor: neutrals.surface,
    borderWidth: 1,
    borderColor: neutrals.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: neutrals.text,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionHeader: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: neutrals.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: neutrals.border,
    padding: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: neutrals.surfaceAlt,
  },
  thumbPlaceholder: {
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  rowBody: {
    flex: 1,
    marginLeft: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: neutrals.text,
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    paddingRight: 8,
  },
  rowEn: {
    color: neutrals.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  rowMeta: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  separator: {
    height: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
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
  emptyText: {
    color: neutrals.textMuted,
    fontSize: 15,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  errorText: {
    color: colors.alert,
    fontSize: 15,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: neutrals.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 8,
  },
  modalTitle: {
    color: neutrals.text,
    fontSize: 22,
    fontWeight: '800',
  },
  modalSub: {
    color: neutrals.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  mediaBox: {
    alignSelf: 'center',
    width: 180,
    height: 180,
    marginTop: 16,
  },
  mediaImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: neutrals.surfaceAlt,
  },
  mediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  mediaPlaceholder: {
    borderWidth: 1,
    borderColor: neutrals.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  metaText: {
    color: neutrals.text,
    fontSize: 14,
    flexShrink: 1,
    paddingRight: 8,
  },
  secondaryText: {
    color: neutrals.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 4,
  },
  modalText: {
    color: neutrals.text,
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: colors.accent,
    margin: 20,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
});
