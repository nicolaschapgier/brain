import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ALBUM_UNLOCK_THRESHOLD, MemoryStore } from '@core/memory.store';
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
  /** L'icône de l'album reste cachée tant que le seuil de déblocage n'est pas atteint. */
  protected readonly hasDiscoveries = computed(() => this.store.discoveredIds().size >= ALBUM_UNLOCK_THRESHOLD);

  constructor() {}
  // On annonce l'album une seule fois (`markAlbumUnlockSeen` empêche toute redite), à la fermeture de la carte qui
  // fait passer le seuil : pas pendant qu'elle est encore ouverte, pour ne pas superposer les deux modales.
  protected unlockAlbum = effect(() => {
    const seen = this.store.albumUnlockSeen();
    const discovered = this.store.discoveredIds().size;
    const cardOpen = this.store.selectedId() !== null;

    if (seen || discovered < ALBUM_UNLOCK_THRESHOLD || cardOpen) return;

    this.store.markAlbumUnlockSeen();
    void this.showAlbumUnlock();
  })

  /** L'album prend toute la place : on referme la carte ouverte, elle ne serait pas visible dessous. */
  protected openAlbum() {
    this.store.select(null);
    this.albumOpen.set(true);
  }

  /** Modale d'annonce (chargée à la demande) : un clic sur « Voir l'album » l'ouvre directement. */
  private async showAlbumUnlock() {
    const { AlbumUnlock } = await import('@features/album-unlock/album-unlock');
    this.dialog
      .open<InstanceType<typeof AlbumUnlock>, void, boolean>(AlbumUnlock, { width: '420px', maxWidth: '92vw' })
      .afterClosed()
      .subscribe((seeAlbum) => {
        if (seeAlbum) this.openAlbum();
      });
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
