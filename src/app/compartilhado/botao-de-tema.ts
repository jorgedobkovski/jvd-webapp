import { Component, inject } from '@angular/core';
import { Tema } from '../core/tema';

/** Alterna entre tema claro e escuro. O rótulo diz o que o clique FAZ (e o botão não depende só do ícone). */
@Component({
  selector: 'jvd-botao-de-tema',
  template: `
    <button
      type="button"
      class="rounded-lg border border-slate-400 px-3 py-1.5 text-sm font-medium focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 dark:border-slate-500"
      (click)="tema.alternar()"
    >
      <span aria-hidden="true">{{ tema.escuro() ? '☀️' : '🌙' }}</span>
      {{ tema.escuro() ? 'Tema claro' : 'Tema escuro' }}
    </button>
  `,
})
export class BotaoDeTema {
  protected readonly tema = inject(Tema);
}
