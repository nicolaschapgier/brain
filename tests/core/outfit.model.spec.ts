import { parseOutfits } from '@core/outfit.model';

describe('parseOutfits', () => {
  it('accepte un tableau ou un objet { outfits }', () => {
    const entry = { title: 'Maillot orange', description: 'Le premier', image: 'a.jpg' };
    expect(parseOutfits([entry])).toHaveLength(1);
    expect(parseOutfits({ outfits: [entry] })).toHaveLength(1);
  });

  it('ignore les entrées sans titre et les données invalides', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseOutfits([{ description: 'sans titre' }, null, { title: 'OK' }])).toHaveLength(1);
    expect(parseOutfits('nimporte quoi')).toEqual([]);
    expect(parseOutfits(null)).toEqual([]);
  });

  it('génère des identifiants uniques quand ils manquent ou sont dupliqués', () => {
    const ids = parseOutfits([{ title: 'A', id: 'x' }, { title: 'B', id: 'x' }, { title: 'C' }]).map((o) => o.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('garde la date quand elle est fournie, et la laisse absente sinon', () => {
    const [dated, undated] = parseOutfits([
      { title: 'Avec date', date: '2021' },
      { title: 'Sans date' },
    ]);
    expect(dated.date).toBe('2021');
    expect(undated.date).toBeUndefined();
  });
});
