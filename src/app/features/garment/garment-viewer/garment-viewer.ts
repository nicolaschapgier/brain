import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Signal, afterNextRender, inject, input, viewChild } from '@angular/core';
import { GarmentScene } from '../scene/garment-scene';

/**
 * La vue 3D d'une tenue (voir `GarmentScene`) : un canvas WebGL, sans cadre ni carte autour — le vêtement flotte
 * directement dans la page. Utilisé par `Vestiaire`, une instance par tenue.
 */
@Component({
  selector: 'app-garment-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #canvas></canvas>',
  styleUrl: './garment-viewer.scss',
})
export class GarmentViewer {
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly image = input.required<string>();
  /**
   * La progression du scroll (0 à 1), en signal plutôt qu'en valeur : `GarmentScene` l'appelle elle-même à chaque
   * image de sa boucle de rendu, sans passer par la détection de changements d'Angular (60 fois par seconde, sinon).
   */
  readonly progress = input.required<Signal<number>>();

  constructor() {
    afterNextRender(() => {
      const scene = new GarmentScene({
        canvas: this.canvas().nativeElement,
        image: this.image(),
        getRotation: () => this.progress()() * Math.PI * 2,
      });
      this.destroyRef.onDestroy(() => scene.dispose());

      // Hors écran (tenue pas encore atteinte, ou déjà passée), inutile de continuer à dessiner.
      const observer = new IntersectionObserver(([entry]) => scene.setPaused(!entry.isIntersecting), { rootMargin: '200px' });
      observer.observe(this.canvas().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
