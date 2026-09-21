import { Memory } from '../core/memory.model';
import { yearOf } from '../core/year-theme';

/** Nombre d'emplacements sur une page de souvenirs (deux colonnes, deux rangées). */
export const SLOTS_PER_PAGE = 4;

/** Un emplacement de l'album : il porte le numéro du souvenir, le même que sur sa carte. */
export interface AlbumSlot {
  number: number;
  memory: Memory;
}

/**
 * Une « face » du livre, c'est-à-dire une page vue d'un seul côté. Une feuille en compte deux (recto, verso).
 * `index` est sa place dans le livre, en partant de 0 (la couverture).
 */
type SideContent =
  | { kind: 'cover' }
  | { kind: 'intro' }
  // `year` : l'année de la page (`null` : souvenirs sans année) ; `part` / `parts` : une année de plus de quatre souvenirs
  // occupe plusieurs pages.
  | { kind: 'stickers'; year: number | null; part: number; parts: number; slots: AlbumSlot[] }
  | { kind: 'end' }
  | { kind: 'back' };

export type AlbumSide = { index: number } & SideContent;

export type StickerSide = Extract<AlbumSide, { kind: 'stickers' }>;

/**
 * Toutes les faces du livre, dans l'ordre : couverture, page d'accueil, pages de souvenirs, (une page « à suivre » si
 * besoin), quatrième de couverture. Leur nombre est toujours pair, pour que chaque feuille ait ses deux faces.
 *
 * Les souvenirs sont classés par année (les plus anciennes d'abord, ceux sans année à la fin), puis par date. Chaque année
 * a sa page, ou ses pages si elle compte plus de quatre souvenirs. Un souvenir garde son numéro d'origine (sa place dans
 * le JSON, le même que sur sa carte), même si le classement change l'ordre d'affichage.
 */
export function buildSides(memories: readonly Memory[]): AlbumSide[] {
  const sides: SideContent[] = [{ kind: 'cover' }, { kind: 'intro' }];

  const entries = memories
    .map((memory, i) => ({ memory, number: i + 1, year: yearOf(memory.date) }))
    .sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity) || (a.memory.date ?? '').localeCompare(b.memory.date ?? '') || a.number - b.number);

  for (let start = 0; start < entries.length; ) {
    const { year } = entries[start];
    let end = start;
    while (end < entries.length && entries[end].year === year) end++;

    const group = entries.slice(start, end);
    const parts = Math.ceil(group.length / SLOTS_PER_PAGE);
    for (let part = 0; part < parts; part++) {
      const slots = group.slice(part * SLOTS_PER_PAGE, (part + 1) * SLOTS_PER_PAGE).map(({ memory, number }) => ({ number, memory }));
      sides.push({ kind: 'stickers', year, part: part + 1, parts, slots });
    }
    start = end;
  }

  // La quatrième de couverture doit tomber sur un verso : on comble si la dernière face est un recto.
  if (sides.length % 2 === 0) sides.push({ kind: 'end' });
  sides.push({ kind: 'back' });

  return sides.map((side, index) => ({ ...side, index }));
}

/** Un tour de page en cours : sens (1 = vers l'avant) et face affichée avant le tour. */
export interface Turn {
  dir: 1 | -1;
  from: number;
}

/** Ce qu'il faut afficher : les deux pages posées, et la feuille qui se tourne si un tour est en cours. */
export interface AlbumView {
  left: AlbumSide | null;
  right: AlbumSide | null;
  leaf: { front: AlbumSide | null; back: AlbumSide | null; dir: 1 | -1 } | null;
}

/**
 * Le livre s'affiche en double page (grand écran) ou une page à la fois (`compact`, téléphone). Dans les deux cas on
 * retient une face « courante » : en double page, la double page est celle qui la contient (0 : couverture seule ;
 * la face 2k−1 est à gauche, la face 2k à droite).
 */
export function spreadOf(side: number): number {
  return Math.ceil(side / 2);
}

/** Face courante après avoir tourné la page dans un sens (inchangée si on est au bout du livre). */
export function nextSide(count: number, side: number, dir: 1 | -1, compact: boolean): number {
  if (compact) return Math.max(0, Math.min(count - 1, side + dir));
  const spread = Math.max(0, Math.min(count / 2, spreadOf(side) + dir));
  return spread === 0 ? 0 : Math.min(count - 1, 2 * spread);
}

/**
 * Compose l'affichage. Pendant un tour, les pages posées montrent déjà ce qui apparaît sous la feuille, sauf celle qui
 * va être recouverte à l'arrivée de la feuille : elle garde l'ancien contenu jusqu'à la fin du tour.
 */
export function viewOf(sides: readonly AlbumSide[], side: number, compact: boolean, turn: Turn | null): AlbumView {
  const at = (index: number) => sides[index] ?? null;

  if (compact) {
    if (!turn) return { left: null, right: at(side), leaf: null };
    return turn.dir === 1
      ? { left: null, right: at(side), leaf: { front: at(turn.from), back: null, dir: 1 } }
      : { left: null, right: at(turn.from), leaf: { front: at(side), back: null, dir: -1 } };
  }

  const spread = spreadOf(side);
  if (!turn) return { left: at(2 * spread - 1), right: at(2 * spread), leaf: null };

  const previous = spreadOf(turn.from);
  return turn.dir === 1
    ? // La feuille de la double page précédente part de la droite ; à gauche, l'ancienne page reste visible dessous.
      { left: at(2 * previous - 1), right: at(2 * spread), leaf: { front: at(2 * previous), back: at(2 * previous + 1), dir: 1 } }
    : // La feuille revient de la gauche ; à droite, l'ancienne page reste visible dessous.
      { left: at(2 * spread - 1), right: at(2 * previous), leaf: { front: at(2 * spread), back: at(2 * spread + 1), dir: -1 } };
}
