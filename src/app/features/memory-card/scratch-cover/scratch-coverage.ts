/**
 * Part (entre 0 et 1) d'une image devenue transparente, d'après son canal alpha. `rgba` est le contenu d'un
 * `ImageData` : quatre valeurs par pixel, l'alpha étant la quatrième. Sert à savoir quelle proportion de la pellicule
 * a été grattée.
 */
export function transparentFraction(rgba: ArrayLike<number>): number {
  const pixels = rgba.length / 4;
  if (!pixels) return 0;

  let transparent = 0;
  for (let i = 3; i < rgba.length; i += 4) transparent += 255 - rgba[i];
  return transparent / (255 * pixels);
}
