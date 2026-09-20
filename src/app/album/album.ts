import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemoryStore } from '../core/memory.store';
import { AlbumPage } from './album-page';
import { Turn, buildSides, nextSide, spreadOf, viewOf } from './album-book';

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
  imports: [AlbumPage, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './album.html',
  styleUrl: './album.scss',
})
export class Album {
  protected readonly store = inject(MemoryStore);
  /** Émis quand l'album doit se refermer (croix, Échap, ou ouverture d'une carte). */
  readonly closed = output<void>();

  protected readonly flipMs = FLIP_MS;

  private readonly closeButton = viewChild.required<unknown, ElementRef<HTMLElement>>('closeButton', { read: ElementRef });
  private readonly compactQuery = window.matchMedia(COMPACT_QUERY);
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly compact = signal(this.compactQuery.matches);
  private readonly sides = computed(() => buildSides(this.store.memories()));
  /** La face courante (voir `spreadOf`) : elle vaut 0 à la couverture. */
  private readonly side = signal(0);
  private readonly turn = signal<Turn | null>(null);

  protected readonly view = computed(() => viewOf(this.sides(), this.side(), this.compact(), this.turn()));

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

    destroyRef.onDestroy(() => {
      this.compactQuery.removeEventListener('change', onChange);
      clearTimeout(this.timer);
      opener?.focus();
    });
  }

  protected turnPage(dir: 1 | -1) {
    if (this.turn()) return;
    const from = this.side();
    const to = this.step(dir);
    if (to === from) return;

    this.side.set(to);
    if (this.reducedMotion) return;
    this.turn.set({ dir, from });
    this.timer = setTimeout(() => this.turn.set(null), FLIP_MS);
  }

  /** Clic sur un autocollant : l'album se ferme et la carte du souvenir s'ouvre dans le cerveau. */
  protected openMemory(id: string) {
    this.store.select(id);
    this.closed.emit();
  }

  protected onKey(event: KeyboardEvent) {
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
