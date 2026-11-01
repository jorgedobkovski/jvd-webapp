import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, validate } from '@angular/forms/signals';
import { UsuarioDoSistema, UsuariosApi } from '../cadastros/usuarios/usuarios-api';
import { salvarArquivo } from '../compartilhado/arquivos';
import { esteAno, esteMes, hoje, mesPassado } from '../compartilhado/datas';
import { formatarReais } from '../compartilhado/formatadores';
import { ClienteEscolhido, SeletorDeCliente } from '../compartilhado/seletor-de-cliente';
import { lerErroDeArquivo } from '../core/erros';
import { TIPOS_DE_SERVICO, TipoServico, rotuloDoTipo } from '../relatorios/relatorios-api';
import { FiltroDeExportacao, GerencialApi, Indicadores, nomeDaPlanilha, paramsDeIndicadores } from './gerencial-api';

/** Visão do gestor: indicadores do período (só relatórios emitidos) e exportação da planilha com os filtros aplicados. */
@Component({
  selector: 'jvd-indicadores',
  imports: [FormField, SeletorDeCliente],
  templateUrl: './indicadores.html',
})
export class IndicadoresPagina {
  private readonly api = inject(GerencialApi);
  private readonly usuariosApi = inject(UsuariosApi);

  protected readonly tipos = TIPOS_DE_SERVICO;
  protected readonly reais = formatarReais;
  protected readonly rotuloDoTipo = rotuloDoTipo;

  protected readonly modelo = signal({ de: esteMes(hoje()).de, ate: esteMes(hoje()).ate, tipo: '' as TipoServico | '', tecnicoId: '' });
  protected readonly formulario = form(this.modelo, (f) => {
    validate(f.ate, ({ value, valueOf }) =>
      value() !== '' && valueOf(f.de) !== '' && value() < valueOf(f.de) ? { kind: 'periodo', message: 'A data final não pode ser anterior à inicial.' } : undefined,
    );
  });

  protected readonly executores = signal<UsuarioDoSistema[]>([]);
  protected readonly cliente = signal<ClienteEscolhido | null>(null);

  /** Filtro aplicado: os indicadores usam só o período; a planilha usa todos. */
  protected readonly filtro = signal<FiltroDeExportacao>({ de: this.modelo().de, ate: this.modelo().ate });

  protected readonly resultado = httpResource<Indicadores>(() => ({
    url: this.api.urlDosIndicadores,
    params: paramsDeIndicadores(this.filtro()),
  }));

  protected readonly indicadores = computed(() => (this.resultado.hasValue() ? this.resultado.value() : null));
  protected readonly vazio = computed(() => this.indicadores()?.totais.quantidade === 0);

  protected readonly exportando = signal(false);
  protected readonly erroDaExportacao = signal<string | null>(null);

  constructor() {
    void this.carregarExecutores();
  }

  private async carregarExecutores(): Promise<void> {
    try {
      this.executores.set(await this.usuariosApi.listarTodos());
    } catch {
      // sem a lista, o filtro por executor simplesmente não aparece
    }
  }

  protected periodoRapido(periodo: 'mes' | 'passado' | 'ano'): void {
    const { de, ate } = periodo === 'mes' ? esteMes(hoje()) : periodo === 'passado' ? mesPassado(hoje()) : esteAno(hoje());
    this.modelo.update((m) => ({ ...m, de, ate }));
    this.atualizar();
  }

  protected atualizar(): void {
    if (this.formulario().invalid()) return;
    const { de, ate, tipo, tecnicoId } = this.modelo();
    this.erroDaExportacao.set(null);
    this.filtro.set({ de: de || undefined, ate: ate || undefined, tipo: tipo || undefined, tecnicoId: tecnicoId || undefined, clienteId: this.cliente()?.id });
  }

  protected async exportar(): Promise<void> {
    if (this.exportando()) return;
    const filtro = this.filtro();
    this.exportando.set(true);
    this.erroDaExportacao.set(null);
    try {
      salvarArquivo(await this.api.exportar(filtro), nomeDaPlanilha(filtro));
    } catch (erro) {
      this.erroDaExportacao.set((await lerErroDeArquivo(erro)).mensagem);
    } finally {
      this.exportando.set(false);
    }
  }

  protected tentarDeNovo(): void {
    this.resultado.reload();
  }
}
