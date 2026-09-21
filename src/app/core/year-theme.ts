/**
 * Le vieillissement des cartes selon l'année : toutes gardent le thème Berry (azur, or, rouge), mais plus un souvenir
 * est ancien, plus sa carte a l'air vieille (dégradé chaud, grain de pellicule, teinte sépia, photo passée).
 *
 * L'intensité (`--retro`, de 0 à 1) se pose en variable CSS sur la carte, l'autocollant ou la modale ; les effets sont
 * dans `shared/styles/year-theme.scss`.
 */

export interface YearTheme {
  /** Intensité de l'effet rétro : 0 (récent, net) à 1 (le plus ancien). */
  retro: number;
  /** Variables CSS à poser sur l'élément à habiller (vide sans année : la carte reste neuve). */
  vars: Record<string, string>;
}

/** L'année la plus ancienne : intensité maximale. Les photos plus anciennes vieillissent autant. */
export const FIRST_YEAR = 2015;
/** L'année « neuve » : aucun effet, ni pour elle ni pour les suivantes. */
export const LAST_YEAR = 2026;

/** L'année d'une date libre (`2023-02-11`, `Été 2022`…), ou `null` si elle n'en contient pas. */
export function yearOf(date: string | undefined | null): number | null {
  const match = /\b(19|20)\d{2}\b/.exec(date ?? '');
  return match ? Number(match[0]) : null;
}

/** L'intensité rétro d'une année : 1 pour la plus ancienne, en baisse régulière, 0 pour la plus récente. */
export function retroOf(year: number): number {
  return Math.min(1, Math.max(0, (LAST_YEAR - year) / (LAST_YEAR - FIRST_YEAR)));
}

/** Le vieillissement d'une carte d'après l'année de son souvenir ; sans année, la carte reste neuve. */
export function themeFor(year: number | null): YearTheme {
  if (year === null) return { retro: 0, vars: {} };
  const retro = retroOf(year);
  return { retro, vars: { '--retro': String(retro) } };
}
