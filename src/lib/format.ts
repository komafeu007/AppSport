/**
 * Formatage d'affichage partagé (poids, durées, dates).
 * Helpers purement présentationnels, sans dépendance à React ni à la base.
 */

/** 1250 → « 1 250 kg ». */
export function formatKg(value: number): string {
  return `${formatNumber(value)} kg`;
}

/** 1250 → « 1 250 » (séparateur de milliers, sans unité). */
export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Durée compacte : 2280 s → « 38:00 » ; au-delà d'une heure → « 1h05 ». */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Date ISO → « 17/10 » (ou « 17/10/25 » avec `withYear`). */
export function formatShortDate(iso: string, withYear = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (!withYear) return `${day}/${month}`;
  return `${day}/${month}/${String(date.getFullYear()).slice(-2)}`;
}
