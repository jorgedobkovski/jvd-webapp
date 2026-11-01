import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Paginacao } from '../../compartilhado/paginacao';
import { UFS, formatarDocumento } from '../../compartilhado/formatadores';
import { Pagina } from '../../compartilhado/modelos';
import { Sessao } from '../../core/sessao';
import { Cliente, ClientesApi, FiltroDeClientes, paramsDeClientes } from './clientes-api';

type Situacao = 'todos' | 'ativos' | 'inativos';

@Component({
  selector: 'jvd-clientes-lista',
  imports: [RouterLink, FormField, Paginacao],
  templateUrl: './clientes-lista.html',
})
export class ClientesLista {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(ClientesApi);

  protected readonly ufs = UFS;
  protected readonly documento = formatarDocumento;

  // Campos digitados (só viram filtro ao buscar).
  protected readonly modelo = signal({ busca: '', uf: '', situacao: 'todos' as Situacao, soIncompletos: false });
  protected readonly formulario = form(this.modelo);

  private readonly filtro = signal<FiltroDeClientes>({ pagina: 1 });

  protected readonly resultado = httpResource<Pagina<Cliente>>(() => ({
    url: this.api.url,
    params: paramsDeClientes(this.filtro()),
  }));

  protected readonly itens = computed(() => (this.resultado.hasValue() ? this.resultado.value().itens : []));
  protected readonly pagina = computed(() => this.filtro().pagina ?? 1);
  protected readonly tamanho = computed(() => this.filtro().tamanho ?? 20);
  protected readonly total = computed(() => (this.resultado.hasValue() ? this.resultado.value().total : 0));

  protected buscar(): void {
    const { busca, uf, situacao, soIncompletos } = this.modelo();
    this.filtro.set({
      busca,
      uf: uf || undefined,
      // O técnico nunca recebe inativos: a API ignora o filtro, então nem o enviamos.
      ativo: this.sessao.ehGestor() && situacao !== 'todos' ? situacao === 'ativos' : undefined,
      incompleto: this.sessao.ehGestor() && soIncompletos ? true : undefined,
      pagina: 1,
    });
  }

  protected irParaPagina(pagina: number): void {
    this.filtro.update((atual) => ({ ...atual, pagina }));
  }

  protected tentarDeNovo(): void {
    this.resultado.reload();
  }
}
