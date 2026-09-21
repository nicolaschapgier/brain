import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, signal, viewChild } from '@angular/core';
import { ImageFocus } from '@core/memory.model';
import { FRAME_RATIO, coverOverflow, dragFocus, isMovable, nudgeFocus } from './framing';

/** Pas des flèches du clavier, en pourcentage de la course de la photo. */
const KEY_STEP = 5;

/**
 * Le cadre de la photo, à la forme de la carte : on tire la photo (au doigt ou à la souris) pour choisir la partie
 * qu'elle montrera. Le point de cadrage est en pourcentage, comme le champ `focus` d'un souvenir.
 */
@Component({
  selector: 'app-photo-framer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './photo-framer.html',
  styleUrl: './photo-framer.scss',
})
export class PhotoFramer {
  readonly src = input.required<string>();
  /** Dimensions de la photo : elles donnent la course dont elle dispose dans le cadre. */
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  readonly focus = model.required<ImageFocus>();

  protected readonly ratio = FRAME_RATIO;
  protected readonly dragging = signal(false);
  protected readonly position = computed(() => `${this.focus()[0]}% ${this.focus()[1]}%`);
  protected readonly movable = computed(() => isMovable({ width: this.width(), height: this.height() }));

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private drag: { x: number; y: number; focus: ImageFocus; overflow: { x: number; y: number } } | null = null;

  protected onPointerDown(event: PointerEvent) {
    const frame = this.frame().nativeElement;
    frame.setPointerCapture(event.pointerId);
    this.drag = {
      x: event.clientX,
      y: event.clientY,
      focus: this.focus(),
      overflow: coverOverflow(
        { width: this.width(), height: this.height() },
        { width: frame.clientWidth, height: frame.clientHeight },
      ),
    };
    this.dragging.set(true);
  }

  protected onPointerMove(event: PointerEvent) {
    if (!this.drag) return;
    const { x, y, focus, overflow } = this.drag;
    this.focus.set(dragFocus(focus, event.clientX - x, event.clientY - y, overflow));
  }

  protected onPointerEnd() {
    this.drag = null;
    this.dragging.set(false);
  }

  protected onKeydown(event: KeyboardEvent) {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const step = steps[event.key];
    if (!step || !this.movable()) return;

    event.preventDefault();
    this.focus.update((focus) => nudgeFocus(focus, step[0], step[1]));
  }
}
