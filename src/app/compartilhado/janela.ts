import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';

let proximoId = 0;

/**
 * Janela (modal) sobre a página, com o `<dialog>` nativo: o fundo fica inerte, o foco fica preso dentro, Esc fecha e o
 * foco volta para quem a abriu. Quem usa renderiza a janela com `@if`; criar = abrir, destruir = fechar.
 */
@Component({
  selector: 'jvd-janela',
  template: `
    <dialog #dialogo class="janela" [attr.aria-labelledby]="idDoTitulo" (cancel)="$event.preventDefault(); fechar.emit()">
      <div class="flex items-start justify-between gap-3">
        <h2 [id]="idDoTitulo" class="text-lg font-semibold">{{ titulo() }}</h2>
        <button type="button" class="botao-secundario !px-3 !py-1" aria-label="Fechar a janela" (click)="fechar.emit()">✕</button>
      </div>
      <div class="mt-3">
        <ng-content />
      </div>
    </dialog>
  `,
})
export class Janela {
  readonly titulo = input.required<string>();
  /** A pessoa pediu para fechar (botão ✕ ou Esc); quem usa decide e remove a janela. */
  readonly fechar = output<void>();

  protected readonly idDoTitulo = `janela-titulo-${++proximoId}`;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    afterNextRender(() => {
      const el = this.dialogo().nativeElement;
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    });
    inject(DestroyRef).onDestroy(() => {
      const el = this.dialogo().nativeElement;
      if (typeof el.close === 'function' && el.open) el.close(); // devolve o foco a quem abriu
    });
  }
}
