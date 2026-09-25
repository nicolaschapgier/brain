import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/** La modale montrée une seule fois, quand la cinquième carte est découverte : elle annonce l'album et invite à l'ouvrir. */
@Component({
  selector: 'app-album-unlock',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './album-unlock.html',
  styleUrl: './album-unlock.scss',
})
export class AlbumUnlock {}
