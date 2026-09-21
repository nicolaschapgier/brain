import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Le dos d'une carte : le logo du Club des Cerveaux sur le fond de la carte. Il se pose dans le même bloc que le recto
 * (voir `memory-card` et `album-zoom`) et se dévoile à l'ouverture, quand la carte se retourne. Il reprend les couleurs
 * du thème de l'année de la carte, héritées de la carte qui le contient.
 */
@Component({
  selector: 'app-card-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<div class="face"><img src="club-des-cerveaux.svg" alt="" draggable="false" /></div>`,
  styleUrl: './card-back.scss',
})
export class CardBack {}
