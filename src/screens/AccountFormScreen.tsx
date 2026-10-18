import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Appear,
  Button,
  Card,
  Chip,
  ConfirmSheet,
  Input,
  SectionTitle,
  StateView,
  type ConfirmRequest,
} from '../components/ui';
import {
  EQUIPMENTS,
  DEFAULT_NIVEAU,
  HEALTH_ZONES,
  NIVEAUX,
  OBJECTIFS,
  SESSION_DURATIONS,
  SESSION_FORMATS,
  WEEKLY_FREQUENCIES,
  parseKeyList,
  type ProfileOption,
} from '../domain/profile';
import { formatRest, rulesFor } from '../domain/workoutRules';
import type { RootStackParamList } from '../navigation/types';
import { useAccount } from '../services/account';
import {
  createAccount,
  getAccount,
  updateAccount,
  type AccountInput,
} from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountForm' | 'WelcomeForm'>;

const DURATION_OPTIONS: readonly ProfileOption[] = SESSION_DURATIONS.map((value) => ({
  key: String(value),
  label: `${value} min`,
}));

const FREQUENCY_OPTIONS: readonly ProfileOption[] = WEEKLY_FREQUENCIES.map((value) => ({
  key: String(value),
  label: value === 1 ? '1 séance' : `${value} séances`,
}));

/** « 82,5 » → 82.5 ; vide/invalide → null. */
function parseNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Rangée de puces sélectionnables (choix unique ou multiple). */
function ChipGroup({
  options,
  values,
  onToggle,
}: {
  options: readonly ProfileOption[];
  values: string[];
  onToggle: (key: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip
          key={option.key}
          label={option.label}
          selected={values.includes(option.key)}
          onPress={() => onToggle(option.key)}
        />
      ))}
    </View>
  );
}

