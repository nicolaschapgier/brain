import { Directive, ElementRef, OnDestroy, OnInit, inject, signal } from '@angular/core';

/**
 * Pose `--p` (0 à 1) sur l'hôte : la progression du scroll à travers sa propre hauteur, pendant qu'il reste épinglé
 * à l'écran (voir `.outfit__stage` en `position: sticky` dans `vestiaire.scss`). 0 à l'entrée, 1 juste avant que la
 * tenue suivante ne recouvre celle-ci. Sert à révéler les informations au fil du scroll (en CSS pur, `calc`/`clamp`
 * sur `--p`) et à faire tourner la vue 3D du vêtement (voir `p`, lu directement en JS par `GarmentViewer`).
 *
 * Le scroll peut avoir lieu sur `window` ou sur un conteneur `overflow` : l'écoute en phase de capture sur `document`
 * reçoit les deux, alors qu'un `scroll` classique ne remonte pas jusqu'à `window`.
 */
@Directive({
  selector: '[appScrollPin]',
  exportAs: 'scrollPin',
})
export class ScrollPin implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private frame = 0;

  /**
   * Même valeur que `--p`, mais comme signal : `GarmentViewer` la lit dans sa propre boucle de rendu (pas via un
   * binding Angular classique, pour ne pas déclencher une détection de changements à chaque frame de scroll).
   */
  readonly p = signal(0);

  ngOnInit() {
    // Mouvement réduit : `vestiaire.scss` désépingle alors la tenue et affiche tout, sans dépendre de `--p`.
    if (this.reducedMotion) return;

    document.addEventListener('scroll', this.onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    this.onScroll();
  }

  ngOnDestroy() {
    document.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onScroll);
    cancelAnimationFrame(this.frame);
  }

  private readonly onScroll = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const rect = this.el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const p = scrollable > 0 ? Math.max(0, Math.min(1, -rect.top / scrollable)) : 0;

      this.el.style.setProperty('--p', p.toFixed(3));
      this.p.set(p);
    });
  };
}
