import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { OutfitStore } from '@core/outfit.store';
import { GarmentViewer } from '@features/garment/garment-viewer/garment-viewer';
import { ScrollPin } from '@shared/ui/scroll-pin/scroll-pin';

/**
 * Le vestiaire : chaque tenue reste épinglée à l'écran, tourne à 360° en 3D (voir `GarmentViewer`) et ses
 * informations apparaissent au fil du scroll (façon pages produit Apple, voir `vestiaire.scss` et `ScrollPin`),
 * avant que la suivante ne la recouvre. Une page à part entière (route `/vestiaire`), au même titre que le cerveau.
 */
@Component({
  selector: 'app-vestiaire',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, RouterLink, GarmentViewer, ScrollPin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'back()' },
  templateUrl: './vestiaire.html',
  styleUrl: './vestiaire.scss',
})
export class Vestiaire {
  protected readonly store = inject(OutfitStore);
  private readonly router = inject(Router);

  protected back() {
    void this.router.navigateByUrl('/');
  }
}
