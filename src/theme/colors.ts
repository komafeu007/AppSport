/**
 * Palette officielle — direction artistique « Terminal » (refonte Arny,
 * docs/DA_Arny_Terminal.md, maquette « Arny — Refonte design-selection »).
 *
 * Concept : un poste de commande technique. Fond quasi noir, encre crème,
 * **un seul orange** pour l'action, un kaki pour les statuts validés et un
 * jaune réservé aux records. Ce fichier ne contient que les couleurs brutes ;
 * les rôles (fond, surface, action, marqueur…) sont exposés par `theme.tsx`.
 */
export const palette = {
  /** Fond d'écran — noir graphite. */
  graphite: '#121211',
  /** Surface surélevée : carte, champ, feuille. */
  carbone: '#1B1C1A',
  /** Surface secondaire : champ, bouton pressé, rangée pressée. */
  acier: '#242522',
  /** Filets décoratifs (1 px, souvent en pointillés). */
  filet: '#2F302C',
  /** Bordure des contrôles : boutons d'icône, cases, champs. */
  filetControle: '#55554E',
  /** Encre principale — crème. */
  creme: '#E8E4D8',
  /** Encre secondaire — libellés mono, mentions. */
  cendre: '#8F8C82',
  /** Orange signal — action principale, rubriques, onglet actif. */
  orange: '#FF5A1F',
  /** Orange appuyé. */
  orangeAppui: '#E04A12',
  /** Kaki — statut validé, protocole, étiquette « poly ». */
  kaki: '#BDB58A',
  /** Jaune record — records battus, « ce qui se passe maintenant ». */
  jauneRecord: '#F5C400',
  /** Rouge alerte — suppression, erreur. */
  rouge: '#E5484D',
} as const;

/**
 * Séries d'un graphique catégoriel (une couleur par muscle). L'orange ouvre la
 * série, les autres teintes restent distinctes sur le fond graphite.
 */
export const chartSeries = [
  palette.orange,
  palette.creme,
  palette.kaki,
  palette.jauneRecord,
  palette.cendre,
  '#C2410C',
  '#6B6A62',
  '#A39E86',
] as const;

/** Rampe des zones d'effort, Z1 → Z5 (du gris vers l'orange). */
export const zones = ['#3A3A35', '#6B6A62', '#A39E86', '#FF8A5C', palette.orange] as const;
