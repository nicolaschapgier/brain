import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Album } from './album/album';
import { BrainViewer } from './brain/brain-viewer/brain-viewer';
import { MemoryStore } from './core/memory.store';
import { MemoryCard } from './ui/memory-card/memory-card';

@Component({
  selector: 'app-root',
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
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
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
    const { MemoryForm } = await import('./ui/memory-form/memory-form');
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
