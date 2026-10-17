import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { neutrals } from '../../theme/colors';
import { spacing, text } from '../../theme/tokens';
import Appear from './Appear';
import Button from './Button';
import Sheet from './Sheet';

export interface ConfirmRequest {
  /** Question posée (ex. « Supprimer le groupe »). */
  title: string;
  /** Détail de ce qui va se passer. */
  message?: string;
  /** Libellé du bouton principal (défaut : « Confirmer »). */
  confirmLabel?: string;
  /** Libellé du bouton secondaire (défaut : « Annuler »). */
  cancelLabel?: string;
  /** Action irréversible : bouton principal en rouge. */
  destructive?: boolean;
  /** Simple information : pas de bouton « Annuler ». */
  hideCancel?: boolean;
  onConfirm?: () => void;
}

interface Props {
  /** `null` = fermée. */
  request: ConfirmRequest | null;
  /** Annulation (bouton, appui à côté, retour Android). */
  onClose: () => void;
}

/**
 * Confirmation en carte dans une feuille basse, à la place de `Alert.alert` :
 * même vocabulaire visuel que le reste de l'app, gros boutons, fermeture en
 * touchant à côté. Le texte reste affiché pendant l'animation de fermeture.
 */
export default function ConfirmSheet({ request, onClose }: Props) {
  // Dernière demande mémorisée : garde la carte remplie pendant qu'elle se referme.
  const [last, setLast] = useState(request);
  useEffect(() => {
    if (request) setLast(request);
  }, [request]);

  const current = request ?? last;
  if (!current) return null;

  const onPressConfirm = () => {
    const action = current.onConfirm;
    onClose();
    action?.();
  };

  return (
    <Sheet visible={request !== null} onClose={onClose}>
      <Appear style={styles.body} offset={8}>
        <Text style={styles.title}>{current.title}</Text>
        {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

        <Appear style={styles.actions} delay={60} offset={6}>
          <Button
            label={current.confirmLabel ?? 'Confirmer'}
            variant={current.destructive === true ? 'danger' : 'primary'}
            size="lg"
            onPress={onPressConfirm}
          />
          {current.hideCancel === true ? null : (
            <Button
              label={current.cancelLabel ?? 'Annuler'}
              variant="ghost"
              size="lg"
              onPress={onClose}
            />
          )}
        </Appear>
      </Appear>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    ...text.cardTitle,
    color: neutrals.text,
  },
  message: {
    ...text.meta,
    color: neutrals.textMuted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
