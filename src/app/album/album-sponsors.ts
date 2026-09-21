/**
 * Les panneaux publicitaires du stade, en clin d'œil aux annonceurs d'époque. Ce sont de simples noms, écrits dans le
 * style de l'album. Pour en ajouter, en retirer ou les réordonner, il suffit de modifier cette liste.
 * `tone` force la couleur du panneau ; sans lui, elles alternent bleu, rouge, blanc (et un logo est posé sur du blanc).
 */
export interface Sponsor {
  name: string;
  /** Chemin du logo, relatif à `public/` (ex. `sponsors/leclerc.svg`). Sans logo, le panneau affiche le nom. */
  logo?: string;
  tone?: 'blue' | 'red' | 'white';
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
  // Logo blanc (détouré d'une photo du maillot) : il lui faut une plaque bleue.
  { name: 'Le Seyec', logo: 'sponsors/le-seyec.png', tone: 'blue' },
  { name: 'La Halle', logo: 'sponsors/la-halle.png' },
  // Sponsor maillot 2007-2009 (source : historique des maillots sur footballkitarchive.com). Pas encore de logo : le panneau
  // affiche le nom ; ajoute `logo: 'sponsors/triangle-interim.png'` une fois le fichier déposé dans `public/sponsors/`.
  { name: 'Triangle Intérim' },
  { name: 'RTL', logo: 'sponsors/RTL_logo.svg.webp' },
  { name: "Conseil général de l'Indre", logo: 'sponsors/conseil_general.png' },
];

const TONES = ['blue', 'red', 'white'] as const;

export interface Board {
  name: string;
  logo?: string;
  tone: 'blue' | 'red' | 'white';
}

/** Panneau d'un annonceur, avec sa couleur (imposée ou alternée selon sa place dans la liste). */
function boardOf(sponsor: Sponsor, position: number): Board {
  return { name: sponsor.name, logo: sponsor.logo, tone: sponsor.tone ?? (sponsor.logo ? 'white' : TONES[position % TONES.length]) };
}

/** Tous les panneaux, dans l'ordre. */
export function allBoards(sponsors: readonly Sponsor[] = SPONSORS): Board[] {
  return sponsors.map(boardOf);
}

/**
 * `count` panneaux qui se suivent à partir d'un point de départ, en reprenant au début de la liste : chaque page en
 * montre d'autres que la précédente, comme le tour des panneaux d'un stade.
 */
export function boardsFrom(start: number, count: number, sponsors: readonly Sponsor[] = SPONSORS): Board[] {
  if (!sponsors.length) return [];
  const boards: Board[] = [];
  for (let i = 0; i < Math.min(count, sponsors.length); i++) {
    const position = (((start + i) % sponsors.length) + sponsors.length) % sponsors.length;
    boards.push(boardOf(sponsors[position], position));
  }
  return boards;
}
