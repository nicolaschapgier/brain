import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { formatMemoryDate } from '../core/memory-date';
import { MemoryStore } from '../core/memory.store';
import { AlbumSide, StickerSide } from './album-book';
import { allBoards, boardsFrom } from './album-sponsors';

/** Petites rotations, pour que les autocollants paraissent collés à la main et non alignés au millimètre. */
const TILTS = [-1.6, 1.2, 0.9, -1.1];

/** Panneaux publicitaires au pied de chaque page de souvenirs. */
const BOARDS_PER_PAGE = 3;

/** Une face du livre : la couverture, l'accueil, une page d'autocollants, la page « à suivre » ou le dos. */
@Component({
  selector: 'app-album-page',
  imports: [MatIconModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Le verso (page de gauche) a sa reliure à droite : le style en tient compte.
  host: { '[class.verso]': 'side().index % 2 === 1' },
  templateUrl: './album-page.html',
  styleUrls: ['./album-page.scss', './album-cover.scss'],
})
export class AlbumPage {
  protected readonly store = inject(MemoryStore);

  readonly side = input.required<AlbumSide>();
  /** Émis au clic sur un autocollant collé : l'album affiche alors le souvenir en grand. */
  readonly open = output<string>();

  protected readonly stickers = computed<StickerSide | null>(() => {
    const side = this.side();
    return side.kind === 'stickers' ? side : null;
  });

  protected readonly range = computed(() => {
    const slots = this.stickers()?.slots ?? [];
    return slots.length ? { first: slots[0].number, last: slots[slots.length - 1].number } : null;
  });

  protected readonly pageNumber = computed(() => this.side().index + 1);
  protected readonly boards = computed(() => boardsFrom(this.side().index, BOARDS_PER_PAGE));
  protected readonly wall = allBoards();

  /** Un segment par souvenir dans la jauge de l'accueil : plein si le souvenir est collé. */
  protected readonly segments = computed(() => this.store.memories().map((memory) => this.store.isDiscovered(memory.id)));

  private readonly brokenImages = signal<ReadonlySet<string>>(new Set());

  protected hasImage(image: string): boolean {
    return !!image && !this.brokenImages().has(image);
  }

  protected markBroken(image: string) {
    this.brokenImages.update((set) => new Set(set).add(image));
  }

  protected tilt(number: number): string {
    return `${TILTS[(number - 1) % TILTS.length]}deg`;
  }

  protected formatDate = formatMemoryDate;
}
