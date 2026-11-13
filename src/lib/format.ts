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

/**
 * Durée compacte (§6.4) : 2280 s → « 38:00 » (mm:ss) ; au-delà d'une heure,
 * « 1 h 05 » (espaces insécables, pour que l'heure ne se coupe pas en fin de ligne).
 */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}\u00a0h\u00a0${String(minutes).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/*
 * Noms écrits en dur plutôt que `toLocaleDateString` : le moteur JS (Hermes)
 * n'embarque pas toujours les données de langue, et la DA veut ce format exact.
 */
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

function parseDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Date en toutes lettres, sans zéro initial (§6.4) : « mardi 20 octobre ».
 * L'année n'apparaît que si elle diffère de l'année en cours.
 */
export function formatLongDate(value: string | Date): string {
  const date = parseDate(value);
  if (date === null) return '—';
  const base = `${WEEKDAYS[date.getDay()]} ${date.getDate()}\u00a0${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/** Date courte pour un axe de graphique : « 20 oct. » (sans zéro initial). */
export function formatShortDate(value: string | Date): string {
  const date = parseDate(value);
  if (date === null) return '—';
  return `${date.getDate()}\u00a0${MONTHS_SHORT[date.getMonth()]}`;
}

/** Lundi 0 h de la semaine de `now` (la semaine commence le lundi en France). */
export function startOfWeek(now = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Date technique de la DA « Terminal » : « 07.11 » (jour.mois). */
export function formatDotDate(value: string | Date): string {
  const date = parseDate(value);
  if (date === null) return '—';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

/** Date technique avec l'année : « 09.11.26 ». */
export function formatDotDateYear(value: string | Date): string {
  const date = parseDate(value);
  if (date === null) return '—';
  return `${formatDotDate(date)}.${pad2(date.getFullYear() % 100)}`;
}

/** Jour de la semaine abrégé en capitales : « LUN ». */
export function formatWeekdayShort(value: string | Date): string {
  const date = parseDate(value);
  if (date === null) return '—';
  return WEEKDAYS[date.getDay()].slice(0, 3).toUpperCase();
}

/** Numéro de semaine ISO 8601 (« SEM. 46 »). */
export function isoWeekNumber(value: string | Date = new Date()): number {
  const date = parseDate(value) ?? new Date();
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Index de référence à largeur fixe : padIndex(3) → « 03 », padIndex(9, 3) → « 009 ». */
export function padIndex(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** Mois et année en toutes lettres : « novembre 2026 ». */
export function formatMonthYear(value: string | Date): string {
  const date = parseDate(value);
  if (date === null) return '—';
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Clé de jour locale « 2026-11-13 » (regroupement par jour calendaire). */
export function dayKey(value: string | Date): string {
  const date = parseDate(value);
  if (date === null) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
