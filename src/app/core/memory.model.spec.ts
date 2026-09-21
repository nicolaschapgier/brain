import { DEFAULT_FOCUS, objectPositionOf, parseMemories } from './memory.model';

describe('parseMemories', () => {
  it('accepte un tableau ou un objet { memories }', () => {
    const entry = { title: 'Ski', description: 'Neige', image: 'a.jpg' };
    expect(parseMemories([entry])).toHaveLength(1);
    expect(parseMemories({ memories: [entry] })).toHaveLength(1);
  });

  it('ignore les entrées sans titre et les données invalides', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseMemories([{ description: 'sans titre' }, null, { title: 'OK' }])).toHaveLength(1);
    expect(parseMemories('nimporte quoi')).toEqual([]);
    expect(parseMemories(null)).toEqual([]);
  });

  it('génère des identifiants uniques quand ils manquent ou sont dupliqués', () => {
    const ids = parseMemories([{ title: 'A', id: 'x' }, { title: 'B', id: 'x' }, { title: 'C' }]).map((m) => m.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('valide et borne la position', () => {
    const [ok, clamped, wrongLength, notNumbers] = parseMemories([
      { title: 'a', position: [0.5, -0.2, 0.9] },
      { title: 'b', position: [5, -5, 0] },
      { title: 'c', position: [1, 2] },
      { title: 'd', position: ['x', 0, 0] },
    ]);
    expect(ok.position).toEqual([0.5, -0.2, 0.9]);
    expect(clamped.position).toEqual([1, -1, 0]);
    expect(wrongLength.position).toBeUndefined();
    expect(notNumbers.position).toBeUndefined();
  });

  it('valide et borne le cadrage de la photo', () => {
    const [ok, clamped, wrongLength, notNumbers, missing] = parseMemories([
      { title: 'a', focus: [20, 70] },
      { title: 'b', focus: [-10, 250] },
      { title: 'c', focus: [50] },
      { title: 'd', focus: ['x', 10] },
      { title: 'e' },
    ]);
    expect(ok.focus).toEqual([20, 70]);
    expect(clamped.focus).toEqual([0, 100]);
    expect(wrongLength.focus).toBeUndefined();
    expect(notNumbers.focus).toBeUndefined();
    expect(missing.focus).toBeUndefined();
  });
});

describe('objectPositionOf', () => {
  it('utilise le cadrage du souvenir', () => {
    expect(objectPositionOf({ focus: [20, 70] })).toBe('20% 70%');
  });

  it('retombe sur le cadrage par défaut sans point de cadrage', () => {
    expect(objectPositionOf({})).toBe(`${DEFAULT_FOCUS[0]}% ${DEFAULT_FOCUS[1]}%`);
  });
});
