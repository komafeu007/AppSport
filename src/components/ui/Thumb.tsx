import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '../../theme';
import { radius } from '../../theme/tokens';
import Icon from './Icon';

interface Props {
  source?: ImageSourcePropType;
  /** Côté du carré, en px. */
  size?: number;
  accessibilityLabel?: string;
}

/**
 * Vignette d'exercice : image carrée arrondie, ou cadre neutre avec l'haltère
 * du jeu d'icônes si le catalogue n'a pas d'image (jamais un cadre vide).
 */
export default function Thumb({ source, size = 56, accessibilityLabel }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const style = { width: size, height: size };

  if (!source) {
    return (
      <View style={[styles.thumb, styles.placeholder, styles.center, style]}>
        <Icon name="dumbbell" size={Math.round(size * 0.4)} color={theme.colors.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[styles.thumb, style]}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    thumb: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    placeholder: {
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderStyle: 'dashed',
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
