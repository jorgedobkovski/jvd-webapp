import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Sessao } from '../../core/sessao';

/** Tela inicial com atalhos. O atalho dos relatórios entra na Fase 7. */
@Component({
  selector: 'jvd-inicio',
  imports: [RouterLink],
  template: `
    <h1 class="text-2xl font-semibold">Olá, {{ sessao.usuario()?.nome }}</h1>
    <p class="mt-2 text-slate-700 dark:text-slate-200">
      {{ sessao.ehGestor() ? 'Você acessa todos os cadastros e relatórios.' : 'Você acessa os relatórios dos serviços que executou.' }}
    </p>
    <ul class="mt-4 grid gap-3 sm:grid-cols-2">
      <li><a routerLink="/clientes" class="cartao block text-lg font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Clientes</a></li>
      <li><a routerLink="/equipamentos" class="cartao block text-lg font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Equipamentos</a></li>
      @if (sessao.ehGestor()) {
        <li><a routerLink="/catalogo" class="cartao block text-lg font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Catálogo de serviços</a></li>
        <li><a routerLink="/emissor" class="cartao block text-lg font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Dados da empresa</a></li>
        <li><a routerLink="/usuarios" class="cartao block text-lg font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Usuários</a></li>
      }
    </ul>
    <p class="mt-4 text-sm text-slate-600 dark:text-slate-300">As telas de relatórios chegam nas próximas etapas.</p>
  `,
})
export class Inicio {
  protected readonly sessao = inject(Sessao);
}
