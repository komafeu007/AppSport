import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACTIVE_WORKOUT_BUBBLE_SPACE } from '../components/ActiveWorkoutBubble';
import BodyMannequin from '../components/BodyMannequin';
import MeasurementLineChart from '../components/MeasurementLineChart';
import SessionCalendar, { type CalendarMode } from '../components/SessionCalendar';
import {
  Button,
  Card,
  IconButton,
  Input,
  PressableScale,
  Row,
  ScreenHeader,
  SectionTitle,
  Sheet,
  SheetScrollView,
  StateView,
  StatTiles,
  SystemBar,
} from '../components/ui';
import {
  MEASUREMENT_HINTS,
  MEASUREMENT_ZONES,
  formatCm,
  formatCmDelta,
  parseMeasure,
  readingsByZone,
  type MeasurementZone,
} from '../domain/bodyMeasurements';
import {
  dayKey,
  formatDotDate,
  formatDotDateYear,
  formatMonthYear,
  formatWeekdayShort,
  isoWeekNumber,
  padIndex,
  startOfWeek,
} from '../lib/format';
import { useAccount } from '../services/account';
import { useActiveWorkout } from '../services/activeWorkout';
import {
  addBodyMeasurement,
  deleteBodyMeasurement,
  getBodyMeasurements,
  getCompletedSessions,
  setAccountWeight,
  type BodyMeasurement,
  type CompletedSession,
} from '../services/database';
import { useThemedStyles, type Theme } from '../theme';
import { scale, MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

const KICKER = '03 — Corps & activité';

export default function StatsScreen() {
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { accountId, account, reload } = useAccount();
  const activeWorkout = useActiveWorkout();
  const { width: windowWidth } = useWindowDimensions();

  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MeasurementZone | null>(null);
  const [editing, setEditing] = useState<MeasurementZone | null>(null);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<CalendarMode>('week');
  const loaded = useRef(false);

  const load = useCallback(() => {
    if (accountId === null) return;
    let mounted = true;
    if (!loaded.current) setLoading(true);
    Promise.all([getBodyMeasurements(db, accountId), getCompletedSessions(db, accountId)])
      .then(([measurementRows, sessionRows]) => {
        if (!mounted) return;
        setMeasurements(measurementRows);
        setSessions(sessionRows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
        loaded.current = true;
      });
    return () => {
      mounted = false;
    };
  }, [accountId, db]);

  useFocusEffect(load);

  const readings = useMemo(() => readingsByZone(measurements), [measurements]);
  const measured = useMemo(
    () => new Set(MEASUREMENT_ZONES.filter((zone) => readings[zone.key].latest).map((zone) => zone.key)),
    [readings]
  );
  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      const key = dayKey(session.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [sessions]);

  const openZone = (zone: MeasurementZone) => {
    setSelected(zone);
    const latest = readings[zone].latest;
    // Sans pesée enregistrée, on part du poids saisi dans le profil.
    const fallback = zone === 'poids' ? (account?.poids ?? null) : null;
    setDraft(latest ? formatCm(latest.value_cm) : fallback !== null ? formatCm(fallback) : '');
    setEditing(zone);
  };

  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Erreur inconnue');

  const parsedDraft = editing === null ? null : parseMeasure(draft, editing);
  const saveMeasurement = () => {
    if (accountId === null || editing === null || parsedDraft === null) return;
    const zone = editing;
    addBodyMeasurement(db, accountId, zone, parsedDraft)
      .then(async () => {
        // La dernière pesée devient le poids du profil (générateur, formulaire).
        if (zone === 'poids') {
          await setAccountWeight(db, accountId, parsedDraft);
          await reload();
        }
      })
      .then(load)
      .catch(fail);
    setEditing(null);
  };

  const removeMeasurement = (id: number) => {
    deleteBodyMeasurement(db, id).then(load).catch(fail);
  };

  const toggleCalendar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode((current) => (current === 'week' ? 'month' : 'week'));
  };

  const header = <ScreenHeader kicker={KICKER} title="Stats" />;

  if (loading || error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        {loading ? (
          <StateView kind="loading" style={styles.flex} />
        ) : (
          <StateView kind="error" title="Base de données indisponible" message={error ?? ''} style={styles.flex} />
        )}
      </SafeAreaView>
    );
  }

  const now = new Date();
  // Carte : 20 px de marge d'écran + 16 px de marge interne de chaque côté.
  const cardInner = windowWidth - spacing.xl * 2 - spacing.lg * 2 - 2;
  const mannequinWidth = Math.min(170, Math.round(cardInner * 0.42));

  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = mode === 'week' ? weekStart : monthStart;
  const periodCount = sessions.filter((session) => new Date(session.date) >= periodStart).length;
  const weekTarget = account?.sessions_per_week ?? null;
  const countLabel =
    mode === 'week' && weekTarget
      ? `${padIndex(periodCount)}/${padIndex(weekTarget)} SÉANCES`
      : `${padIndex(periodCount)} SÉANCE${periodCount > 1 ? 'S' : ''}`;

  const editingZone = MEASUREMENT_ZONES.find((zone) => zone.key === editing) ?? null;
  const editingReading = editing ? readings[editing] : null;
  const editingHistory = editingReading?.history ?? [];
  const editingUnit = editingZone?.unit ?? 'cm';
  const editingPoints = [...editingHistory]
    .reverse()
    .map((entry) => ({ label: formatDotDate(entry.date), value: entry.value_cm }));
  const evolution = MEASUREMENT_ZONES.filter((zone) => readings[zone.key].latest !== null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SystemBar
        center={`${formatWeekdayShort(now)} ${formatDotDateYear(now)}`}
        right={`SEM. ${padIndex(isoWeekNumber(now))}`}
      />
      {header}

      <ScrollView
        contentContainerStyle={[styles.content, activeWorkout !== null && styles.contentReserved]}
      >
        <Card crosshair style={styles.card}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>
            // Mensurations — poids en kg, tours en cm
          </Text>
          <View style={styles.body}>
            <BodyMannequin
              width={mannequinWidth}
              measured={measured}
              selected={selected}
              onSelect={openZone}
            />
            <View style={styles.readouts}>
              {MEASUREMENT_ZONES.map((zone) => {
                const reading = readings[zone.key];
                const isSelected = zone.key === selected;
                return (
                  <PressableScale
                    key={zone.key}
                    onPress={() => openZone(zone.key)}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel={`${zone.label} : ${
                      reading.latest
                        ? `${formatCm(reading.latest.value_cm)} ${zone.unit === 'kg' ? 'kilos' : 'centimètres'}`
                        : 'non mesuré'
                    }`}
                    style={[styles.readout, isSelected && styles.readoutSelected]}
                  >
                    <Text
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[styles.readoutLabel, isSelected && styles.readoutLabelSelected]}
                      numberOfLines={1}
                    >
                      {zone.label}
                    </Text>
                    <View style={styles.readoutValueRow}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.readoutValue}>
                          {reading.latest ? formatCm(reading.latest.value_cm) : '—'}
                      </Text>
                      {zone.unit === 'kg' && reading.latest ? (
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.readoutDelta}>KG</Text>
                      ) : null}
                      {reading.delta !== null ? (
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.readoutDelta}>
                          {formatCmDelta(reading.delta)}
                        </Text>
                      ) : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.hint}>
            Touche une zone du mannequin ou une ligne pour saisir sa mesure.
          </Text>
        </Card>

        <View style={styles.section}>
          <SectionTitle hint={evolution.length > 0 ? `${padIndex(evolution.length)} suivies` : undefined}>
            Évolution
          </SectionTitle>
          {evolution.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.hint}>
              Aucune mesure pour l’instant. Chaque nouvelle saisie s’ajoute à l’historique et trace la courbe.
            </Text>
          ) : (
            evolution.map((zone, index) => {
              const reading = readings[zone.key];
              const history = reading.history;
              const first = history[history.length - 1];
              const unit = zone.unit.toUpperCase();
              const meta =
                history.length > 1
                  ? `${formatCm(first.value_cm)} → ${formatCm(history[0].value_cm)} ${unit} · ${padIndex(history.length)} MESURES`
                  : `${formatCm(history[0].value_cm)} ${unit} · ${formatDotDate(history[0].date)}`;
              return (
                <Row
                  key={zone.key}
                  inset={false}
                  last={index === evolution.length - 1}
                  onPress={() => openZone(zone.key)}
                  accessibilityLabel={`${zone.label}, ${meta}`}
                >
                  <View style={styles.flex}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.evolutionTitle} numberOfLines={1}>
                      {zone.label}
                    </Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.evolutionMeta} numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                  {history.length > 1 ? (
                    <View style={styles.sparkline}>
                      <MeasurementLineChart
                        compact
                        height={scale(28)}
                        points={[...history].reverse().map((entry) => ({
                          label: formatDotDate(entry.date),
                          value: entry.value_cm,
                        }))}
                      />
                    </View>
                  ) : null}
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.evolutionDelta}>
                    {reading.total !== null ? formatCmDelta(reading.total) : '—'}
                  </Text>
                </Row>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle
            hint={mode === 'week' ? `SEM. ${padIndex(isoWeekNumber(now))}` : formatMonthYear(now).toUpperCase()}
          >
            Séances
          </SectionTitle>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.count}>
            {countLabel}
          </Text>
          <SessionCalendar mode={mode} countsByDay={countsByDay} onToggle={toggleCalendar} today={now} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>
            {mode === 'week' ? '// Touche la grille pour voir le mois' : '// Touche la grille pour revenir à la semaine'}
          </Text>
        </View>
      </ScrollView>

      <Sheet
        visible={editing !== null}
        title={editingZone ? `${editingZone.code} ${editingZone.label}` : undefined}
        onClose={() => setEditing(null)}
      >
        <SheetScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          {editing ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.sheetHint}>
              {MEASUREMENT_HINTS[editing]}
            </Text>
          ) : null}
          <View style={styles.inputRow}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder={editingUnit === 'kg' ? 'ex. 78,5' : 'ex. 38,5'}
              keyboardType="decimal-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveMeasurement}
              style={styles.input}
              accessibilityLabel={`${editingZone?.label ?? 'Mesure'} en ${
                editingUnit === 'kg' ? 'kilos' : 'centimètres'
              }`}
            />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.inputUnit}>
              {editingUnit.toUpperCase()}
            </Text>
          </View>
          <View style={styles.sheetActions}>
            <Button label="Annuler" variant="tertiary" style={styles.flex} onPress={() => setEditing(null)} />
            <Button
              label="Enregistrer"
              style={styles.flex}
              disabled={parsedDraft === null}
              onPress={saveMeasurement}
            />
          </View>

          {editingReading && editingHistory.length > 1 ? (
            <View style={styles.sheetSection}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>
                // Évolution
              </Text>
              <StatTiles
                tiles={[
                  {
                    label: 'Départ',
                    value: formatCm(editingHistory[editingHistory.length - 1].value_cm),
                    unit: editingUnit,
                  },
                  { label: 'Actuel', value: formatCm(editingHistory[0].value_cm), unit: editingUnit },
                  {
                    label: 'Écart',
                    value: editingReading.total !== null ? formatCmDelta(editingReading.total) : '—',
                    unit: editingUnit,
                    accent: true,
                  },
                ]}
              />
              <MeasurementLineChart
                points={editingPoints}
                formatValue={formatCm}
                accessibilityLabel={`Évolution ${editingZone?.label ?? ''} : de ${formatCm(
                  editingPoints[0].value
                )} à ${formatCm(editingPoints[editingPoints.length - 1].value)} ${editingUnit}`}
              />
            </View>
          ) : null}

          {editingHistory.length > 0 ? (
            <View style={styles.sheetSection}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.caption}>
                // Historique
              </Text>
              <View>
                {editingHistory.slice(0, 8).map((entry, index, list) => (
                  <Row key={entry.id} inset={false} last={index === list.length - 1} style={styles.historyRow}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.caption, styles.flex]}>
                      {formatDotDateYear(entry.date)}
                    </Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.historyValue}>
                      {formatCm(entry.value_cm)} {editingUnit.toUpperCase()}
                    </Text>
                    <IconButton
                      icon="close"
                      tone="danger"
                      accessibilityLabel={`Supprimer la mesure du ${formatDotDate(entry.date)}`}
                      onPress={() => removeMeasurement(entry.id)}
                    />
                  </Row>
                ))}
              </View>
            </View>
          ) : null}
        </SheetScrollView>
      </Sheet>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    contentReserved: {
      paddingBottom: spacing.xxxl + ACTIVE_WORKOUT_BUBBLE_SPACE,
    },
    card: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    caption: {
      ...text.caption,
      color: theme.colors.textMuted,
    },
    body: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    readouts: {
      flex: 1,
    },
    readout: {
      minHeight: scale(40),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    readoutSelected: {
      borderBottomColor: theme.colors.action,
    },
    readoutLabel: {
      ...text.caption,
      flexShrink: 1,
      color: theme.colors.textMuted,
    },
    readoutLabelSelected: {
      color: theme.colors.action,
    },
    readoutValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs,
    },
    readoutValue: {
      ...text.numS,
      color: theme.colors.text,
    },
    readoutDelta: {
      ...text.caption,
      fontSize: scale(10),
      color: theme.colors.textMuted,
    },
    hint: {
      ...text.meta,
      color: theme.colors.textMuted,
    },
    section: {
      marginTop: spacing.xxl,
      gap: spacing.md,
    },
    count: {
      ...text.monoValue,
      color: theme.colors.text,
    },
    sheetContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    sheetHint: {
      ...text.meta,
      color: theme.colors.textMuted,
    },
    sheetActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    sheetScroll: {
      flexGrow: 0,
    },
    sheetSection: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    input: {
      flex: 1,
    },
    inputUnit: {
      ...text.label,
      color: theme.colors.textMuted,
    },
    evolutionTitle: {
      ...text.cardTitle,
      color: theme.colors.text,
    },
    evolutionMeta: {
      ...text.caption,
      color: theme.colors.textMuted,
      marginTop: spacing.xs,
    },
    sparkline: {
      width: scale(72),
    },
    evolutionDelta: {
      ...text.monoValue,
      minWidth: scale(48),
      textAlign: 'right',
      color: theme.colors.text,
    },
    historyRow: {
      minHeight: scale(48),
    },
    historyValue: {
      ...text.monoValue,
      color: theme.colors.text,
    },
  });
