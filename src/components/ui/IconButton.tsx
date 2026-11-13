import { StyleSheet } from 'react-native';

import { useThemedStyles, useTheme, type Theme } from '../../theme';
import { scale, radius } from '../../theme/tokens';
import Icon, { type IconName } from './Icon';
import PressableScale from './PressableScale';

interface Props {
  /** Icône du jeu unique de l'app (voir `Icon`). */
  icon: IconName;
  onPress: () => void;
  /** `danger` = suppression, `accent` = validation. */
  tone?: 'neutral' | 'danger' | 'accent';
  /** Remplit le fond (état actif : coche, validation de séance). */
  active?: boolean;
  size?: number;
  accessibilityLabel: string;
}

/** Bouton compact pour les actions de ligne (supprimer, valider, menu). */
export default function IconButton({
  icon,
  onPress,
  tone = 'neutral',
  active = false,
  size = scale(44),
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const fillColor =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'accent'
        ? theme.colors.action
        : theme.colors.selectedSurface;

  const iconColor = active
    ? tone === 'danger'
      ? theme.colors.onDanger
      : tone === 'accent'
        ? theme.colors.onAction
        : theme.colors.onSelected
    : tone === 'danger'
      ? theme.colors.danger
      : tone === 'accent'
        ? theme.colors.action
        : theme.colors.text;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.92}
      hitSlop={8}
      style={[
        styles.button,
        { width: size, height: size },
        active && { backgroundColor: fillColor, borderColor: fillColor },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={iconColor} />
    </PressableScale>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      // Un bouton d'icône est un contrôle : sa limite doit se lire (3:1).
      borderColor: theme.colors.borderStrong,
      backgroundColor: 'transparent',
      borderRadius: radius.sm,
    },
  });
