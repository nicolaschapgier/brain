/**
 * Les annonceurs du stade, en clin d'œil aux panneaux publicitaires d'époque. Chacun s'affiche par son logo, posé
 * directement sur la page (sans cadre) ; sans logo, ou si l'image ne se charge pas, par son nom en lettres.
 * Pour en ajouter, en retirer ou les réordonner, il suffit de modifier la liste ci-dessous.
 */
export interface Sponsor {
  name: string;
  /** Chemin du logo, relatif à `public/` (ex. `sponsors/leclerc.svg`). */
  logo?: string;
}

/**
 * Pitch et Fenioux viennent de tes souvenirs. Le reste vient de la page Wikipédia de la Berrichonne (section
 * « Sponsors et équipementiers ») : Le Seyec (partenaire de 1987 à 2013, sponsor maillot principal), La Halle aux
 * vêtements (années 2000), RTL (1976-77) et le Conseil général de l'Indre (nom d'une tribune). Les logos sont dans
 * `public/sponsors/`.
 */
export const SPONSORS: readonly Sponsor[] = [
  { name: 'Pitch', logo: 'sponsors/Logo_Pitch_brioche_Pasquier.png' },
  { name: 'Fenioux', logo: 'sponsors/fenioux.svg' },
  { name: 'Le Seyec', logo: 'sponsors/le-seyec.svg' },
  { name: 'La Halle', logo: 'sponsors/la-halle.svg' },
  { name: 'RTL', logo: 'sponsors/RTL_logo.svg.webp' },
  { name: "Conseil général de l'Indre", logo: 'sponsors/conseil_general.png' },
];

export interface Board {
  name: string;
  logo?: string;
}

/** Tous les annonceurs, dans l'ordre. */
export function allBoards(sponsors: readonly Sponsor[] = SPONSORS): Board[] {
  return sponsors.map(({ name, logo }) => ({ name, logo }));
}

/**
 * `count` annonceurs qui se suivent à partir d'un point de départ, en reprenant au début de la liste : chaque page
 * en montre d'autres que la précédente, comme le tour des panneaux d'un stade.
 */
export function boardsFrom(start: number, count: number, sponsors: readonly Sponsor[] = SPONSORS): Board[] {
  const boards = allBoards(sponsors);
  if (!boards.length) return [];
  return Array.from({ length: Math.min(count, boards.length) }, (_, i) => boards[(((start + i) % boards.length) + boards.length) % boards.length]);
}
