import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { UsuarioDoSistema, UsuariosApi } from '../cadastros/usuarios/usuarios-api';
import { formatarData } from '../compartilhado/datas';
import { formatarReais } from '../compartilhado/formatadores';
import { Pagina } from '../compartilhado/modelos';
import { Paginacao } from '../compartilhado/paginacao';
import { ClienteEscolhido, SeletorDeCliente } from '../compartilhado/seletor-de-cliente';
import { Sessao } from '../core/sessao';
import { FiltroDeRelatorios, RelatorioResumo, RelatoriosApi, StatusRelatorio, TIPOS_DE_SERVICO, TipoServico, paramsDeRelatorios, rotuloDoEstado, rotuloDoTipo } from './relatorios-api';

/** "Meus relatórios": o técnico vê só os seus (a API aplica a regra); o gestor, todos. */
@Component({
  selector: 'jvd-relatorios-lista',
  imports: [RouterLink, FormField, Paginacao, SeletorDeCliente],
  templateUrl: './relatorios-lista.html',
})
export class RelatoriosLista {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(RelatoriosApi);
  private readonly usuariosApi = inject(UsuariosApi);

  protected readonly tipos = TIPOS_DE_SERVICO;
  protected readonly data = formatarData;
  protected readonly reais = formatarReais;
  protected readonly estado = rotuloDoEstado;
  protected readonly tipo = rotuloDoTipo;

  protected readonly modelo = signal({ numero: '', status: '' as StatusRelatorio | '', tipo: '' as TipoServico | '', de: '', ate: '', tecnicoId: '' });
  protected readonly formulario = form(this.modelo, (f) => {
    validate(f.numero, ({ value }) => (value() !== '' && !/^\d{1,9}$/.test(value().trim()) ? { kind: 'numero', message: 'Use só números.' } : undefined));
    validate(f.ate, ({ value, valueOf }) =>
      value() !== '' && valueOf(f.de) !== '' && value() < valueOf(f.de) ? { kind: 'periodo', message: 'A data final não pode ser anterior à inicial.' } : undefined,
    );
  });

  // Filtros só do gestor: executor e cliente
  protected readonly executores = signal<UsuarioDoSistema[]>([]);
  protected readonly cliente = signal<ClienteEscolhido | null>(null);

  private readonly filtro = signal<FiltroDeRelatorios>({ pagina: 1 });

  protected readonly resultado = httpResource<Pagina<RelatorioResumo>>(() => ({
    url: this.api.url,
    params: paramsDeRelatorios(this.filtro()),
  }));

  protected readonly itens = computed(() => (this.resultado.hasValue() ? this.resultado.value().itens : []));
  protected readonly pagina = computed(() => this.filtro().pagina ?? 1);
  protected readonly tamanho = computed(() => this.filtro().tamanho ?? 20);
  protected readonly total = computed(() => (this.resultado.hasValue() ? this.resultado.value().total : 0));

  constructor() {
    if (this.sessao.ehGestor()) void this.carregarExecutores();
  }

  private async carregarExecutores(): Promise<void> {
    try {
      this.executores.set(await this.usuariosApi.listarTodos());
    } catch {
      // sem a lista, o filtro por executor simplesmente não aparece
    }
  }

  protected buscar(): void {
    if (this.formulario().invalid()) return;
    const { numero, status, tipo, de, ate, tecnicoId } = this.modelo();
    this.filtro.set({
      numero: numero.trim() === '' ? undefined : Number(numero.trim()),
      status: status || undefined,
      tipo: tipo || undefined,
      de: de || undefined,
      ate: ate || undefined,
      // Executor e cliente são do gestor; para o técnico a tela nem os mostra
      tecnicoId: this.sessao.ehGestor() ? tecnicoId || undefined : undefined,
      clienteId: this.sessao.ehGestor() ? this.cliente()?.id : undefined,
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
