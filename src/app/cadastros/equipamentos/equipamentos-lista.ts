import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Pagina } from '../../compartilhado/modelos';
import { Paginacao } from '../../compartilhado/paginacao';
import { Sessao } from '../../core/sessao';
import { Equipamento, EquipamentosApi, FiltroDeEquipamentos, paramsDeEquipamentos } from './equipamentos-api';

type Situacao = 'todos' | 'ativos' | 'inativos';

@Component({
  selector: 'jvd-equipamentos-lista',
  imports: [RouterLink, FormField, Paginacao],
  templateUrl: './equipamentos-lista.html',
})
export class EquipamentosLista {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(EquipamentosApi);

  protected readonly modelo = signal({ busca: '', situacao: 'todos' as Situacao });
  protected readonly formulario = form(this.modelo);

  private readonly filtro = signal<FiltroDeEquipamentos>({ pagina: 1 });

  protected readonly resultado = httpResource<Pagina<Equipamento>>(() => ({
    url: this.api.url,
    params: paramsDeEquipamentos(this.filtro()),
  }));

  protected readonly itens = computed(() => (this.resultado.hasValue() ? this.resultado.value().itens : []));
  protected readonly pagina = computed(() => this.filtro().pagina ?? 1);
  protected readonly tamanho = computed(() => this.filtro().tamanho ?? 20);
  protected readonly total = computed(() => (this.resultado.hasValue() ? this.resultado.value().total : 0));

  protected buscar(): void {
    const { busca, situacao } = this.modelo();
    this.filtro.set({
      busca,
      // O técnico só recebe equipamentos ativos de clientes ativos: a API ignora o filtro, então nem o enviamos.
      ativo: this.sessao.ehGestor() && situacao !== 'todos' ? situacao === 'ativos' : undefined,
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
