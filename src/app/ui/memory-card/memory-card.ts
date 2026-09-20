import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatMemoryDate } from '../../core/memory-date';
import { MemoryStore } from '../../core/memory.store';
import { ScratchCover } from '../scratch-cover/scratch-cover';

/** Inclinaison maximale (en degrés) de l'autocollant quand la souris le survole. */
const TILT_X = 6;
const TILT_Y = 5;

@Component({
  selector: 'app-memory-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatTooltipModule, ScratchCover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeOnEscape($event)' },
  templateUrl: './memory-card.html',
  styleUrl: './memory-card.scss',
})
export class MemoryCard {
  protected readonly store = inject(MemoryStore);

  /** Une liste d'un élément : `@for` recrée la carte (et rejoue son animation) à chaque changement de souvenir. */
  protected readonly shown = computed(() => {
    const memory = this.store.selected();
    return memory ? [memory] : [];
  });

  protected readonly number = computed(() => this.store.selectedIndex() + 1);
  protected readonly total = computed(() => this.store.memories().length);
  protected readonly brokenImage = signal<string | null>(null);

  /**
   * Identifiant du souvenir dont la carte est recouverte de la pellicule à gratter, ou `null`. Décidé à l'ouverture :
   * un souvenir inconnu s'ouvre recouvert ; une fois gratté il devient connu, mais sa pellicule reste le temps de
   * s'effacer (elle prévient quand elle a fini, voir `finished`).
   */
  protected readonly coverId = linkedSignal<string | null, string | null>({
    source: this.store.selectedId,
    computation: (id) => untracked(() => (id && !this.store.isDiscovered(id) ? id : null)),
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly formatDate = formatMemoryDate;

  /** Incline l'autocollant vers la souris et déplace le reflet holographique (variables CSS lues par le style). */
  protected tilt(event: PointerEvent) {
    // Pas d'inclinaison pendant qu'on gratte : la carte ne doit pas bouger sous le doigt.
    if (this.reducedMotion || event.pointerType === 'touch' || this.coverId() !== null) return;
    const sticker = event.currentTarget as HTMLElement;
    const rect = sticker.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    sticker.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    sticker.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    sticker.style.setProperty('--tilt-y', `${((x - 0.5) * 2 * TILT_X).toFixed(2)}deg`);
    sticker.style.setProperty('--tilt-x', `${((0.5 - y) * 2 * TILT_Y).toFixed(2)}deg`);
    sticker.style.setProperty('--foil', '1');
  }

  /** Échap ferme la carte, sauf si l'appui vise autre chose (un menu ouvert, un champ de saisie…). */
  protected closeOnEscape(event: Event) {
    if (!this.store.selectedId()) return;
    const target = event.target as HTMLElement | null;
    const neutral = !target || target === document.body || target.tagName === 'CANVAS' || this.host.nativeElement.contains(target);
    if (neutral) this.store.select(null);
  }

  protected resetTilt(event: PointerEvent) {
    const sticker = event.currentTarget as HTMLElement;
    for (const name of ['--mx', '--my', '--tilt-x', '--tilt-y', '--foil']) sticker.style.removeProperty(name);
  }
}
