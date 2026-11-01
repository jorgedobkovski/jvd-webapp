import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { formatarReais } from '../../compartilhado/formatadores';
import { Pagina } from '../../compartilhado/modelos';
import { Paginacao } from '../../compartilhado/paginacao';
import { CatalogoApi, FiltroDoCatalogo, Servico, paramsDoCatalogo } from './catalogo-api';

type Situacao = 'todos' | 'ativos' | 'inativos';

/** Catálogo de serviços (só o gestor chega aqui; a rota é protegida e a API também). */
@Component({
  selector: 'jvd-catalogo-lista',
  imports: [RouterLink, FormField, Paginacao],
  templateUrl: './catalogo-lista.html',
})
export class CatalogoLista {
  private readonly api = inject(CatalogoApi);
  protected readonly reais = formatarReais;

  protected readonly modelo = signal({ busca: '', situacao: 'todos' as Situacao });
  protected readonly formulario = form(this.modelo);

  private readonly filtro = signal<FiltroDoCatalogo>({ pagina: 1 });

  protected readonly resultado = httpResource<Pagina<Servico>>(() => ({
    url: this.api.url,
    params: paramsDoCatalogo(this.filtro()),
  }));

  protected readonly itens = computed(() => (this.resultado.hasValue() ? this.resultado.value().itens : []));
  protected readonly pagina = computed(() => this.filtro().pagina ?? 1);
  protected readonly tamanho = computed(() => this.filtro().tamanho ?? 20);
  protected readonly total = computed(() => (this.resultado.hasValue() ? this.resultado.value().total : 0));

  protected buscar(): void {
    const { busca, situacao } = this.modelo();
    this.filtro.set({ busca, ativo: situacao === 'todos' ? undefined : situacao === 'ativos', pagina: 1 });
  }

  protected irParaPagina(pagina: number): void {
    this.filtro.update((atual) => ({ ...atual, pagina }));
  }

  protected tentarDeNovo(): void {
    this.resultado.reload();
  }
}