export default function AccountFormScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { accountId, select, reload } = useAccount();
  const editingId = route.params?.accountId ?? null;

  const [prenom, setPrenom] = useState('');
  const [age, setAge] = useState('');
  const [taille, setTaille] = useState('');
  const [poids, setPoids] = useState('');
  const [objectif, setObjectif] = useState<string | null>(null);
  const [niveau, setNiveau] = useState<string>(DEFAULT_NIVEAU);
  const [frequence, setFrequence] = useState<number | null>(null);
  const [duree, setDuree] = useState<number | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [materiel, setMateriel] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(editingId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    if (editingId === null) return;
    let mounted = true;
    getAccount(db, editingId)
      .then((row) => {
        if (!mounted) return;
        if (!row) {
          setError('Profil introuvable.');
          setLoading(false);
          return;
        }
        setPrenom(row.prenom);
        setAge(row.age !== null ? String(row.age) : '');
        setTaille(row.taille !== null ? String(row.taille) : '');
        setPoids(row.poids !== null ? String(row.poids) : '');
        setObjectif(row.objectif);
        setNiveau(row.niveau ?? DEFAULT_NIVEAU);
        setFrequence(row.sessions_per_week);
        setDuree(row.duree_seance);
        setFormat(row.format_seance);
        setMateriel(parseKeyList(row.materiel));
        setZones(parseKeyList(row.douleurs_zones));
        setNote(row.douleurs_note ?? '');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [db, editingId]);

  const toggleMulti = (setter: (updater: (prev: string[]) => string[]) => void) => (key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));

  const notify = (title: string, message: string) =>
    setConfirm({ title, message, confirmLabel: 'Compris', hideCancel: true });

  const onSave = async () => {
    const name = prenom.trim();
    if (!name) {
      notify('Prénom requis', 'Indique au moins un prénom pour identifier le profil.');
      return;
    }

    const input: AccountInput = {
      prenom: name,
      age: parseNumber(age),
      taille: parseNumber(taille),
      poids: parseNumber(poids),
      objectif,
      niveau,
      sessions_per_week: frequence,
      duree_seance: duree,
      format_seance: format,
      materiel,
      douleurs_zones: zones,
      douleurs_note: note.trim() || null,
    };

    const onboarding = accountId === null;
    try {
      setSaving(true);
      if (editingId !== null) {
        await updateAccount(db, editingId, input);
        await reload();
        navigation.goBack();
      } else {
        const id = await createAccount(db, input);
        if (onboarding) {
          // Fin du questionnaire : on propose tout de suite un programme généré,
          // à valider (aperçu + régénération). Le profil devient actif en sortant.
          navigation.navigate('WelcomeGenerator', { accountId: id });
        } else {
          await select(id);
          // En pile app, le nouvel onglet reste affiché : on revient à l'accueil.
          navigation.popToTop();
        }
      }
    } catch (cause: unknown) {
      setSaving(false);
      notify('Erreur', cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
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

  const polyRules = rulesFor(1);
  const monoRules = rulesFor(0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Appear>
          <Text style={styles.label}>Prénom</Text>
          <Input
            style={styles.input}
            placeholder="Ex. Simon"
            value={prenom}
            onChangeText={setPrenom}
            returnKeyType="done"
            autoFocus={editingId === null}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Âge</Text>
              <Input
                style={styles.input}
                placeholder="ans"
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Taille</Text>
              <Input
                style={styles.input}
                placeholder="cm"
                value={taille}
                onChangeText={setTaille}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Poids</Text>
              <Input
                style={styles.input}
                placeholder="kg"
                value={poids}
                onChangeText={setPoids}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>
        </Appear>

        <Appear style={styles.section}>
          <SectionTitle>Objectif</SectionTitle>
          <ChipGroup
            options={OBJECTIFS}
            values={objectif ? [objectif] : []}
            onToggle={(key) => setObjectif((prev) => (prev === key ? null : key))}
          />
        </Appear>

        <Appear style={styles.section}>
          <SectionTitle>Niveau</SectionTitle>
          <ChipGroup options={NIVEAUX} values={[niveau]} onToggle={(key) => setNiveau(key)} />
          <Text style={styles.rulesHint}>
            Le niveau ajuste le volume du programme généré (séries et exercices par séance),
            pas les charges : celles-ci viennent de ton historique.
          </Text>
        </Appear>

        <Appear style={styles.section}>
          <SectionTitle>Fréquence & durée</SectionTitle>
          <Text style={styles.subLabel}>Entraînements par semaine</Text>
          <ChipGroup
            options={FREQUENCY_OPTIONS}
            values={frequence !== null ? [String(frequence)] : []}
            onToggle={(key) =>
              setFrequence((prev) => (prev === Number(key) ? null : Number(key)))
            }
          />
          <Text style={styles.subLabel}>Temps par séance</Text>
          <ChipGroup
            options={DURATION_OPTIONS}
            values={duree !== null ? [String(duree)] : []}
            onToggle={(key) => setDuree((prev) => (prev === Number(key) ? null : Number(key)))}
          />
        </Appear>

        <Appear style={styles.section}>
          <SectionTitle>Format de séance</SectionTitle>
          <ChipGroup
            options={SESSION_FORMATS}
            values={format ? [format] : []}
            onToggle={(key) => setFormat((prev) => (prev === key ? null : key))}
          />
        </Appear>

        <Appear style={styles.section}>
          <SectionTitle>Matériel disponible</SectionTitle>
          <ChipGroup
            options={EQUIPMENTS}
            values={materiel}
            onToggle={toggleMulti(setMateriel)}
          />
        </Appear>

        <Appear style={styles.section}>
          <SectionTitle>État de santé</SectionTitle>
          <Text style={styles.subLabel}>Zones sensibles / douloureuses</Text>
          <ChipGroup options={HEALTH_ZONES} values={zones} onToggle={toggleMulti(setZones)} />
          <Text style={styles.subLabel}>Précisions (optionnel)</Text>
          <Input
            style={[styles.input, styles.noteInput]}
            placeholder="Ex. douleur genou droit en flexion, tendinite épaule…"
            value={note}
            onChangeText={setNote}
            multiline
          />
        </Appear>

        <Appear style={styles.section}>
          <Card>
            <SectionTitle>Règles de séries & repos</SectionTitle>
            <Text style={styles.rules}>
              Polyarticulaire (squat, développé, tirage…) : {polyRules.seriesRange[0]} à{' '}
              {polyRules.seriesRange[1]} séries · repos {formatRest(polyRules.restRange[0])}.
            </Text>
            <Text style={styles.rules}>
              Monoarticulaire (curl, extension, élévations…) : {monoRules.seriesRange[0]} à{' '}
              {monoRules.seriesRange[1]} séries · repos {formatRest(monoRules.restRange[0])} à{' '}
              {formatRest(monoRules.restRange[1])}.
            </Text>
            <Text style={styles.rulesHint}>
              Ces réglages sont préremplis automatiquement sur chaque exercice de séance, puis
              restent modifiables.
            </Text>
          </Card>
        </Appear>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={editingId !== null ? 'Enregistrer' : 'Créer mon profil'}
          size="lg"
          loading={saving}
          onPress={onSave}
        />
      </View>

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </KeyboardAvoidingView>
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
  label: {
    ...text.label,
    color: theme.colors.textMuted,
  },
  subLabel: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  input: {
    marginTop: spacing.sm,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  col: {
    flex: 1,
  },
  section: {
    marginTop: spacing.xxl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rules: {
    ...text.meta,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  rulesHint: {
    ...text.caption,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
});
