import { Component, input } from '@angular/core';
import { FieldTree, FormField, SchemaPathTree, maxLength, required } from '@angular/forms/signals';

export interface CamposDeEquipamento {
  descricao: string;
  numeroSerie: string;
  numeroInmetro: string;
  observacoes: string;
}

export const EQUIPAMENTO_VAZIO: CamposDeEquipamento = { descricao: '', numeroSerie: '', numeroInmetro: '', observacoes: '' };

/** Regras de campo do equipamento, as mesmas na tela de equipamentos e na janela do relatório. */
export function regrasDoEquipamento(e: SchemaPathTree<CamposDeEquipamento>): void {
  required(e.descricao, { message: 'Informe a descrição (tipo ou modelo).' });
  maxLength(e.descricao, 200, { message: 'Use no máximo 200 caracteres.' });
  maxLength(e.numeroSerie, 60, { message: 'Use no máximo 60 caracteres.' });
  maxLength(e.numeroInmetro, 40, { message: 'Use no máximo 40 caracteres.' });
  maxLength(e.observacoes, 1000, { message: 'Use no máximo 1000 caracteres.' });
}

/** Campos do cadastro de equipamento (sem cliente nem botão de salvar). `prefixo` deixa os ids únicos na página. */
@Component({
  selector: 'jvd-campos-do-equipamento',
  imports: [FormField],
  host: { class: 'contents' },
  template: `
<div>
  <label [for]="p() + 'descricao'" class="rotulo">Descrição (tipo ou modelo) *</label>
  <input [id]="p() + 'descricao'" class="campo" autocomplete="off" [formField]="campos().descricao" [attr.aria-invalid]="campos().descricao().touched() && campos().descricao().invalid()" [attr.aria-describedby]="p() + 'descricao-erro'" />
  <p [id]="p() + 'descricao-erro'" class="campo-erro">
    @if (campos().descricao().touched()) {
      @for (e of campos().descricao().errors(); track e.kind) {
        <span class="block">{{ e.message }}</span>
      }
    }
  </p>
</div>

<div class="grid gap-4 sm:grid-cols-2">
  <div>
    <label [for]="p() + 'serie'" class="rotulo">Número de série</label>
    <input [id]="p() + 'serie'" class="campo" autocomplete="off" [formField]="campos().numeroSerie" />
  </div>
  <div>
    <label [for]="p() + 'inmetro'" class="rotulo">Número do INMETRO</label>
    <input [id]="p() + 'inmetro'" class="campo" autocomplete="off" [formField]="campos().numeroInmetro" />
  </div>
</div>

<div>
  <label [for]="p() + 'observacoes'" class="rotulo">Observações</label>
  <textarea [id]="p() + 'observacoes'" rows="3" class="campo" [formField]="campos().observacoes"></textarea>
</div>
  `,
})
export class CamposDoEquipamento {
  readonly campos = input.required<FieldTree<CamposDeEquipamento>>();
  readonly prefixo = input('');

  protected p(): string {
    return this.prefixo();
  }
}
