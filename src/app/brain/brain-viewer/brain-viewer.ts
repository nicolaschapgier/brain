import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MemoryStore } from '../../core/memory.store';
import { BrainScene, HoverInfo } from '../brain-scene';

@Component({
  selector: 'app-brain-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brain-viewer.html',
  styleUrl: './brain-viewer.scss',
})
export class BrainViewer {
  private readonly store = inject(MemoryStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly scene = signal<BrainScene | null>(null);

  readonly autoRotate = input(true);
  protected readonly hover = signal<HoverInfo | null>(null);

  constructor() {
    afterNextRender(() => {
      const scene = new BrainScene({
        canvas: this.canvas().nativeElement,
        autoRotate: this.autoRotate(),
        onSelect: (id) => this.store.select(id),
        onHover: (hover) => this.hover.set(hover),
      });
      this.scene.set(scene);
      this.destroyRef.onDestroy(() => scene.dispose());
    });

    // Ordre voulu : les neurones sont recréés avant que la sélection y soit réappliquée.
    effect(() => this.scene()?.setMemories(this.store.memories()));
    effect(() => this.scene()?.setAutoRotate(this.autoRotate()));
    effect(() => {
      this.store.memories();
      this.scene()?.focus(this.store.selectedId());
    });
  }

  /** Titre au survol d'un neurone : celui d'un souvenir inconnu reste secret. */
  protected hoveredTitle() {
    const id = this.hover()?.id;
    const memory = this.store.memories().find((m) => m.id === id);
    if (!memory) return '';
    return this.store.isDiscovered(memory.id) ? memory.title : 'Souvenir à découvrir';
  }

  resetView() {
    this.store.select(null);
    this.scene()?.resetView();
  }

  enterBrain() {
    this.store.select(null);
    this.scene()?.enterBrain();
  }
}
