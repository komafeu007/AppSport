import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Chip,
  ConfirmSheet,
  Input,
  PressableScale,
  ScreenHeader,
  StateView,
  type ConfirmRequest,
} from '../components/ui';
import {
  EQUIPMENTS,
  HEALTH_ZONES,
  OBJECTIFS,
  SEXES,
  SESSION_DURATIONS,
  SESSION_FORMATS,
  WEEKLY_FREQUENCIES,
  parseKeyList,
  type ProfileOption,
} from '../domain/profile';
import { MUSCLE_AXES, collapseMuscleKeys, sameMuscleAxis } from '../domain/muscles';
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
import { padIndex } from '../lib/format';
import { MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountForm' | 'WelcomeForm'>;

const DURATION_OPTIONS: readonly ProfileOption[] = SESSION_DURATIONS.map((value) => ({
  key: String(value),
  label: `${value}′`,
}));

const FREQUENCY_OPTIONS: readonly ProfileOption[] = WEEKLY_FREQUENCIES.map((value) => ({
  key: String(value),
  label: padIndex(value, 2),
}));

/**
 * Points forts et points faibles partagent les mêmes axes que les radars,
 * jambes regroupées. Cocher « Jambes » vise les quatre muscles du bas du corps
 * d'un coup : le générateur éclate la clé (cf. `expandMuscleKeys`).
 */
const MUSCLE_OPTIONS: readonly ProfileOption[] = MUSCLE_AXES.map((group) => ({
  key: group.key,
  label: group.label,
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

/** Cadre à filet avec son titre mono posé sur la bordure du haut. */
function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.fieldset}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.fieldsetTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Choix unique en lignes pleine largeur : `[ ]  Esthétique   OBJ-A`. */
function ChoiceList({
  options,
  value,
  prefix,
  onToggle,
}: {
  options: readonly ProfileOption[];
  value: string | null;
  prefix: string;
  onToggle: (key: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.choiceList}>
      {options.map((option, index) => {
        const selected = option.key === value;
        const ink = selected ? styles.inkSelected : styles.inkIdle;
        return (
          <PressableScale
            key={option.key}
            onPress={() => onToggle(option.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            scaleTo={0.99}
            style={[styles.choiceRow, selected ? styles.choiceRowSelected : null]}
          >
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.choiceBox, ink]}>{selected ? '[■]' : '[ ]'}</Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.choiceLabel, ink]} numberOfLines={2}>
              {option.label}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.choiceRef, selected ? styles.inkSelected : styles.inkMuted]}>
              {`${prefix}-${String.fromCharCode(65 + index)}`}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Petit jeu d'options en grille de cases carrées ; sélection = aplat crème. */
function CellGrid({
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
    <View style={styles.cells}>
      {options.map((option) => {
        const selected = values.includes(option.key);
        return (
          <PressableScale
            key={option.key}
            onPress={() => onToggle(option.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            scaleTo={0.96}
            style={[styles.cell, selected ? styles.cellSelected : null]}
          >
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.cellText, selected ? styles.cellTextSelected : null]}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Champ numérique avec son unité collée à droite (ANS, CM, KG). */
function UnitField({
  label,
  unit,
  ...rest
}: { label: string; unit: string } & ComponentProps<typeof Input>) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.col}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label}>{label}</Text>
      <View>
        <Input style={[styles.input, styles.unitInput]} {...rest} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.unit} pointerEvents="none">
          {unit}
        </Text>
      </View>
    </View>
  );
}

export default function AccountFormScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { accountId, select, reload } = useAccount();
  const editingId = route.params?.accountId ?? null;

  const [prenom, setPrenom] = useState('');
  const [age, setAge] = useState('');
  const [taille, setTaille] = useState('');
  const [poids, setPoids] = useState('');
  const [objectif, setObjectif] = useState<string | null>(null);
  const [sexe, setSexe] = useState<string | null>(null);
  const [pointsForts, setPointsForts] = useState<string[]>([]);
  const [pointsFaibles, setPointsFaibles] = useState<string[]>([]);
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
        setSexe(row.sexe);
        // Points forts / faibles stockés à la maille fine par les versions
        // précédentes : les quatre muscles de jambe se replient sur « Jambes ».
        setPointsForts(collapseMuscleKeys(parseKeyList(row.points_forts)));
        setPointsFaibles(collapseMuscleKeys(parseKeyList(row.points_faibles)));
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

  /**
   * Un muscle ne peut pas être à la fois point fort et point faible : le dernier
   * choix gagne, on retire de la liste opposée tout ce qui vise le même axe
   * (« Jambes » côté faible écarte quadriceps, ischios, fessiers et mollets).
   */
  const toggleFocus = (
    setter: (updater: (prev: string[]) => string[]) => void,
    other: (updater: (prev: string[]) => string[]) => void,
    key: string
  ) => {
    toggleMulti(setter)(key);
    other((prev) => prev.filter((item) => !sameMuscleAxis(item, key)));
  };

  const notify = (title: string, message: string) =>
    setConfirm({ title, message, confirmLabel: 'Compris', hideCancel: true });

  const onSave = async () => {
    const name = prenom.trim();
    if (!name) {
      notify('Prénom requis', 'Indique un prénom pour ce profil.');
      return;
    }

    const input: AccountInput = {
      prenom: name,
      age: parseNumber(age),
      taille: parseNumber(taille),
      poids: parseNumber(poids),
      objectif,
      sexe,
      points_forts: collapseMuscleKeys(pointsForts),
      points_faibles: collapseMuscleKeys(pointsFaibles),
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          kicker="Fiche opérateur"
          title={editingId !== null ? 'Modifier le profil' : 'Nouveau profil'}
          compact
          style={styles.header}
        />

        <Fieldset title="SEC. 01 — IDENTITÉ">
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label}>Prénom</Text>
          <Input
            style={styles.input}
            placeholder="Ex. Simon"
            value={prenom}
            onChangeText={setPrenom}
            returnKeyType="done"
            autoFocus={editingId === null}
            accessibilityLabel="Prénom du profil"
          />

          <View style={styles.row}>
            <UnitField
              label="Âge"
              unit="ANS"
              placeholder="0"
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              returnKeyType="done"
              accessibilityLabel="Âge, en années"
            />
            <UnitField
              label="Taille"
              unit="CM"
              placeholder="0"
              value={taille}
              onChangeText={setTaille}
              keyboardType="numeric"
              returnKeyType="done"
              accessibilityLabel="Taille, en centimètres"
            />
            <UnitField
              label="Poids"
              unit="KG"
              placeholder="0"
              value={poids}
              onChangeText={setPoids}
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel="Poids, en kilos"
            />
          </View>

          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subLabel}>Sexe</Text>
          <CellGrid
            options={SEXES}
            values={sexe ? [sexe] : []}
            onToggle={(key) => setSexe((prev) => (prev === key ? null : key))}
          />
        </Fieldset>

        <Fieldset title="SEC. 02 — OBJECTIF">
          <ChoiceList
            options={OBJECTIFS}
            value={objectif}
            prefix="OBJ"
            onToggle={(key) => setObjectif((prev) => (prev === key ? null : key))}
          />
        </Fieldset>

        <Fieldset title="SEC. 03 — RYTHME">
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label}>Entraînements par semaine</Text>
          <CellGrid
            options={FREQUENCY_OPTIONS}
            values={frequence !== null ? [String(frequence)] : []}
            onToggle={(key) =>
              setFrequence((prev) => (prev === Number(key) ? null : Number(key)))
            }
          />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subLabel}>Temps par séance</Text>
          <CellGrid
            options={DURATION_OPTIONS}
            values={duree !== null ? [String(duree)] : []}
            onToggle={(key) => setDuree((prev) => (prev === Number(key) ? null : Number(key)))}
          />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subLabel}>Format de séance</Text>
          <ChoiceList
            options={SESSION_FORMATS}
            value={format}
            prefix="FMT"
            onToggle={(key) => setFormat((prev) => (prev === key ? null : key))}
          />
        </Fieldset>

        <Fieldset title="SEC. 04 — POINTS FORTS / FAIBLES">
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label}>Points faibles à prioriser</Text>
          <View style={styles.chipsGap}>
            <ChipGroup
              options={MUSCLE_OPTIONS}
              values={pointsFaibles}
              onToggle={(key) => toggleFocus(setPointsFaibles, setPointsForts, key)}
            />
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subLabel}>Points forts à limiter</Text>
          <ChipGroup
            options={MUSCLE_OPTIONS}
            values={pointsForts}
            onToggle={(key) => toggleFocus(setPointsForts, setPointsFaibles, key)}
          />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rulesHint}>
            Un point faible reçoit plus de séries. Un point fort est allégé : moins de séries, un
            seul exercice. « Jambes » couvre tout le bas du corps.
          </Text>
        </Fieldset>

        <Fieldset title="SEC. 05 — MATÉRIEL">
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label}>Matériel disponible</Text>
          <View style={styles.chipsGap}>
            <ChipGroup options={EQUIPMENTS} values={materiel} onToggle={toggleMulti(setMateriel)} />
          </View>
        </Fieldset>

        <Fieldset title="SEC. 06 — ÉTAT DE SANTÉ">
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label}>Zones sensibles / douloureuses</Text>
          <View style={styles.chipsGap}>
            <ChipGroup options={HEALTH_ZONES} values={zones} onToggle={toggleMulti(setZones)} />
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rulesHint}>
            Les exercices qui sollicitent ces zones sont retirés du programme.
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subLabel}>Précisions (optionnel)</Text>
          <Input
            style={[styles.input, styles.noteInput]}
            placeholder="Ex. douleur genou droit en flexion, tendinite épaule…"
            value={note}
            onChangeText={setNote}
            multiline
            accessibilityLabel="Précisions sur les zones sensibles"
          />
        </Fieldset>

        <Fieldset title="SEC. 07 — RÈGLES">
          {/* Information, pas action : elle reste à plat. */}
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.label}>Règles de séries & repos</Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.rules, styles.chipsGap]}>
            Polyarticulaire (squat, développé, tirage…) : {polyRules.seriesRange[0]} à{' '}
            {polyRules.seriesRange[1]} séries, repos {formatRest(polyRules.restRange[0])}.
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rules}>
            Monoarticulaire (curl, extension, élévations…) : {monoRules.seriesRange[0]} à{' '}
            {monoRules.seriesRange[1]} séries, repos {formatRest(monoRules.restRange[0])} à{' '}
            {formatRest(monoRules.restRange[1])}.
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rulesHint}>
            Préremplis sur chaque exercice, modifiables ensuite.
          </Text>
        </Fieldset>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Button
          label={editingId !== null ? 'Enregistrer' : 'Créer mon profil'}
          code={editingId !== null ? 'SAVE' : 'RUN'}
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: spacing.md,
  },
  fieldset: {
    marginTop: spacing.xxl,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  fieldsetTitle: {
    ...text.caption,
    position: 'absolute',
    top: -9,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.action,
  },
  label: {
    ...text.label,
    color: theme.colors.textMuted,
  },
  subLabel: {
    ...text.label,
    color: theme.colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    marginTop: spacing.sm,
  },
  unitInput: {
    paddingRight: 44,
  },
  unit: {
    ...text.caption,
    position: 'absolute',
    right: spacing.md,
    top: spacing.sm + 18,
    color: theme.colors.textMuted,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  col: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipsGap: {
    marginTop: spacing.sm,
  },
  choiceList: {
    gap: spacing.sm,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  choiceRowSelected: {
    backgroundColor: theme.colors.action,
    borderColor: theme.colors.action,
  },
  choiceBox: {
    ...text.label,
  },
  choiceLabel: {
    ...text.cardTitle,
    flex: 1,
  },
  choiceRef: {
    ...text.caption,
  },
  inkSelected: {
    color: theme.colors.onAction,
  },
  inkIdle: {
    color: theme.colors.text,
  },
  inkMuted: {
    color: theme.colors.textMuted,
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    minWidth: 52,
    height: 48,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  cellSelected: {
    backgroundColor: theme.colors.selectedSurface,
    borderColor: theme.colors.selectedSurface,
  },
  cellText: {
    ...text.label,
    color: theme.colors.text,
  },
  cellTextSelected: {
    color: theme.colors.onSelected,
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
});
