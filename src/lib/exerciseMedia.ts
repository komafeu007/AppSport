/**
 * Médias du catalogue d'exercices.
 *
 * Les vignettes 180×180 sont embarquées dans `assets/exercises/` (~12 Mo) et
 * s'affichent hors-ligne. Les démonstrations animées (GIF, ~120 Mo au total) ne
 * sont **pas** embarquées : elles sont chargées à la demande depuis le CDN du
 * dataset (hasaneyldrm/exercises-dataset, médias © Gym visual). Sans réseau, la
 * vignette statique prend le relais.
 */

const GIF_BASES = [
  'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos',
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos',
] as const;

/**
 * URLs des GIF de démonstration d'un exercice, dans l'ordre de tentative
 * (CDN principal puis GitHub en secours). La clé `image` du catalogue est un
 * nom de fichier (ex. « 0001-2gPfomN.jpg ») ; le GIF porte le même radical.
 */
export function exerciseGifUrls(image: string | null | undefined): string[] {
  if (!image) return [];
  const base = image.replace(/\.[^./]+$/, '');
  if (!base) return [];
  return GIF_BASES.map((url) => `${url}/${base}.gif`);
}
