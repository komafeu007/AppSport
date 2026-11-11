import { useEffect, useRef, useState } from 'react';
import { Easing, Text, type StyleProp, type TextStyle } from 'react-native';

import { useReduceMotion } from '../../theme/motion';
import { MAX_FONT_SCALE, duration } from '../../theme/tokens';

interface Props {
  value: number;
  /** Formate la valeur affichée (elle reçoit un nombre encore fractionnaire). */
  format: (value: number) => string;
  /** Durée de la montée, en ms. */
  durationMs?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Compteur qui **monte de 0 à sa valeur** au premier affichage — les trois
 * chiffres du récapitulatif de fin de séance. La montée est pilotée par
 * `requestAnimationFrame` et ne redessine que du texte : inutile de faire
 * transiter chaque image par le fil natif pour un nombre qui change.
 */
export default function CountUp({ value, format, durationMs = duration.slow * 2, style }: Props) {
  const reduceMotion = useReduceMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  /** Valeur d'où part la prochaine montée (la précédente est déjà affichée). */
  const from = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    // Mouvement réduit : le chiffre est là tout de suite, sans course.
    if (reduceMotion) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const start = from.current;
    let frame = 0;
    const startedAt = Date.now();

    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      const eased = Easing.out(Easing.cubic)(progress);
      setDisplay(start + (value - start) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      from.current = value;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, reduceMotion, value]);

  return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={style}>{format(display)}</Text>;
}
