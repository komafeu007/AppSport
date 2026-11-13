import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IconButton from '../components/ui/IconButton';
import { useThemedStyles, type Theme } from '../theme';
import { scale, MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

/**
 * En-tête des écrans poussés, DA « Terminal » : bouton retour carré à gauche,
 * intitulé mono centré (« RAPPORT DE SÉANCE »), filet dessous. Le grand titre
 * de l'écran, lui, est porté par le contenu (`ScreenHeader`).
 */
export default function TerminalStackHeader({ navigation, options, back, route }: NativeStackHeaderProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : route.name;
  const canGoBack = Boolean(back) && options.headerBackVisible !== false;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {canGoBack ? (
            <IconButton
              icon="arrowLeft"
              size={scale(48)}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Retour"
            />
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <View style={[styles.side, styles.sideRight]}>
          {options.headerRight ? options.headerRight({ canGoBack }) : null}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.xl,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: scale(64),
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderStrong,
    },
    side: {
      width: scale(64),
      justifyContent: 'center',
    },
    sideRight: {
      alignItems: 'flex-end',
    },
    title: {
      ...text.caption,
      flex: 1,
      textAlign: 'center',
      color: theme.colors.textMuted,
    },
  });
