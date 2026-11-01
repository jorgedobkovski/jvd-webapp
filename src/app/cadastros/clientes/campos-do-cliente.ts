import { Component, input } from '@angular/core';
import { FieldTree, FormField, SchemaPathTree, email, maxLength, required } from '@angular/forms/signals';
import { UFS } from '../../compartilhado/formatadores';
import { DadosDoCliente } from './clientes-api';

export const CLIENTE_VAZIO: DadosDoCliente = {
  nomeRazaoSocial: '',
  nomeFantasia: '',
  documento: '',
  inscricaoEstadualRg: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cep: '',
  cidade: '',
  uf: '',
  telefone: '',
  email: '',
};

/** Regras de campo do cliente, as mesmas na tela de clientes e na janela do relatório. Limites: IA/Specs/CLIENTES_EQUIPAMENTOS.md. */
export function regrasDoCliente(c: SchemaPathTree<DadosDoCliente>): void {
  required(c.nomeRazaoSocial, { message: 'Informe o nome ou a razão social.' });
  maxLength(c.nomeRazaoSocial, 200, { message: 'Use no máximo 200 caracteres.' });
  maxLength(c.nomeFantasia, 200, { message: 'Use no máximo 200 caracteres.' });
  maxLength(c.documento, 40, { message: 'Documento longo demais.' });
  maxLength(c.inscricaoEstadualRg, 30, { message: 'Use no máximo 30 caracteres.' });
  maxLength(c.logradouro, 150, { message: 'Use no máximo 150 caracteres.' });
  maxLength(c.numero, 20, { message: 'Use no máximo 20 caracteres.' });
  maxLength(c.bairro, 80, { message: 'Use no máximo 80 caracteres.' });
  maxLength(c.cep, 20, { message: 'CEP longo demais.' });
  maxLength(c.cidade, 80, { message: 'Use no máximo 80 caracteres.' });
  maxLength(c.telefone, 30, { message: 'Use no máximo 30 caracteres.' });
  maxLength(c.email, 254, { message: 'E-mail longo demais.' });
  email(c.email, { message: 'Informe um e-mail válido.', when: ({ value }) => value() !== '' });
}

/**
 * Campos do cadastro de cliente (sem o botão de salvar), para a tela de clientes e para a janela do relatório.
 * `prefixo` deixa os ids únicos quando há mais de um formulário na mesma página.
 */
@Component({
  selector: 'jvd-campos-do-cliente',
  imports: [FormField],
  host: { class: 'contents' },
  template: `
<div class="sm:col-span-2">
  <label [for]="p() + 'nome'" class="rotulo">Nome ou razão social *</label>
  <input [id]="p() + 'nome'" class="campo" autocomplete="off" [formField]="campos().nomeRazaoSocial" [attr.aria-invalid]="campos().nomeRazaoSocial().touched() && campos().nomeRazaoSocial().invalid()" [attr.aria-describedby]="p() + 'nome-erro'" />
  <p [id]="p() + 'nome-erro'" class="campo-erro">
    @if (campos().nomeRazaoSocial().touched()) {
      @for (e of campos().nomeRazaoSocial().errors(); track e.kind) {
        <span class="block">{{ e.message }}</span>
      }
    }
  </p>
</div>

<div class="sm:col-span-2">
  <label [for]="p() + 'fantasia'" class="rotulo">Nome fantasia</label>
  <input [id]="p() + 'fantasia'" class="campo" autocomplete="off" [formField]="campos().nomeFantasia" />
</div>

<div>
  <label [for]="p() + 'documento'" class="rotulo">CPF ou CNPJ</label>
  <input [id]="p() + 'documento'" class="campo" inputmode="numeric" autocomplete="off" [attr.aria-describedby]="p() + 'documento-ajuda'" [formField]="campos().documento" />
  <p [id]="p() + 'documento-ajuda'" class="mt-1 text-sm text-slate-600 dark:text-slate-300">Pode ficar em branco; o cadastro fica marcado como incompleto.</p>
</div>

<div>
  <label [for]="p() + 'ie'" class="rotulo">Inscrição estadual ou RG</label>
  <input [id]="p() + 'ie'" class="campo" autocomplete="off" [formField]="campos().inscricaoEstadualRg" />
</div>

<div>
  <label [for]="p() + 'logradouro'" class="rotulo">Logradouro</label>
  <input [id]="p() + 'logradouro'" class="campo" autocomplete="off" [formField]="campos().logradouro" />
</div>

<div>
  <label [for]="p() + 'numero'" class="rotulo">Número</label>
  <input [id]="p() + 'numero'" class="campo" autocomplete="off" [formField]="campos().numero" />
</div>

<div>
  <label [for]="p() + 'bairro'" class="rotulo">Bairro</label>
  <input [id]="p() + 'bairro'" class="campo" autocomplete="off" [formField]="campos().bairro" />
</div>

<div>
  <label [for]="p() + 'cep'" class="rotulo">CEP</label>
  <input [id]="p() + 'cep'" class="campo" inputmode="numeric" autocomplete="off" [formField]="campos().cep" />
</div>

<div>
  <label [for]="p() + 'cidade'" class="rotulo">Cidade</label>
  <input [id]="p() + 'cidade'" class="campo" autocomplete="off" [formField]="campos().cidade" />
</div>

<div>
  <label [for]="p() + 'uf'" class="rotulo">UF</label>
  <select [id]="p() + 'uf'" class="campo" [formField]="campos().uf">
    <option value="">—</option>
    @for (sigla of ufs; track sigla) {
      <option [value]="sigla">{{ sigla }}</option>
    }
  </select>
</div>

<div>
  <label [for]="p() + 'telefone'" class="rotulo">Telefone</label>
  <input [id]="p() + 'telefone'" class="campo" type="tel" autocomplete="off" [formField]="campos().telefone" />
</div>

<div>
  <label [for]="p() + 'email'" class="rotulo">E-mail</label>
  <input [id]="p() + 'email'" class="campo" type="email" autocomplete="off" [formField]="campos().email" [attr.aria-invalid]="campos().email().touched() && campos().email().invalid()" [attr.aria-describedby]="p() + 'email-erro'" />
  <p [id]="p() + 'email-erro'" class="campo-erro">
    @if (campos().email().touched()) {
      @for (e of campos().email().errors(); track e.kind) {
        <span class="block">{{ e.message }}</span>
      }
    }
  </p>
</div>
  `,
})
export class CamposDoCliente {
  readonly campos = input.required<FieldTree<DadosDoCliente>>();
  readonly prefixo = input('');

  protected readonly ufs = UFS;
  protected p(): string {
    return this.prefixo();
  }
}
