import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Home } from '@pages/home/home';

/** La racine de l'application : elle ne fait qu'afficher la page d'accueil (pas de routeur pour l'instant). */
@Component({
  selector: 'app-root',
  imports: [Home],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-home />',
})
export class App {}
