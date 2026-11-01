import { Component, computed, input, output } from '@angular/core';

/** Navegação Anterior/Próxima de uma listagem paginada. */
@Component({
  selector: 'jvd-paginacao',
  template: `
    @if (total() > 0) {
      <nav class="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Paginação">
        <p class="text-sm text-slate-700 dark:text-slate-200" aria-live="polite">
          {{ total() }} {{ total() === 1 ? 'resultado' : 'resultados' }} · página {{ pagina() }} de {{ totalDePaginas() }}
        </p>
        <div class="flex gap-2">
          <button type="button" class="botao-secundario" [disabled]="pagina() <= 1" (click)="mudar.emit(pagina() - 1)">Anterior</button>
          <button type="button" class="botao-secundario" [disabled]="pagina() >= totalDePaginas()" (click)="mudar.emit(pagina() + 1)">
            Próxima
          </button>
        </div>
      </nav>
    }
  `,
})
export class Paginacao {
  readonly pagina = input.required<number>();
  readonly tamanho = input.required<number>();
  readonly total = input.required<number>();
  readonly mudar = output<number>();

  protected readonly totalDePaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamanho())));
}
