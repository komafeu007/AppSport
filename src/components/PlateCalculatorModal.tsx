import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  computePlates,
  DEFAULT_BAR_WEIGHTS,
  DEFAULT_PLATES,
  formatWeight,
  sortWeightsDesc,
} from '../domain/plates';
import { colors, neutrals } from '../theme/colors';

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

function parseAmount(text: string): number | null {
  const value = round2(Number(text.replace(',', '.')));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function Chip({
  label,
  selected,
  onPress,
  onLongPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function CustomAdder({ placeholder, onAdd }: { placeholder: string; onAdd: (value: number) => void }) {
  const [text, setText] = useState('');

  const submit = () => {
    const value = parseAmount(text);
    if (value !== null) {
      onAdd(value);
      setText('');
    }
  };

  return (
    <View style={styles.adderRow}>
      <TextInput
        style={styles.adderInput}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={neutrals.textMuted}
        keyboardType="decimal-pad"
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <Pressable style={styles.adderButton} onPress={submit}>
        <Text style={styles.adderButtonText}>Ajouter</Text>
      </Pressable>
    </View>
  );
}

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

  // À l'ouverture, on repart du poids réel de la série.
  useEffect(() => {
    if (visible) setWeightText(formatWeight(weight));
  }, [visible]);

  const onWeightText = (text: string) => {
    setWeightText(text);
    const parsed = Number(text.replace(',', '.'));
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

  const confirmRemove = (value: number, kind: 'bar' | 'plate') => {
    const label = kind === 'bar' ? 'cette barre' : 'ce disque';
    Alert.alert(
      'Supprimer',
      `Retirer ${formatWeight(value)} kg de ${label} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => (kind === 'bar' ? onRemoveBar(value) : onRemovePlate(value)),
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Espace vide au-dessus de la feuille : l'appui referme le calculateur. */}
        <Pressable
          style={styles.backdropDismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <View style={styles.sheet}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Chargement</Text>
            <Text style={styles.hint}>
              Choisis ta barre et tes disques : les poids à mettre à gauche et à droite sont calculés
              automatiquement. Appui long sur une barre/disque perso pour le supprimer.
            </Text>

            <Text style={styles.label}>Poids total (kg)</Text>
            <TextInput
              style={styles.weightInput}
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
                    customBars.includes(value) ? () => confirmRemove(value, 'bar') : undefined
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
                    Reste {formatWeight(breakdown.remainder)} kg par côté : ajoute un disque plus
                    petit pour tomber juste.
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
                    customPlates.includes(value) ? () => confirmRemove(value, 'plate') : undefined
                  }
                />
              ))}
            </View>
            <CustomAdder placeholder="Disque perso (kg)" onAdd={onAddPlate} />
          </ScrollView>

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
    maxHeight: '88%',
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 12,
  },
  scroll: {
    flexShrink: 1,
  },
  title: {
    color: neutrals.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  hint: {
    color: neutrals.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  label: {
    color: neutrals.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },
  weightInput: {
    backgroundColor: neutrals.surfaceAlt,
    borderRadius: 12,
    color: neutrals.text,
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: neutrals.border,
    backgroundColor: neutrals.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipText: {
    color: neutrals.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.background,
  },
  adderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  adderInput: {
    flex: 1,
    backgroundColor: neutrals.surfaceAlt,
    borderRadius: 10,
    color: neutrals.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  adderButton: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  adderButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  plateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  platePill: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  platePillText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  resultLine: {
    color: neutrals.text,
    fontSize: 14,
    fontWeight: '700',
  },
  resultMuted: {
    color: neutrals.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  resultWarn: {
    color: colors.alert,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
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
