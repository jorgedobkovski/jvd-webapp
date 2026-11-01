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
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio) },
      { path: 'clientes', loadComponent: () => import('./cadastros/clientes/clientes-lista').then((m) => m.ClientesLista) },
      { path: 'clientes/novo', loadComponent: () => import('./cadastros/clientes/cliente-formulario').then((m) => m.ClienteFormulario) },
      { path: 'clientes/:id', loadComponent: () => import('./cadastros/clientes/cliente-detalhe').then((m) => m.ClienteDetalhe) },
      { path: 'clientes/:id/editar', loadComponent: () => import('./cadastros/clientes/cliente-formulario').then((m) => m.ClienteFormulario) },
      { path: 'equipamentos', loadComponent: () => import('./cadastros/equipamentos/equipamentos-lista').then((m) => m.EquipamentosLista) },
      { path: 'equipamentos/novo', loadComponent: () => import('./cadastros/equipamentos/equipamento-formulario').then((m) => m.EquipamentoFormulario) },
      { path: 'equipamentos/:id/editar', loadComponent: () => import('./cadastros/equipamentos/equipamento-formulario').then((m) => m.EquipamentoFormulario) },
      { path: 'equipamentos/:id', redirectTo: 'equipamentos/:id/editar' },
    ],
  },
  { path: '**', redirectTo: '' },
];
