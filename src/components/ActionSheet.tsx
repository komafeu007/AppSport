import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { colors, neutrals } from '../theme/colors';

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  /** Action irréversible (ex. suppression) : libellé en rouge. */
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  /** Titre affiché en haut de la feuille (ex. le nom du groupe). */
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

/**
 * Menu d'actions en feuille basse. Remplace `Alert.alert` quand il y a plus de
 * trois actions (Android n'en affiche que trois) et se ferme de la même façon
 * partout : appui **à côté** de la feuille, bouton « Annuler », ou bouton
 * retour d'Android.
 */
export default function ActionSheet({ visible, title, items, onClose }: Props) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  /**
   * Une action peut ouvrir un autre écran/modal. Sur iOS il faut attendre que
   * la feuille soit vraiment refermée (sinon la présentation est ignorée) : on
   * conserve l'action et on la rejoue dans `onDismiss`. Android n'appelle pas
   * `onDismiss` : on exécute directement.
   */
  const selectItem = (item: ActionSheetItem) => {
    onClose();
    if (Platform.OS === 'ios') {
      setPendingAction(() => item.onPress);
    } else {
      item.onPress();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        const action = pendingAction;
        setPendingAction(null);
        action?.();
      }}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Capture l'appui : toucher la feuille ne doit pas la refermer. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {items.map((item) => (
            <Pressable key={item.label} style={styles.item} onPress={() => selectItem(item)}>
              <Text style={[styles.itemText, item.destructive === true && styles.itemTextDanger]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={[styles.item, styles.cancelItem]} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: neutrals.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: neutrals.border,
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 12,
  },
  title: {
    color: neutrals.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
  },
  itemText: {
    color: neutrals.text,
    fontSize: 16,
    fontWeight: '700',
  },
  itemTextDanger: {
    color: colors.alert,
  },
  cancelItem: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: neutrals.border,
    alignItems: 'center',
  },
  cancelText: {
    color: neutrals.textMuted,
    fontSize: 16,
    fontWeight: '800',
  },
});
