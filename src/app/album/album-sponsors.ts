/**
 * Les panneaux publicitaires du stade, en clin d'œil aux annonceurs d'époque. Ce sont de simples noms, écrits dans le
 * style de l'album : aucun logo. Pour en ajouter, en retirer ou les réordonner, il suffit de modifier cette liste.
 * `tone` force la couleur du panneau ; sans lui, elles alternent bleu, rouge, blanc.
 */
export interface Sponsor {
  name: string;
  tone?: 'blue' | 'red' | 'white';
}

export const SPONSORS: readonly Sponsor[] = [
  { name: 'Pitch' },
  { name: 'Fenioux' },
  { name: 'Le Seyec' },
  { name: 'La Halle' },
  { name: 'E.Leclerc' },
];

const TONES = ['blue', 'red', 'white'] as const;

export interface Board {
  name: string;
  tone: 'blue' | 'red' | 'white';
}

/** Panneau d'un annonceur, avec sa couleur (imposée ou alternée selon sa place dans la liste). */
function boardOf(sponsor: Sponsor, position: number): Board {
  return { name: sponsor.name, tone: sponsor.tone ?? TONES[position % TONES.length] };
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
