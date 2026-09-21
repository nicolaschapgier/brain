import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { formatMemoryDate } from '@core/memory-date';
import { Memory, objectPositionOf } from '@core/memory.model';
import { MemoryStore } from '@core/memory.store';
import { themeFor, yearOf } from '@core/year-theme';
import { AlbumSide, StickerSide } from '../album-book';
import { allBoards, boardsFrom } from '../album-sponsors';

/** Petites rotations, pour que les autocollants paraissent collés à la main et non alignés au millimètre. */
const TILTS = [-1.6, 1.2, 0.9, -1.1];

/** Panneaux publicitaires au pied de chaque page de souvenirs. */
const BOARDS_PER_PAGE = 3;

/** Une face du livre : la couverture, l'accueil, une page d'autocollants, la page « à suivre » ou le dos. */
@Component({
  selector: 'app-album-page',
  imports: [NgTemplateOutlet],
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

  /** Sous l'année : le nombre de souvenirs de la page, et « 1/2 » quand l'année occupe plusieurs pages. */
  protected readonly caption = computed(() => {
    const page = this.stickers();
    if (!page) return '';
    const count = `${page.slots.length} souvenir${page.slots.length > 1 ? 's' : ''}`;
    return page.parts > 1 ? `${count} · ${page.part}/${page.parts}` : count;
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

  /** Style d'un autocollant : son inclinaison, et les couleurs et l'effet rétro du thème de son année. */
  protected stickerStyle(memory: Memory, number: number): Record<string, string> {
    return { ...themeFor(yearOf(memory.date)).vars, '--tilt': this.tilt(number) };
  }

  protected yearOf = yearOf;
  protected objectPosition = objectPositionOf;

  protected tilt(number: number): string {
    return `${TILTS[(number - 1) % TILTS.length]}deg`;
  }

  protected formatDate = formatMemoryDate;
}
