import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
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
    MatMenuModule,
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
  protected readonly autoRotate = signal(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  protected readonly albumOpen = signal(false);

  /** L'album prend toute la place : on referme la carte ouverte, elle ne serait pas visible dessous. */
  protected openAlbum() {
    this.store.select(null);
    this.albumOpen.set(true);
  }

  protected toggleAutoRotate() {
    this.autoRotate.update((value) => !value);
  }
}
