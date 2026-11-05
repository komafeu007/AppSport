import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * « Réduire les animations » (réglage d'accessibilité du téléphone).
 *
 * Un seul écouteur pour toute l'app : les composants s'abonnent au magasin
 * ci-dessous au lieu d'ouvrir chacun leur écouteur natif. Quand le réglage est
 * actif, le mouvement décoratif disparaît mais **les changements d'état restent
 * visibles** (une feuille s'ouvre sans glisser, un compteur affiche sa valeur).
 */

let reduced = false;
let started = false;
const listeners = new Set<(value: boolean) => void>();

function publish(value: boolean) {
  if (value === reduced) return;
  reduced = value;
  listeners.forEach((listener) => listener(value));
}

function start() {
  if (started) return;
  started = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then(publish)
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
}

/** true quand le téléphone demande de réduire les animations. */
export function useReduceMotion(): boolean {
  const [value, setValue] = useState(reduced);

  useEffect(() => {
    start();
    listeners.add(setValue);
    setValue(reduced);
    return () => {
      listeners.delete(setValue);
    };
  }, []);

  return value;
}

/** Durée d'animation à utiliser : 0 quand le mouvement est réduit. */
export function useMotionDuration(ms: number): number {
  return useReduceMotion() ? 0 : ms;
}
