import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MemoryStore } from './memory.store';

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

/** Crée un store neuf (comme au chargement de la page) et lui fait « recevoir » le JSON des souvenirs. */
function createStore() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
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

  describe('flèches de la carte', () => {
    it('ne parcourent que les souvenirs connus', () => {
      const store = createStore();
      store.reveal('a');
      store.reveal('c');

      store.select('a');
      store.next();
      expect(store.selectedId()).toBe('c'); // saute b, encore inconnu
      store.next();
      expect(store.selectedId()).toBe('a'); // reboucle
      store.previous();
      expect(store.selectedId()).toBe('c');
    });

    it('ne révèlent jamais un souvenir inconnu', () => {
      const store = createStore();
      store.reveal('b');
      store.select('b');
      for (let i = 0; i < 6; i++) store.next();
      expect(store.discovered().map((m) => m.id)).toEqual(['b']);
      expect(store.isDiscovered('a')).toBe(false);
    });
  });
});
