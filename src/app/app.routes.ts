import { Routes } from '@angular/router';
import { exigeSessao, exigeUsuario, soVisitante } from './core/guardas';
import { Estrutura } from './layout/estrutura';

export const routes: Routes = [
  { path: 'entrar', canActivate: [soVisitante], loadComponent: () => import('./paginas/entrar/entrar').then((m) => m.Entrar) },
  { path: 'trocar-senha', canActivate: [exigeUsuario], loadComponent: () => import('./paginas/trocar-senha/trocar-senha').then((m) => m.TrocarSenha) },
  {
    path: '',
    component: Estrutura,
    canActivate: [exigeSessao],
    children: [{ path: '', pathMatch: 'full', loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio) }],
  },
  { path: '**', redirectTo: '' },
];
