import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemoryStore } from '@core/memory.store';
import { BrainViewer } from '@features/brain/brain-viewer/brain-viewer';
import { MemoryCard } from '@features/memory-card/memory-card';
import { Album } from '@pages/album/album';

/** La page d'accueil : le cerveau en 3D, la barre d'actions, la carte du souvenir ouvert, et l'album par-dessus quand on l'ouvre. */
@Component({
  selector: 'app-home',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    Album,
    BrainViewer,
    MemoryCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly store = inject(MemoryStore);
  private readonly dialog = inject(MatDialog);
  protected readonly autoRotate = signal(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  protected readonly albumOpen = signal(false);

  /** L'album prend toute la place : on referme la carte ouverte, elle ne serait pas visible dessous. */
  protected openAlbum() {
    this.store.select(null);
    this.albumOpen.set(true);
  }

  /** Le formulaire d'ajout (chargé à la demande, avec ses champs Material) ; le souvenir créé s'ouvre ensuite dans le cerveau. */
  protected async openMemoryForm() {
    this.store.select(null);
    const { MemoryForm } = await import('@features/memory-form/memory-form');
    this.dialog
      .open<InstanceType<typeof MemoryForm>, void, string>(MemoryForm, { width: '560px', maxWidth: '94vw', maxHeight: '92dvh' })
      .afterClosed()
      .subscribe((id) => {
        if (id) this.store.select(id);
      });
  }

  protected toggleAutoRotate() {
    this.autoRotate.update((value) => !value);
  }
}
