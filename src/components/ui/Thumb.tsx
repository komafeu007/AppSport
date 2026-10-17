import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { neutrals } from '../../theme/colors';
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
  const style = { width: size, height: size, borderRadius: radius.sm + 2 };

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

const styles = StyleSheet.create({
  thumb: {
    backgroundColor: neutrals.surfaceAlt,
  },
  placeholder: {
    borderWidth: 1,
    borderColor: neutrals.border,
  },
});
