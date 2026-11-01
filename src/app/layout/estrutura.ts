import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Sessao } from '../core/sessao';

/** Moldura da área logada: cabeçalho com o usuário, "trocar senha" e "sair", e o conteúdo da rota. */
@Component({
  selector: 'jvd-estrutura',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <a routerLink="/" class="text-lg font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">JVD Sistema</a>
          <div class="flex items-center gap-3 text-sm">
            <span class="max-w-[12rem] truncate sm:max-w-none">{{ sessao.usuario()?.nome }} · {{ sessao.ehGestor() ? 'Gestor' : 'Técnico' }}</span>
            <a routerLink="/trocar-senha" class="underline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Trocar senha</a>
            <button type="button" class="rounded-lg border border-slate-400 px-3 py-1.5 font-medium focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 dark:border-slate-500" (click)="sair()">
              Sair
            </button>
          </div>
        </div>
        <nav class="border-t border-slate-200 dark:border-slate-800" aria-label="Principal">
          <ul class="mx-auto flex max-w-5xl flex-wrap gap-1 px-4 py-1 text-sm font-medium">
            <li>
              <a routerLink="/relatorios" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Relatórios</a>
            </li>
            <li>
              <a routerLink="/clientes" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Clientes</a>
            </li>
            <li>
              <a routerLink="/equipamentos" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Equipamentos</a>
            </li>
            @if (sessao.ehGestor()) {
            <li>
              <a routerLink="/catalogo" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Catálogo</a>
            </li>
            <li>
              <a routerLink="/emissor" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Empresa</a>
            </li>
            <li>
              <a routerLink="/usuarios" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Usuários</a>
            </li>
            <li>
              <a routerLink="/indicadores" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Indicadores</a>
            </li>
            <li>
              <a routerLink="/importacao" routerLinkActive="bg-slate-200 dark:bg-slate-700" ariaCurrentWhenActive="page" class="block rounded-lg px-3 py-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">Importação</a>
            </li>
            }
          </ul>
        </nav>
      </header>
      <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Estrutura {
  protected readonly sessao = inject(Sessao);
  private readonly router = inject(Router);

  protected async sair(): Promise<void> {
    await this.sessao.sair();
    await this.router.navigate(['/entrar']);
  }
}
