import { Routes } from '@angular/router';
import { exigePerfil, exigeSessao, exigeUsuario, soVisitante } from './core/guardas';
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
      { path: 'relatorios', loadComponent: () => import('./relatorios/relatorios-lista').then((m) => m.RelatoriosLista) },
      { path: 'relatorios/novo', loadComponent: () => import('./relatorios/relatorio-formulario').then((m) => m.RelatorioFormulario) },
      { path: 'relatorios/:id', loadComponent: () => import('./relatorios/relatorio-detalhe').then((m) => m.RelatorioDetalheTela) },
      { path: 'relatorios/:id/retificar', loadComponent: () => import('./relatorios/relatorio-retificacao').then((m) => m.RelatorioRetificacao) },
      { path: 'relatorios/:id/editar', loadComponent: () => import('./relatorios/relatorio-formulario').then((m) => m.RelatorioFormulario) },
      { path: 'clientes', loadComponent: () => import('./cadastros/clientes/clientes-lista').then((m) => m.ClientesLista) },
      { path: 'clientes/novo', loadComponent: () => import('./cadastros/clientes/cliente-formulario').then((m) => m.ClienteFormulario) },
      { path: 'clientes/:id', loadComponent: () => import('./cadastros/clientes/cliente-detalhe').then((m) => m.ClienteDetalhe) },
      { path: 'clientes/:id/editar', loadComponent: () => import('./cadastros/clientes/cliente-formulario').then((m) => m.ClienteFormulario) },
      { path: 'equipamentos', loadComponent: () => import('./cadastros/equipamentos/equipamentos-lista').then((m) => m.EquipamentosLista) },
      { path: 'equipamentos/novo', loadComponent: () => import('./cadastros/equipamentos/equipamento-formulario').then((m) => m.EquipamentoFormulario) },
      { path: 'equipamentos/:id/editar', loadComponent: () => import('./cadastros/equipamentos/equipamento-formulario').then((m) => m.EquipamentoFormulario) },
      { path: 'equipamentos/:id', redirectTo: 'equipamentos/:id/editar' },
      // Área do gestor: a API também barra o técnico (a guarda só poupa a ida a uma tela que daria 403).
      {
        path: '',
        canActivate: [exigePerfil('Gestor')],
        children: [
          { path: 'catalogo', loadComponent: () => import('./cadastros/catalogo/catalogo-lista').then((m) => m.CatalogoLista) },
          { path: 'catalogo/novo', loadComponent: () => import('./cadastros/catalogo/servico-formulario').then((m) => m.ServicoFormulario) },
          { path: 'catalogo/:id/editar', loadComponent: () => import('./cadastros/catalogo/servico-formulario').then((m) => m.ServicoFormulario) },
          { path: 'catalogo/:id', redirectTo: 'catalogo/:id/editar' },
          { path: 'emissor', loadComponent: () => import('./cadastros/emissor/emissor-formulario').then((m) => m.EmissorFormulario) },
          { path: 'usuarios', loadComponent: () => import('./cadastros/usuarios/usuarios-lista').then((m) => m.UsuariosLista) },
          { path: 'usuarios/novo', loadComponent: () => import('./cadastros/usuarios/usuario-formulario').then((m) => m.UsuarioFormulario) },
          { path: 'usuarios/:id/editar', loadComponent: () => import('./cadastros/usuarios/usuario-formulario').then((m) => m.UsuarioFormulario) },
          { path: 'usuarios/:id', redirectTo: 'usuarios/:id/editar' },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
