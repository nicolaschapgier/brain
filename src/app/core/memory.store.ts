import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Memory, parseMemories } from './memory.model';

export type LoadStatus = 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class MemoryStore {
  private readonly http = inject(HttpClient);

  readonly memories = signal<Memory[]>([]);
  readonly status = signal<LoadStatus>('loading');
  readonly selectedId = signal<string | null>(null);

  readonly selected = computed(() => this.memories().find((m) => m.id === this.selectedId()) ?? null);
  /** Position du souvenir sélectionné dans la liste (-1 si aucun). */
  readonly selectedIndex = computed(() => this.memories().findIndex((m) => m.id === this.selectedId()));

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

  select(id: string | null) {
    this.selectedId.set(id);
  }

  next() {
    this.step(1);
  }

  previous() {
    this.step(-1);
  }

  private step(direction: 1 | -1) {
    const list = this.memories();
    if (!list.length) return;
    const from = this.selectedIndex();
    const index = from < 0 ? 0 : (from + direction + list.length) % list.length;
    this.selectedId.set(list[index].id);
  }
}
