import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  computePlates,
  DEFAULT_BAR_WEIGHTS,
  DEFAULT_PLATES,
  formatWeight,
  sortWeightsDesc,
} from '../domain/plates';
import { colors, neutrals } from '../theme/colors';
import { radius, spacing, text } from '../theme/tokens';
import Button from './ui/Button';
import Chip from './ui/Chip';
import ConfirmSheet, { type ConfirmRequest } from './ui/ConfirmSheet';
import Input from './ui/Input';
import Sheet from './ui/Sheet';

interface Props {
  visible: boolean;
  /** Poids total de la série (modifiable directement ici). */
  weight: number;
  barWeight: number;
  customBars: number[];
  /** Disques actifs utilisés pour le calcul. */
  plates: number[];
  customPlates: number[];
  onChangeWeight: (value: number) => void;
  onSelectBar: (value: number) => void;
  onAddBar: (value: number) => void;
  onRemoveBar: (value: number) => void;
  onTogglePlate: (value: number) => void;
  onAddPlate: (value: number) => void;
  onRemovePlate: (value: number) => void;
  onClose: () => void;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseAmount(value: string): number | null {
  const parsed = round2(Number(value.replace(',', '.')));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function CustomAdder({ placeholder, onAdd }: { placeholder: string; onAdd: (value: number) => void }) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const value = parseAmount(draft);
    if (value !== null) {
      onAdd(value);
      setDraft('');
    }
  };

  return (
    <View style={styles.adderRow}>
      <Input
        style={styles.adderInput}
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        keyboardType="decimal-pad"
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <Button label="Ajouter" onPress={submit} />
    </View>
  );
}

/** Calculateur de chargement (barre + disques) pour la série en cours. */
export default function PlateCalculatorModal({
  visible,
  weight,
  barWeight,
  customBars,
  plates,
  customPlates,
  onChangeWeight,
  onSelectBar,
  onAddBar,
  onRemoveBar,
  onTogglePlate,
  onAddPlate,
  onRemovePlate,
  onClose,
}: Props) {
  const [weightText, setWeightText] = useState(() => formatWeight(weight));
  /** Demande de suppression d'une barre / d'un disque perso. */
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // À l'ouverture seulement, on repart du poids réel de la série (ne pas écraser
  // la saisie en cours quand `weight` change à chaque frappe).
  useEffect(() => {
    if (visible) setWeightText(formatWeight(weight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onWeightText = (value: string) => {
    setWeightText(value);
    const parsed = Number(value.replace(',', '.'));
    // Poids conservé tel quel (jamais arrondi).
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChangeWeight(parsed);
    }
  };

  const barOptions = useMemo(
    () => sortWeightsDesc([...DEFAULT_BAR_WEIGHTS, ...customBars]),
    [customBars]
  );
  const plateOptions = useMemo(
    () => sortWeightsDesc([...DEFAULT_PLATES, ...customPlates]),
    [customPlates]
  );

  const breakdown = useMemo(
    () => computePlates(weight, barWeight, plates),
    [weight, barWeight, plates]
  );

  const askRemove = (value: number, kind: 'bar' | 'plate') => {
    const label = kind === 'bar' ? 'cette barre' : 'ce disque';
    setConfirm({
      title: 'Supprimer',
      message: `Retirer ${formatWeight(value)} kg de ${label} ?`,
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () => (kind === 'bar' ? onRemoveBar(value) : onRemovePlate(value)),
    });
  };

  return (
    <Sheet visible={visible} title="Chargement" onClose={onClose}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Choisis ta barre et tes disques : les poids à mettre à gauche et à droite sont calculés
          automatiquement. Appui long sur une barre/disque perso pour le supprimer.
        </Text>

        <Text style={styles.label}>Poids total (kg)</Text>
        <Input
          emphasis
          value={weightText}
          onChangeText={onWeightText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          returnKeyType="done"
        />

        <Text style={styles.label}>Barre</Text>
        <View style={styles.chips}>
          {barOptions.map((value) => (
            <Chip
              key={value}
              label={`${formatWeight(value)} kg`}
              selected={value === barWeight}
              onPress={() => onSelectBar(value)}
              onLongPress={
                customBars.includes(value) ? () => askRemove(value, 'bar') : undefined
              }
            />
          ))}
        </View>
        <CustomAdder placeholder="Barre perso (kg)" onAdd={onAddBar} />

        <Text style={styles.label}>Par côté</Text>
        {weight <= barWeight ? (
          <Text style={styles.resultMuted}>
            {weight < barWeight
              ? `La barre seule (${formatWeight(barWeight)} kg) est déjà plus lourde que le poids visé.`
              : 'Barre seule, aucun disque à charger.'}
          </Text>
        ) : (
          <>
            {breakdown.perSide.length > 0 ? (
              <View style={styles.plateList}>
                {breakdown.perSide.map((load) => (
                  <View key={load.plate} style={styles.platePill}>
                    <Text style={styles.platePillText}>
                      {load.count} × {formatWeight(load.plate)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.resultMuted}>Aucun disque disponible.</Text>
            )}
            <Text style={styles.resultLine}>
              {formatWeight(breakdown.sideWeight)} kg / côté · total{' '}
              {formatWeight(breakdown.total)} kg
            </Text>
            {breakdown.remainder > 0 ? (
              <Text style={styles.resultWarn}>
                Reste {formatWeight(breakdown.remainder)} kg par côté : ajoute un disque plus petit
                pour tomber juste.
              </Text>
            ) : null}
          </>
        )}

        <Text style={styles.label}>Disques disponibles</Text>
        <View style={styles.chips}>
          {plateOptions.map((value) => (
            <Chip
              key={value}
              label={`${formatWeight(value)} kg`}
              selected={plates.includes(value)}
              onPress={() => onTogglePlate(value)}
              onLongPress={
                customPlates.includes(value) ? () => askRemove(value, 'plate') : undefined
              }
            />
          ))}
        </View>
        <CustomAdder placeholder="Disque perso (kg)" onAdd={onAddPlate} />
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Fermer" onPress={onClose} size="lg" />
      </View>

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  hint: {
    ...text.caption,
    color: neutrals.textMuted,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  label: {
    ...text.overline,
    color: neutrals.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  adderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm + 2,
  },
  adderInput: {
    flex: 1,
  },
  plateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  platePill: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm,
  },
  platePillText: {
    ...text.label,
    color: colors.background,
    fontWeight: '800',
  },
  resultLine: {
    ...text.label,
    color: neutrals.text,
  },
  resultMuted: {
    ...text.meta,
    color: neutrals.textMuted,
    lineHeight: 20,
  },
  resultWarn: {
    ...text.caption,
    color: colors.alert,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
  },
});
