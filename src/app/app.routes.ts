import { Routes } from '@angular/router';
import { Home } from '@pages/home/home';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'vestiaire',
    loadComponent: () => import('@pages/vestiaire/vestiaire').then((m) => m.Vestiaire),
    title: 'Vestiaire · Le Club des Cerveaux',
  },
];
