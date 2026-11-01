import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Pagina } from '../../compartilhado/modelos';
import { Paginacao } from '../../compartilhado/paginacao';
import { Perfil } from '../../core/modelos';
import { FiltroDeUsuarios, UsuarioDoSistema, UsuariosApi, paramsDeUsuarios } from './usuarios-api';

type Situacao = 'todos' | 'ativos' | 'inativos';
type PerfilFiltro = Perfil | '';

@Component({
  selector: 'jvd-usuarios-lista',
  imports: [RouterLink, FormField, Paginacao],
  templateUrl: './usuarios-lista.html',
})
export class UsuariosLista {
  private readonly api = inject(UsuariosApi);

  protected readonly modelo = signal({ busca: '', perfil: '' as PerfilFiltro, situacao: 'todos' as Situacao });
  protected readonly formulario = form(this.modelo);

  private readonly filtro = signal<FiltroDeUsuarios>({ pagina: 1 });

  protected readonly resultado = httpResource<Pagina<UsuarioDoSistema>>(() => ({
    url: this.api.url,
    params: paramsDeUsuarios(this.filtro()),
  }));

  protected readonly itens = computed(() => (this.resultado.hasValue() ? this.resultado.value().itens : []));
  protected readonly pagina = computed(() => this.filtro().pagina ?? 1);
  protected readonly tamanho = computed(() => this.filtro().tamanho ?? 20);
  protected readonly total = computed(() => (this.resultado.hasValue() ? this.resultado.value().total : 0));

  protected buscar(): void {
    const { busca, perfil, situacao } = this.modelo();
    this.filtro.set({
      busca,
      perfil: perfil || undefined,
      ativo: situacao === 'todos' ? undefined : situacao === 'ativos',
      pagina: 1,
    });
  }

  protected irParaPagina(pagina: number): void {
    this.filtro.update((atual) => ({ ...atual, pagina }));
  }

  protected tentarDeNovo(): void {
    this.resultado.reload();
  }

  protected nomeDoPerfil(perfil: Perfil): string {
    return perfil === 'Gestor' ? 'Gestor' : 'Técnico';
  }
}
