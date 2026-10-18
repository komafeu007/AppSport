import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type Theme } from '../theme';
import { spacing, text, touch } from '../theme/tokens';
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
        {items.map((item) => (
          <PressableScale
            key={item.label}
            style={styles.item}
            onPress={() => selectItem(item)}
            accessibilityRole="button"
          >
            <Text style={[styles.itemText, item.destructive === true && styles.itemDanger]}>
              {item.label}
            </Text>
          </PressableScale>
        ))}
      </View>

      <PressableScale style={styles.cancel} onPress={onClose} accessibilityRole="button">
        <Text style={styles.cancelText}>Annuler</Text>
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
      minHeight: touch.min,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemText: {
      ...text.subtitle,
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
      ...text.subtitle,
      color: theme.colors.textMuted,
    },
  });
