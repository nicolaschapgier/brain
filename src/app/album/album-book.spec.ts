import { Memory } from '../core/memory.model';
import { AlbumSide, buildSides, nextSide, spreadOf, viewOf } from './album-book';
import { allBoards, boardsFrom } from './album-sponsors';

const memories = (count: number): Memory[] =>
  Array.from({ length: count }, (_, i) => ({ id: `m${i + 1}`, title: `Souvenir ${i + 1}`, description: '', image: '' }));

const kinds = (sides: readonly AlbumSide[]) => sides.map((side) => side.kind);

describe('buildSides', () => {
  it('commence par la couverture et la page d’accueil, finit par la quatrième de couverture', () => {
    const sides = buildSides(memories(4));
    expect(kinds(sides)[0]).toBe('cover');
    expect(kinds(sides)[1]).toBe('intro');
    expect(kinds(sides).at(-1)).toBe('back');
  });

  it('range les souvenirs par quatre, numérotés dans l’ordre du JSON', () => {
    const pages = buildSides(memories(6)).filter((side) => side.kind === 'stickers');
    expect(pages.map((page) => page.slots.map((slot) => slot.number))).toEqual([[1, 2, 3, 4], [5, 6]]);
    expect(pages[1].slots[0].memory.id).toBe('m5');
  });

  it('a toujours un nombre pair de faces, pour n’importe quel nombre de souvenirs', () => {
    for (let count = 0; count <= 20; count++) {
      expect(buildSides(memories(count)).length % 2).toBe(0);
    }
  });

  it('comble avec une page « à suivre » quand il le faut, et pas sinon', () => {
    expect(kinds(buildSides(memories(4)))).toEqual(['cover', 'intro', 'stickers', 'back']);
    expect(kinds(buildSides(memories(8)))).toEqual(['cover', 'intro', 'stickers', 'stickers', 'end', 'back']);
    expect(kinds(buildSides(memories(0)))).toEqual(['cover', 'intro', 'end', 'back']);
  });

  it('numérote chaque face de 0 à n − 1', () => {
    expect(buildSides(memories(5)).map((side) => side.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('nextSide en double page', () => {
  // 6 faces : couverture | accueil-p1 | p2-fin | dos, soit 4 doubles pages (0 à 3 ; 3 = dos seul).
  const count = 6;

  it('la double page contient la face courante', () => {
    expect([0, 1, 2, 3, 4, 5].map(spreadOf)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('avance de double page en double page, jusqu’au dos', () => {
    let side = 0;
    const seen = [side];
    for (let i = 0; i < 5; i++) seen.push((side = nextSide(count, side, 1, false)));
    expect(seen).toEqual([0, 2, 4, 5, 5, 5]);
  });

  it('recule jusqu’à la couverture, depuis le dos comme depuis une face de droite', () => {
    expect(nextSide(count, 5, -1, false)).toBe(4);
    expect(nextSide(count, 4, -1, false)).toBe(2);
    expect(nextSide(count, 2, -1, false)).toBe(0);
    expect(nextSide(count, 0, -1, false)).toBe(0);
  });

  it('ne bouge pas quand on est au bout', () => {
    expect(nextSide(count, 5, 1, false)).toBe(5);
    expect(nextSide(count, 0, -1, false)).toBe(0);
  });
});

describe('nextSide en page seule', () => {
  it('avance d’une face à la fois, sans sortir du livre', () => {
    expect(nextSide(6, 0, 1, true)).toBe(1);
    expect(nextSide(6, 5, 1, true)).toBe(5);
    expect(nextSide(6, 0, -1, true)).toBe(0);
    expect(nextSide(6, 3, -1, true)).toBe(2);
  });
});

describe('viewOf', () => {
  const sides = buildSides(memories(8)); // couverture, accueil, p1, p2, à suivre, dos
  const indexes = (view: ReturnType<typeof viewOf>) => ({
    left: view.left?.index ?? null,
    right: view.right?.index ?? null,
    leaf: view.leaf ? { front: view.leaf.front?.index ?? null, back: view.leaf.back?.index ?? null, dir: view.leaf.dir } : null,
  });

  it('montre la couverture seule, à droite, quand le livre est fermé', () => {
    expect(indexes(viewOf(sides, 0, false, null))).toEqual({ left: null, right: 0, leaf: null });
  });

  it('montre deux pages face à face', () => {
    expect(indexes(viewOf(sides, 2, false, null))).toEqual({ left: 1, right: 2, leaf: null });
    expect(indexes(viewOf(sides, 4, false, null))).toEqual({ left: 3, right: 4, leaf: null });
  });

  it('montre le dos seul, à gauche, à la dernière double page', () => {
    expect(indexes(viewOf(sides, 5, false, null))).toEqual({ left: 5, right: null, leaf: null });
  });

  it('pendant un tour vers l’avant, la feuille emporte l’ancienne page de droite et révèle la nouvelle à gauche', () => {
    // De la couverture à la double page accueil | p1.
    expect(indexes(viewOf(sides, 2, false, { dir: 1, from: 0 }))).toEqual({
      left: null,
      right: 2,
      leaf: { front: 0, back: 1, dir: 1 },
    });
    // De accueil | p1 à p2 | à suivre : l’ancienne page de gauche reste dessous.
    expect(indexes(viewOf(sides, 4, false, { dir: 1, from: 2 }))).toEqual({
      left: 1,
      right: 4,
      leaf: { front: 2, back: 3, dir: 1 },
    });
  });

  it('pendant un tour vers l’arrière, la feuille revient et recouvre l’ancienne page de droite', () => {
    // De p2 | à suivre à accueil | p1.
    expect(indexes(viewOf(sides, 2, false, { dir: -1, from: 4 }))).toEqual({
      left: 1,
      right: 4,
      leaf: { front: 2, back: 3, dir: -1 },
    });
  });

  it('en page seule, la feuille est la page qui part (ou qui revient), sans verso', () => {
    expect(indexes(viewOf(sides, 3, true, { dir: 1, from: 2 }))).toEqual({
      left: null,
      right: 3,
      leaf: { front: 2, back: null, dir: 1 },
    });
    expect(indexes(viewOf(sides, 2, true, { dir: -1, from: 3 }))).toEqual({
      left: null,
      right: 3,
      leaf: { front: 2, back: null, dir: -1 },
    });
  });

  it('ne plante pas quand la face demandée n’existe pas', () => {
    expect(indexes(viewOf(sides, 99, true, null))).toEqual({ left: null, right: null, leaf: null });
  });
});

describe('panneaux publicitaires', () => {
  const sponsors = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

  it('donne des panneaux qui se suivent, en reprenant au début de la liste', () => {
    expect(boardsFrom(3, 3, sponsors).map((b) => b.name)).toEqual(['D', 'A', 'B']);
  });

  it('ne répète pas un annonceur sur une même page, même si on en demande trop', () => {
    expect(boardsFrom(0, 10, sponsors).map((b) => b.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('transmet le logo de chaque annonceur, sans en inventer aux autres', () => {
    const list = [{ name: 'A', logo: 'sponsors/a.svg' }, { name: 'B' }];
    expect(allBoards(list)).toEqual([{ name: 'A', logo: 'sponsors/a.svg' }, { name: 'B', logo: undefined }]);
    expect(boardsFrom(1, 2, list).map((b) => b.logo)).toEqual([undefined, 'sponsors/a.svg']);
  });

  it('accepte une liste vide et un départ négatif', () => {
    expect(boardsFrom(0, 3, [])).toEqual([]);
    expect(boardsFrom(-1, 2, sponsors).map((b) => b.name)).toEqual(['D', 'A']);
  });
});
