import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type Theme } from '../theme';
import { MAX_FONT_SCALE, spacing, text, touch } from '../theme/tokens';
import DashedLine from './ui/DashedLine';
import PressableScale from './ui/PressableScale';
import Sheet from './ui/Sheet';

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  /** Action irréversible (ex. suppression) : libellé en rouge. */
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  /** Titre affiché sous la poignée (ex. le nom du groupe). */
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

/**
 * Menu d'actions en feuille basse (§8.5 listes). Remplace `Alert.alert` quand il
 * y a plus de trois actions (Android n'en affiche que trois). L'action choisie
 * est rejouée une fois la feuille refermée, pour ne pas présenter deux modales.
 */
export default function ActionSheet({ visible, title, items, onClose }: Props) {
  const styles = useThemedStyles(createStyles);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const selectItem = (item: ActionSheetItem) => {
    onClose();
    setPendingAction(() => item.onPress);
  };

  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onClose}
      onDismissed={() => {
        const action = pendingAction;
        setPendingAction(null);
        action?.();
      }}
    >
      <View style={styles.items}>
        {items.map((item, index) => (
          <View key={item.label}>
            <PressableScale
              style={styles.item}
              onPress={() => selectItem(item)}
              accessibilityRole="button"
            >
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.itemCode}>{String(index + 1).padStart(2, '0')}</Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.itemText, item.destructive === true && styles.itemDanger]}>
                {item.label}
              </Text>
            </PressableScale>
            {index < items.length - 1 ? <DashedLine /> : null}
          </View>
        ))}
      </View>

      <PressableScale style={styles.cancel} onPress={onClose} accessibilityRole="button">
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.cancelText}>[ Annuler ]</Text>
      </PressableScale>
    </Sheet>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    items: {
      paddingHorizontal: spacing.md,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: touch.min,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    itemCode: {
      ...text.caption,
      color: theme.colors.textMuted,
    },
    itemText: {
      ...text.cardTitle,
      flex: 1,
      color: theme.colors.text,
    },
    itemDanger: {
      color: theme.colors.danger,
    },
    cancel: {
      marginTop: spacing.sm,
      marginHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    cancelText: {
      ...text.label,
      color: theme.colors.textMuted,
    },
  });
