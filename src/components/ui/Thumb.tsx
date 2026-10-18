import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { useThemedStyles, type Theme } from '../../theme';
import { radius } from '../../theme/tokens';

interface Props {
  source?: ImageSourcePropType;
  /** Côté du carré, en px. */
  size?: number;
  accessibilityLabel?: string;
}

/**
 * Vignette d'exercice : image carrée arrondie, ou cadre neutre si le catalogue
 * n'a pas d'image. Utilisée partout où un exercice est listé.
 */
export default function Thumb({ source, size = 56, accessibilityLabel }: Props) {
  const styles = useThemedStyles(createStyles);
  const style = { width: size, height: size };

  if (!source) {
    return <View style={[styles.thumb, styles.placeholder, style]} />;
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
    },
    placeholder: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
