import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocalMemories } from '@core/local-memories';
import { Memory } from '@core/memory.model';
import { MemoryStore } from '@core/memory.store';

const MEMORIES = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: `Souvenir ${id}`, description: '', image: '' }));

/** Stockage en mémoire : l'environnement de test n'a pas toujours de `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

/** Stockage des souvenirs ajoutés, en mémoire : l'environnement de test n'a pas d'IndexedDB. */
function fakeLocal(saved: Memory[] = []) {
  return {
    list: vi.fn().mockResolvedValue(saved),
    add: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

/** Crée un store neuf (comme au chargement de la page) et lui fait « recevoir » le JSON des souvenirs. */
function createStore(local = fakeLocal()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalMemories, useValue: local }],
  });
  const store = TestBed.inject(MemoryStore);
  TestBed.inject(HttpTestingController).expectOne('data/memories.json').flush(MEMORIES);
  return store;
}

describe('MemoryStore : souvenirs connus et inconnus', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('au départ, aucun souvenir n’est connu', () => {
    const store = createStore();
    expect(store.total()).toBe(4);
    expect(store.discovered()).toEqual([]);
    expect(store.isDiscovered('a')).toBe(false);
  });

  it('ouvrir une carte ne suffit pas : elle reste inconnue tant qu’elle n’est pas grattée', () => {
    const store = createStore();
    store.select('b');
    expect(store.selectedId()).toBe('b');
    expect(store.isDiscovered('b')).toBe(false);
    expect(store.discovered()).toEqual([]);
  });

  it('gratter une carte (reveal) la rend connue', () => {
    const store = createStore();
    store.reveal('b');
    expect(store.isDiscovered('b')).toBe(true);
    expect(store.isDiscovered('a')).toBe(false);
    expect(store.discovered().map((m) => m.id)).toEqual(['b']);
  });

  it('garde les souvenirs connus dans l’ordre du JSON, pas dans l’ordre des grattages', () => {
    const store = createStore();
    store.reveal('c');
    store.reveal('a');
    expect(store.discovered().map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('ne rend rien connu pour un identifiant inexistant, et reveal deux fois ne change rien', () => {
    const store = createStore();
    store.reveal('n-existe-pas');
    expect(store.discovered()).toEqual([]);

    store.reveal('a');
    store.reveal('a');
    expect(store.discovered().map((m) => m.id)).toEqual(['a']);
  });

  it('retient la progression d’une visite à l’autre', () => {
    createStore().reveal('a');
    createStore().reveal('d');

    const store = createStore();
    expect(store.discovered().map((m) => m.id)).toEqual(['a', 'd']);
  });

  it('ignore un contenu illisible ou invalide dans le stockage', () => {
    vi.stubGlobal('localStorage', memoryStorage({ 'brain.discovered': '{pas du json' }));
    expect(createStore().discovered()).toEqual([]);

    vi.stubGlobal('localStorage', memoryStorage({ 'brain.discovered': '["a", 3, null, {"x":1}]' }));
    expect(createStore().discovered().map((m) => m.id)).toEqual(['a']);

    vi.stubGlobal('localStorage', memoryStorage({ 'brain.discovered': '"a"' }));
    expect(createStore().discovered()).toEqual([]);
  });

  it('fonctionne quand le stockage du navigateur est bloqué', () => {
    const blocked = () => {
      throw new Error('bloqué');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });

    const store = createStore();
    expect(() => store.reveal('a')).not.toThrow();
    expect(store.isDiscovered('a')).toBe(true); // valable pour cette session
  });
});

describe('MemoryStore : souvenirs ajoutés depuis l’appli', () => {
  const draft = { title: 'Nouveau', description: 'Ajouté', image: 'data:image/jpeg;base64,AAAA', date: '2024-05-01', focus: [50, 20] as const };

  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('ajoute le souvenir à la fin, le garde sur l’appareil et le rend déjà connu', async () => {
    const local = fakeLocal();
    const store = createStore(local);

    const memory = await store.add(draft);

    expect(memory.id).toMatch(/^user-/);
    expect(store.total()).toBe(5);
    expect(store.memories().at(-1)).toEqual(memory);
    expect(local.add).toHaveBeenCalledWith(memory);
    expect(store.isDiscovered(memory.id)).toBe(true);
    expect(store.localCount()).toBe(1);
  });

  it('donne un identifiant différent à chaque souvenir', async () => {
    const store = createStore();
    const [a, b] = [await store.add(draft), await store.add(draft)];
    expect(a.id).not.toBe(b.id);
  });

  it('n’ajoute rien quand l’enregistrement échoue, et le dit', async () => {
    const local = fakeLocal();
    local.add.mockRejectedValue(new Error('quota'));
    const store = createStore(local);

    await expect(store.add(draft)).rejects.toThrow('quota');
    expect(store.total()).toBe(4);
    expect(store.localCount()).toBe(0);
  });

  it('retrouve, après ceux du JSON, les souvenirs enregistrés lors d’une visite précédente', async () => {
    const saved: Memory = { id: 'user-old', title: 'Ancien', description: '', image: '' };
    const store = createStore(fakeLocal([saved]));

    await vi.waitFor(() => expect(store.total()).toBe(5));
    expect(store.memories().at(-1)?.id).toBe('user-old');
    expect(store.localCount()).toBe(1);
  });

  it('supprime seulement les souvenirs ajoutés, et referme celui qui est ouvert', async () => {
    const local = fakeLocal();
    const store = createStore(local);
    const memory = await store.add(draft);
    store.select(memory.id);

    await store.clearLocal();

    expect(local.clear).toHaveBeenCalled();
    expect(store.total()).toBe(4);
    expect(store.localCount()).toBe(0);
    expect(store.selectedId()).toBeNull();
  });
});
