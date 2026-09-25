import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { LocalMemories } from './local-memories';
import { Memory, parseMemories } from './memory.model';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** Un souvenir à ajouter : l'identifiant est donné par le store, et le neurone est placé automatiquement. */
export type NewMemory = Omit<Memory, 'id' | 'position'>;

/** Clé du `localStorage` où sont gardés les identifiants des souvenirs déjà ouverts. */
const DISCOVERED_KEY = 'brain.discovered';
/** Clé du `localStorage` qui retient si la modale « album débloqué » a déjà été montrée. */
const ALBUM_UNLOCK_SEEN_KEY = 'brain.albumUnlockSeen';
/** Nombre de cartes à gratter avant de proposer l'album, la première fois. */
export const ALBUM_UNLOCK_THRESHOLD = 5;

@Injectable({ providedIn: 'root' })
export class MemoryStore {
  private readonly http = inject(HttpClient);
  private readonly local = inject(LocalMemories);

  readonly memories = signal<Memory[]>([]);
  readonly status = signal<LoadStatus>('loading');
  readonly selectedId = signal<string | null>(null);
  /** Identifiants des souvenirs déjà ouverts (connus), retenus d'une visite à l'autre. */
  readonly discoveredIds = signal<ReadonlySet<string>>(this.restoreDiscovered());
  /** Identifiants des souvenirs ajoutés depuis l'appli (versus ceux du JSON). */
  readonly localIds = signal<ReadonlySet<string>>(new Set());
  /** Vrai une fois que la modale « album débloqué » a été montrée (elle ne l'est qu'une fois). */
  readonly albumUnlockSeen = signal(this.restoreAlbumUnlockSeen());

  readonly selected = computed(() => this.memories().find((m) => m.id === this.selectedId()) ?? null);
  /** Position du souvenir sélectionné dans la liste (-1 si aucun). */
  readonly selectedIndex = computed(() => this.memories().findIndex((m) => m.id === this.selectedId()));

  /** Les souvenirs connus (déjà grattés), dans l'ordre du JSON. Les autres restent cachés (album, titre au survol). */
  readonly discovered = computed(() => this.memories().filter((m) => this.discoveredIds().has(m.id)));
  readonly total = computed(() => this.memories().length);
  readonly localCount = computed(() => this.localIds().size);

  constructor() {
    this.load();
  }

  load(url = 'data/memories.json') {
    this.status.set('loading');
    this.http.get<unknown>(url).subscribe({
      next: (raw) => {
        this.memories.set(parseMemories(raw));
        this.status.set('ready');
        void this.restoreLocal();
      },
      error: (err) => {
        console.error(`[memories] impossible de charger ${url}`, err);
        this.status.set('error');
      },
    });
  }

  /**
   * Ajoute un souvenir créé depuis l'appli : il est enregistré sur l'appareil, apparaît à la fin de la liste et est déjà
   * connu (son auteur n'a pas à le gratter). Échoue si le stockage est indisponible ou plein.
   */
  async add(draft: NewMemory): Promise<Memory> {
    const memory: Memory = { ...draft, id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
    await this.local.add(memory);

    this.memories.update((list) => [...list, memory]);
    this.localIds.update((ids) => new Set(ids).add(memory.id));
    this.reveal(memory.id);
    return memory;
  }

  /** Supprime tous les souvenirs ajoutés depuis l'appli (ceux du JSON restent). */
  async clearLocal(): Promise<void> {
    await this.local.clear();

    const ids = this.localIds();
    if (this.selectedId() && ids.has(this.selectedId()!)) this.select(null);
    this.memories.update((list) => list.filter((memory) => !ids.has(memory.id)));
    this.localIds.set(new Set());
  }

  /** Vrai si le souvenir a déjà été ouvert. Réactif : utilisable dans un template. */
  isDiscovered(id: string | null | undefined): boolean {
    return !!id && this.discoveredIds().has(id);
  }

  /**
   * Ouvre un souvenir (ou n'en ouvre aucun avec `null`). Ouvrir un souvenir inconnu ne le rend pas connu :
   * sa carte s'affiche recouverte, et il faut la gratter pour le découvrir (voir `reveal`).
   */
  select(id: string | null) {
    this.selectedId.set(id);
  }

  /** Rend un souvenir connu, définitivement (appelé quand sa carte a été suffisamment grattée). */
  reveal(id: string) {
    if (this.discoveredIds().has(id) || !this.memories().some((m) => m.id === id)) return;

    const next = new Set(this.discoveredIds());
    next.add(id);
    this.discoveredIds.set(next);
    try {
      localStorage.setItem(DISCOVERED_KEY, JSON.stringify([...next]));
    } catch {
      // Stockage indisponible (navigation privée, données bloquées) : la progression vaut pour cette session seulement.
    }
  }

  /** Retient que la modale « album débloqué » a été montrée : elle ne réapparaîtra pas aux visites suivantes. */
  markAlbumUnlockSeen() {
    this.albumUnlockSeen.set(true);
    try {
      // `localStorage` ne stocke que du texte : 'true', pas le booléen lui-même, ni un nombre qu'on pourrait
      // confondre avec ALBUM_UNLOCK_THRESHOLD (c'est cette confusion qui avait cassé la comparaison).
      localStorage.setItem(ALBUM_UNLOCK_SEEN_KEY, 'true');
    } catch {
      // Stockage indisponible : la modale pourra réapparaître à la prochaine visite, sans conséquence grave.
    }
  }

  /** Ajoute, après ceux du JSON, les souvenirs enregistrés sur l'appareil lors d'une visite précédente. */
  private async restoreLocal() {
    const saved = await this.local.list();
    if (!saved.length) return;

    const known = new Set(this.memories().map((memory) => memory.id));
    const fresh = saved.filter((memory) => !known.has(memory.id));
    this.memories.update((list) => [...list, ...fresh]);
    this.localIds.set(new Set(fresh.map((memory) => memory.id)));
  }

  private restoreDiscovered(): ReadonlySet<string> {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(DISCOVERED_KEY) ?? '[]');
      return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private restoreAlbumUnlockSeen(): boolean {
    try {
      return localStorage.getItem(ALBUM_UNLOCK_SEEN_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
