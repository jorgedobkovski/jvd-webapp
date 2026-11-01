import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { formatarData } from '../compartilhado/datas';
import { formatarReais } from '../compartilhado/formatadores';
import { Pagina } from '../compartilhado/modelos';
import { Paginacao } from '../compartilhado/paginacao';
import { Sessao } from '../core/sessao';
import { FiltroDeRelatorios, RelatorioResumo, RelatoriosApi, StatusRelatorio, TIPOS_DE_SERVICO, TipoServico, paramsDeRelatorios, rotuloDoEstado, rotuloDoTipo } from './relatorios-api';

/** "Meus relatórios": o técnico vê só os seus (a API aplica a regra); o gestor, todos. */
@Component({
  selector: 'jvd-relatorios-lista',
  imports: [RouterLink, FormField, Paginacao],
  templateUrl: './relatorios-lista.html',
})
export class RelatoriosLista {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(RelatoriosApi);

  protected readonly tipos = TIPOS_DE_SERVICO;
  protected readonly data = formatarData;
  protected readonly reais = formatarReais;
  protected readonly estado = rotuloDoEstado;
  protected readonly tipo = rotuloDoTipo;

  protected readonly modelo = signal({ numero: '', status: '' as StatusRelatorio | '', tipo: '' as TipoServico | '', de: '', ate: '' });
  protected readonly formulario = form(this.modelo, (f) => {
    validate(f.numero, ({ value }) => (value() !== '' && !/^\d{1,9}$/.test(value().trim()) ? { kind: 'numero', message: 'Use só números.' } : undefined));
    validate(f.ate, ({ value, valueOf }) =>
      value() !== '' && valueOf(f.de) !== '' && value() < valueOf(f.de) ? { kind: 'periodo', message: 'A data final não pode ser anterior à inicial.' } : undefined,
    );
  });

  private readonly filtro = signal<FiltroDeRelatorios>({ pagina: 1 });

  protected readonly resultado = httpResource<Pagina<RelatorioResumo>>(() => ({
    url: this.api.url,
    params: paramsDeRelatorios(this.filtro()),
  }));

  protected readonly itens = computed(() => (this.resultado.hasValue() ? this.resultado.value().itens : []));
  protected readonly pagina = computed(() => this.filtro().pagina ?? 1);
  protected readonly tamanho = computed(() => this.filtro().tamanho ?? 20);
  protected readonly total = computed(() => (this.resultado.hasValue() ? this.resultado.value().total : 0));

  protected buscar(): void {
    if (this.formulario().invalid()) return;
    const { numero, status, tipo, de, ate } = this.modelo();
    this.filtro.set({
      numero: numero.trim() === '' ? undefined : Number(numero.trim()),
      status: status || undefined,
      tipo: tipo || undefined,
      de: de || undefined,
      ate: ate || undefined,
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
