import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Memory, parseMemories } from './memory.model';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** Clé du `localStorage` où sont gardés les identifiants des souvenirs déjà ouverts. */
const DISCOVERED_KEY = 'brain.discovered';

@Injectable({ providedIn: 'root' })
export class MemoryStore {
  private readonly http = inject(HttpClient);

  readonly memories = signal<Memory[]>([]);
  readonly status = signal<LoadStatus>('loading');
  readonly selectedId = signal<string | null>(null);
  /** Identifiants des souvenirs déjà ouverts (connus), retenus d'une visite à l'autre. */
  readonly discoveredIds = signal<ReadonlySet<string>>(this.restoreDiscovered());

  readonly selected = computed(() => this.memories().find((m) => m.id === this.selectedId()) ?? null);
  /** Position du souvenir sélectionné dans la liste (-1 si aucun). */
  readonly selectedIndex = computed(() => this.memories().findIndex((m) => m.id === this.selectedId()));

  /** Les souvenirs connus (déjà grattés), dans l'ordre du JSON. Les autres restent cachés (album, titre au survol). */
  readonly discovered = computed(() => this.memories().filter((m) => this.discoveredIds().has(m.id)));
  readonly total = computed(() => this.memories().length);

  constructor() {
    this.load();
  }

  load(url = 'data/memories.json') {
    this.status.set('loading');
    this.http.get<unknown>(url).subscribe({
      next: (raw) => {
        this.memories.set(parseMemories(raw));
        this.status.set('ready');
      },
      error: (err) => {
        console.error(`[memories] impossible de charger ${url}`, err);
        this.status.set('error');
      },
    });
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

  private restoreDiscovered(): ReadonlySet<string> {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(DISCOVERED_KEY) ?? '[]');
      return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  }
}
