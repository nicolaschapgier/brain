import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Memory } from '../core/memory.model';
import { MemoryStore } from '../core/memory.store';
import { AlbumPage } from './album-page';
import { AlbumZoom } from './album-zoom';
import { Turn, YearEntry, buildSides, nextSide, sideForPage, spreadOf, viewOf, visibleYears, yearEntries } from './album-book';

/** Durée d'un tour de page. Elle est transmise au style (`--flip-ms`) : l'animation et le minuteur restent d'accord. */
const FLIP_MS = 850;

/** En dessous de cette largeur, le livre s'affiche une page à la fois (voir `album.scss`). */
const COMPACT_QUERY = '(max-width: 899px)';

/**
 * L'album, façon album d'autocollants : un livre à feuilleter, dont les cases se remplissent à mesure que les souvenirs
 * sont découverts. Il recouvre toute la page ; la scène 3D est mise en pause derrière.
 */
@Component({
  selector: 'app-album',
  imports: [AlbumPage, AlbumZoom, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './album.html',
  styleUrl: './album.scss',
})
export class Album {
  protected readonly store = inject(MemoryStore);
  /** Émis quand l'album doit se refermer (croix ou Échap). */
  readonly closed = output<void>();

  protected readonly flipMs = FLIP_MS;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly closeButton = viewChild.required<unknown, ElementRef<HTMLElement>>('closeButton', { read: ElementRef });
  private readonly compactQuery = window.matchMedia(COMPACT_QUERY);
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly compact = signal(this.compactQuery.matches);
  private readonly sides = computed(() => buildSides(this.store.memories()));
  /** La face courante (voir `spreadOf`) : elle vaut 0 à la couverture. */
  private readonly side = signal(0);
  private readonly turn = signal<Turn | null>(null);
  /** Le souvenir affiché en grand dans la modale, ou `null`. */
  protected readonly zoomed = signal<Memory | null>(null);

  protected readonly view = computed(() => viewOf(this.sides(), this.side(), this.compact(), this.turn()));

  /** Les années du livre, pour le raccourci « aller à l'année ». */
  protected readonly years = computed(() => yearEntries(this.sides()));
  /** Les années dont une page est à l'écran (la puce de l'année est alors mise en avant). */
  protected readonly shownYears = computed(() => visibleYears(this.sides(), this.side(), this.compact()));

  protected readonly canPrevious = computed(() => this.step(-1) !== this.side());
  protected readonly canNext = computed(() => this.step(1) !== this.side());

  /** Position dans le livre (0 = couverture) et nombre de positions : un point par double page, ou par page en mode compact. */
  protected readonly dots = computed(() => {
    const count = this.sides().length;
    const total = this.compact() ? count : count / 2 + 1;
    const current = this.compact() ? this.side() : spreadOf(this.side());
    return Array.from({ length: total }, (_, i) => i === current);
  });

  /** Décalage horizontal du livre : fermé, la couverture (à droite) ou le dos (à gauche) se centre. */
  protected readonly shift = computed(() => {
    if (this.compact()) return 0;
    const spread = spreadOf(this.side());
    if (spread === 0) return -0.5;
    return spread === this.sides().length / 2 ? 0.5 : 0;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Au retour, le focus retourne au bouton qui a ouvert l'album.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onChange = (event: MediaQueryListEvent) => {
      this.abortTurn();
      this.compact.set(event.matches);
    };
    this.compactQuery.addEventListener('change', onChange);

    afterNextRender(() => this.closeButton().nativeElement.focus());

    // Sur un petit écran la rangée d'années défile : la puce de l'année affichée reste en vue, même si on feuillette.
    afterRenderEffect(() => {
      this.shownYears();
      this.host.nativeElement
        .querySelector('.years__chip--current')
        ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: this.reducedMotion ? 'auto' : 'smooth' });
    });

    destroyRef.onDestroy(() => {
      this.compactQuery.removeEventListener('change', onChange);
      clearTimeout(this.timer);
      opener?.focus();
    });
  }

  protected turnPage(dir: 1 | -1) {
    if (this.turn()) return;
    this.moveTo(this.step(dir));
  }

  /** Raccourci : ouvre le livre à la première page de l'année (un tour de page si elle est voisine, sinon d'un coup). */
  protected goToYear(entry: YearEntry) {
    this.abortTurn();
    this.moveTo(sideForPage(this.sides().length, entry.page, this.compact()));
  }

  /** Va à une face. Le tour de page ne s'anime que d'une page (ou double page) à la fois : au-delà, la feuille montrerait le mauvais verso. */
  private moveTo(to: number) {
    const from = this.side();
    if (to === from) return;

    this.side.set(to);
    const distance = this.compact() ? Math.abs(to - from) : Math.abs(spreadOf(to) - spreadOf(from));
    if (this.reducedMotion || distance !== 1) return;
    this.turn.set({ dir: to > from ? 1 : -1, from });
    this.timer = setTimeout(() => this.turn.set(null), FLIP_MS);
  }

  /** Clic sur un autocollant : le souvenir s'affiche en grand, en modale, sans quitter l'album. */
  protected openMemory(id: string) {
    this.zoomed.set(this.store.memories().find((memory) => memory.id === id) ?? null);
  }

  protected onKey(event: KeyboardEvent) {
    // Modale ouverte : seule Échap agit (elle referme la modale, pas l'album) ; le livre ne se feuillette plus.
    if (this.zoomed()) {
      if (event.key === 'Escape') {
        this.zoomed.set(null);
        event.preventDefault();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowRight':
        this.turnPage(1);
        break;
      case 'ArrowLeft':
        this.turnPage(-1);
        break;
      case 'Escape':
        this.closed.emit();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private step(dir: 1 | -1) {
    return nextSide(this.sides().length, this.side(), dir, this.compact());
  }

  /** Le passage en mode compact (rotation de l'écran…) coupe un tour de page en cours. */
  private abortTurn() {
    clearTimeout(this.timer);
    this.turn.set(null);
  }
}
