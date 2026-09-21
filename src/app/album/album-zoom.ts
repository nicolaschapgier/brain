import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatMemoryDate } from '../core/memory-date';
import { Memory } from '../core/memory.model';
import { MemoryStore } from '../core/memory.store';
import { themeFor, yearOf } from '../core/year-theme';

/**
 * Modale de l'album : un souvenir collé, en grand, par-dessus la page. Elle se ferme avec la croix, un clic à côté ou
 * Échap (touche gérée par l'album, qui sait si une modale est ouverte).
 */
@Component({
  selector: 'app-album-zoom',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  // Le thème de l'année du souvenir (couleurs, effet rétro) se pose en variables CSS sur la modale.
  host: { '[style]': 'theme().vars' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './album-zoom.html',
  styleUrl: './album-zoom.scss',
})
export class AlbumZoom {
  private readonly store = inject(MemoryStore);
  private readonly closeButton = viewChild.required<unknown, ElementRef<HTMLElement>>('closeButton', { read: ElementRef });

  readonly memory = input.required<Memory>();
  readonly closed = output<void>();

  protected readonly year = computed(() => yearOf(this.memory().date));
  protected readonly theme = computed(() => themeFor(this.year()));

  protected readonly number = computed(() => this.store.memories().findIndex((m) => m.id === this.memory().id) + 1);
  protected readonly total = computed(() => this.store.total());
  protected readonly brokenImage = signal(false);

  protected readonly formatDate = formatMemoryDate;

  constructor() {
    // Au retour, le focus retourne à l'autocollant sur lequel on a cliqué.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    afterNextRender(() => this.closeButton().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => opener?.focus());
  }
}
