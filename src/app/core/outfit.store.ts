import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Outfit, parseOutfits } from './outfit.model';

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Les tenues du vestiaire, chargées depuis le JSON (même principe que `MemoryStore`) : ici pas de progression à
 * retenir, toutes les tenues sont visibles dès le chargement.
 */
@Injectable({ providedIn: 'root' })
export class OutfitStore {
  private readonly http = inject(HttpClient);

  readonly outfits = signal<Outfit[]>([]);
  readonly status = signal<LoadStatus>('loading');

  constructor() {
    this.load();
  }

  load(url = 'data/outfits.json') {
    this.status.set('loading');
    this.http.get<unknown>(url).subscribe({
      next: (raw) => {
        this.outfits.set(parseOutfits(raw));
        this.status.set('ready');
      },
      error: (err) => {
        console.error(`[outfits] impossible de charger ${url}`, err);
        this.status.set('error');
      },
    });
  }
}
