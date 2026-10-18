import { useEffect, useState } from 'react';

import {
  clearWorkoutDraft,
  getWorkoutDraft,
  setWorkoutDraft,
  type WorkoutDraft,
} from './preferences';

/**
 * Séance en cours, tenue **en mémoire** pour toute l'app.
 *
 * L'écran de séance en cours écrit le brouillon ici à chaque changement, la
 * bulle de reprise le lit : les deux se voient donc sans dépendre du focus des
 * écrans. Le stockage (clé/valeur) n'est que le filet de sécurité, pour survivre
 * à la fermeture de l'app.
 */

let current: WorkoutDraft | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** S'abonne aux changements de la séance en cours (renvoie le désabonnement). */
export function subscribeActiveWorkout(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Séance en cours en mémoire (null = aucune). */
export function getActiveWorkout(): WorkoutDraft | null {
  return current;
}

/** Relit la séance en cours du compte (au démarrage, ou au changement de compte). */
export async function loadActiveWorkout(accountId: number): Promise<WorkoutDraft | null> {
  const draft = await getWorkoutDraft(accountId);
  current = draft;
  emit();
  return draft;
}

/** Met la séance en cours à jour (mémoire tout de suite, stockage dans la foulée). */
export async function saveActiveWorkout(accountId: number, draft: WorkoutDraft): Promise<void> {
  current = draft;
  emit();
  await setWorkoutDraft(accountId, draft);
}

/** Abandonne la séance en cours (elle ne sera pas reprenable). */
export async function abandonActiveWorkout(accountId: number): Promise<void> {
  current = null;
  emit();
  await clearWorkoutDraft(accountId);
}

/** Séance en cours, en réactif : se met à jour quand l'écran de séance la modifie. */
export function useActiveWorkout(): WorkoutDraft | null {
  const [draft, setDraft] = useState<WorkoutDraft | null>(current);
  useEffect(() => subscribeActiveWorkout(() => setDraft(current)), []);
  return draft;
}
