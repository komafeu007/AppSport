import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, neutrals } from '../theme/colors';
import { spacing, text } from '../theme/tokens';
import Appear from './ui/Appear';
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
 * Menu d'actions en feuille basse. Remplace `Alert.alert` quand il y a plus de
 * trois actions (Android n'en affiche que trois). L'action choisie est rejouée
 * une fois la feuille refermée, pour ne pas présenter deux modales en même temps.
 */
export default function ActionSheet({ visible, title, items, onClose }: Props) {
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
          <Appear key={item.label} delay={index * 40} offset={8}>
            <PressableScale
              style={styles.item}
              onPress={() => selectItem(item)}
              accessibilityRole="button"
            >
              <Text style={[styles.itemText, item.destructive === true && styles.itemDanger]}>
                {item.label}
              </Text>
            </PressableScale>
          </Appear>
        ))}
      </View>

      <PressableScale style={styles.cancel} onPress={onClose} accessibilityRole="button">
        <Text style={styles.cancelText}>Annuler</Text>
      </PressableScale>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  items: {
    paddingHorizontal: spacing.md,
  },
  item: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: spacing.md,
  },
  itemText: {
    ...text.subtitle,
    color: neutrals.text,
  },
  itemDanger: {
    color: colors.alert,
  },
  cancel: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
    alignItems: 'center',
  },
  cancelText: {
    ...text.subtitle,
    color: neutrals.textMuted,
  },
});
