import { Component, computed, input, signal } from '@angular/core';
import { Ocorrencia } from './importacao-api';

export interface TotaisDaImportacao {
  totalLidos: number;
  totalImportados: number;
  totalRejeitados: number;
  totalAvisos: number;
  totalIgnoradas: number;
}

const POR_VEZ = 50;

/** Totais e ocorrências de uma importação (simulada, real ou do histórico). Os motivos são textos fixos da API. */
@Component({
  selector: 'jvd-resultado-da-importacao',
  template: `
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div class="cartao"><dt class="text-sm text-slate-600 dark:text-slate-300">Linhas lidas</dt><dd class="text-xl font-semibold">{{ totais().totalLidos }}</dd></div>
      <div class="cartao"><dt class="text-sm text-slate-600 dark:text-slate-300">{{ rotuloDeImportados() }}</dt><dd class="text-xl font-semibold">{{ totais().totalImportados }}</dd></div>
      <div class="cartao"><dt class="text-sm text-slate-600 dark:text-slate-300">Rejeitadas</dt><dd class="text-xl font-semibold">{{ totais().totalRejeitados }}</dd></div>
      <div class="cartao"><dt class="text-sm text-slate-600 dark:text-slate-300">Avisos</dt><dd class="text-xl font-semibold">{{ totais().totalAvisos }}</dd></div>
      <div class="cartao"><dt class="text-sm text-slate-600 dark:text-slate-300">Ignoradas</dt><dd class="text-xl font-semibold">{{ totais().totalIgnoradas }}</dd></div>
    </dl>
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Ignoradas são linhas que não são registro (títulos, cabeçalhos repetidos, rodapé, outros grupos).</p>

    @if (ocorrencias().length === 0) {
      <p class="cartao mt-3 text-slate-700 dark:text-slate-200">Nenhuma ocorrência a revisar.</p>
    } @else {
      <h3 class="mt-4 text-lg font-semibold">Ocorrências ({{ ocorrencias().length }})</h3>
      <div class="mt-2 overflow-x-auto">
        <table class="cartao w-full text-left text-sm">
          <caption class="sr-only">Ocorrências da importação</caption>
          <thead>
            <tr class="border-b border-slate-300 dark:border-slate-700">
              <th scope="col" class="p-2">Linha</th>
              <th scope="col" class="p-2">Gravidade</th>
              <th scope="col" class="p-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            @for (o of visiveis(); track $index) {
              <tr class="border-b border-slate-200 dark:border-slate-800">
                <td class="p-2">{{ o.linha }}</td>
                <td class="p-2"><span class="etiqueta">{{ o.gravidade === 'Erro' ? 'Erro (não importada)' : 'Aviso' }}</span></td>
                <td class="p-2">{{ o.motivo }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (restantes() > 0) {
        <p class="mt-2">
          <button type="button" class="botao-secundario" (click)="mostrarMais()">Mostrar mais {{ restantes() < porVez ? restantes() : porVez }} (faltam {{ restantes() }})</button>
        </p>
      }
    }
  `,
})
export class ResultadoDaImportacao {
  readonly totais = input.required<TotaisDaImportacao>();
  readonly ocorrencias = input.required<Ocorrencia[]>();
  /** Simulação: "Seriam importadas"; real ou histórico: "Importadas". */
  readonly simulacao = input(false);

  protected readonly porVez = POR_VEZ;
  private readonly quantas = signal(POR_VEZ);
  protected readonly visiveis = computed(() => this.ocorrencias().slice(0, this.quantas()));
  protected readonly restantes = computed(() => Math.max(0, this.ocorrencias().length - this.quantas()));
  protected readonly rotuloDeImportados = computed(() => (this.simulacao() ? 'Seriam importadas' : 'Importadas'));

  protected mostrarMais(): void {
    this.quantas.update((n) => n + POR_VEZ);
  }
}
