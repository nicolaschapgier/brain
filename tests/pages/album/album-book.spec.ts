import { Memory } from '@core/memory.model';
import { AlbumSide, buildSides, nextSide, sideForPage, spreadOf, viewOf, visibleYears, yearEntries } from '@pages/album/album-book';
import { allBoards, boardsFrom } from '@pages/album/album-sponsors';

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

describe('buildSides : classement par année', () => {
  const dated = (dates: (string | undefined)[]): Memory[] =>
    dates.map((date, i) => ({ id: `m${i + 1}`, title: `Souvenir ${i + 1}`, description: '', image: '', date }));
  const pages = (list: Memory[]) => buildSides(list).filter((side) => side.kind === 'stickers');

  it('donne une page à chaque année, de la plus ancienne à la plus récente', () => {
    const result = pages(dated(['2019-06-01', '2015-02-07', '2017-07-16']));
    expect(result.map((page) => page.year)).toEqual([2015, 2017, 2019]);
  });

  it('garde à chaque souvenir son numéro d’origine, même quand le classement change l’ordre', () => {
    const result = pages(dated(['2019-06-01', '2015-02-07', '2019-01-10', '2017-07-16']));
    expect(result.map((page) => page.slots.map((slot) => slot.number))).toEqual([[2], [4], [3, 1]]);
  });

  it('classe par date à l’intérieur d’une année, puis dans l’ordre du JSON à date égale', () => {
    const result = pages(dated(['2020-09-01', '2020-02-01', '2020-02-01']));
    expect(result[0].slots.map((slot) => slot.memory.id)).toEqual(['m2', 'm3', 'm1']);
  });

  it('lit l’année dans un texte libre', () => {
    expect(pages(dated(['Été 2016', '2015-01-01'])).map((page) => page.year)).toEqual([2015, 2016]);
  });

  it('coupe une année de plus de quatre souvenirs en plusieurs pages, numérotées', () => {
    const result = pages(dated(Array(6).fill('2020-05-05')));
    expect(result.map((page) => [page.year, page.part, page.parts, page.slots.length])).toEqual([
      [2020, 1, 2, 4],
      [2020, 2, 2, 2],
    ]);
  });

  it('met à la fin les souvenirs sans année', () => {
    const result = pages(dated([undefined, '2018-03-03', 'Un soir d’été']));
    expect(result.map((page) => page.year)).toEqual([2018, null]);
    expect(result[1].slots.map((slot) => slot.number)).toEqual([1, 3]);
  });

  it('garde un nombre pair de faces, avec une page par année', () => {
    for (let years = 0; years <= 12; years++) {
      const list = dated(Array.from({ length: years }, (_, i) => `${2015 + i}-06-01`));
      const sides = buildSides(list);
      expect(sides.length % 2).toBe(0);
      expect(sides.filter((side) => side.kind === 'stickers').length).toBe(years);
    }
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

describe('raccourci vers une année', () => {
  const dated = (dates: (string | undefined)[]): Memory[] =>
    dates.map((date, i) => ({ id: `m${i + 1}`, title: `Souvenir ${i + 1}`, description: '', image: '', date }));

  // Pages : 0 couverture, 1 accueil, 2 « 2015 », 3 « 2016 », 4 « 2016 » (suite), 5 « Sans date », 6 « à suivre », 7 dos.
  const sides = buildSides(dated(['2015-03-01', '2016-01-01', '2016-02-01', '2016-03-01', '2016-04-01', '2016-05-01', undefined]));

  describe('yearEntries', () => {
    it('donne une entrée par année, avec sa première page et son nombre de souvenirs', () => {
      expect(yearEntries(sides)).toEqual([
        { year: 2015, page: 2, count: 1 },
        { year: 2016, page: 3, count: 5 },
        { year: null, page: 5, count: 1 },
      ]);
    });

    it('n’a aucune année quand il n’y a aucun souvenir', () => {
      expect(yearEntries(buildSides([]))).toEqual([]);
    });
  });

  describe('sideForPage', () => {
    it('en mode compact, la face est la page elle-même', () => {
      expect(sideForPage(sides.length, 3, true)).toBe(3);
    });

    it('en double page, la face est celle de droite de la double page qui contient la page', () => {
      expect(sideForPage(sides.length, 3, false)).toBe(4);
      expect(sideForPage(sides.length, 4, false)).toBe(4);
      expect(sideForPage(sides.length, 2, false)).toBe(2);
    });

    it('reste dans le livre', () => {
      expect(sideForPage(sides.length, 99, true)).toBe(sides.length - 1);
      expect(sideForPage(sides.length, 99, false)).toBe(sides.length - 1);
    });

    it('montre bien la page demandée', () => {
      const side = sideForPage(sides.length, 3, false);
      const view = viewOf(sides, side, false, null);
      expect([view.left?.index, view.right?.index]).toContain(3);
    });
  });

  describe('visibleYears', () => {
    it('en mode compact, seule l’année de la page affichée compte', () => {
      expect([...visibleYears(sides, 2, true)]).toEqual([2015]);
      expect([...visibleYears(sides, 0, true)]).toEqual([]);
    });

    it('en double page, les deux pages comptent : deux années peuvent être en vue', () => {
      // Face 2 : double page « accueil | 2015 ». Face 4 : « 2016 | 2016 (suite) » (une seule année, citée une fois).
      expect([...visibleYears(sides, 2, false)]).toEqual([2015]);
      expect([...visibleYears(sides, 4, false)]).toEqual([2016]);
    });

    it('ne compte ni la couverture, ni l’accueil, ni la page « à suivre »', () => {
      expect(visibleYears(sides, 0, false).size).toBe(0);
      expect(visibleYears(sides, sides.length - 1, false).size).toBe(0);
    });

    it('cite l’année « sans date » comme une année à part', () => {
      expect(visibleYears(sides, 5, true).has(null)).toBe(true);
    });
  });
});
