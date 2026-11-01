import { Component, inject } from '@angular/core';
import { Sessao } from '../../core/sessao';

/** Tela inicial. Os atalhos para cadastros e relatórios entram nas Fases 6B e 7. */
@Component({
  selector: 'jvd-inicio',
  template: `
    <h1 class="text-2xl font-semibold">Olá, {{ sessao.usuario()?.nome }}</h1>
    <p class="mt-2 text-slate-700 dark:text-slate-200">
      {{ sessao.ehGestor() ? 'Você acessa todos os cadastros e relatórios.' : 'Você acessa os relatórios dos serviços que executou.' }}
    </p>
    <p class="mt-4 text-sm text-slate-600 dark:text-slate-300">As telas de cadastros e de relatórios chegam nas próximas etapas.</p>
  `,
})
export class Inicio {
  protected readonly sessao = inject(Sessao);
}
