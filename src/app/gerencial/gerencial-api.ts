import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../core/api-url';
import { TipoServico } from '../relatorios/relatorios-api';

export interface TotaisDoPeriodo {
  quantidade: number;
  total: number;
  descontos: number;
  totalGeral: number;
  ticketMedio: number;
}

export interface IndicadorPorExecutor {
  tecnicoId: string;
  tecnicoNome: string;
  quantidade: number;
  totalGeral: number;
}

export interface IndicadorPorTipo {
  tipo: TipoServico;
  quantidade: number;
  totalGeral: number;
}

export interface IndicadorPorCliente {
  clienteId: string;
  clienteNome: string;
  quantidade: number;
  totalGeral: number;
}

/** Indicadores do período (só relatórios emitidos; cancelados e rascunhos nunca entram). Rankings do maior para o menor valor. */
export interface Indicadores {
  de: string | null;
  ate: string | null;
  totais: TotaisDoPeriodo;
  porExecutor: IndicadorPorExecutor[];
  porTipo: IndicadorPorTipo[];
  maioresClientes: IndicadorPorCliente[];
}

export interface FiltroDeIndicadores {
  de?: string;
  ate?: string;
}

/** Os mesmos filtros da listagem de relatórios; o status é sempre "emitido" no servidor. */
export interface FiltroDeExportacao extends FiltroDeIndicadores {
  clienteId?: string;
  tecnicoId?: string;
  tipo?: TipoServico;
}

export function paramsDeIndicadores(f: FiltroDeIndicadores): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.de) params['de'] = f.de;
  if (f.ate) params['ate'] = f.ate;
  return params;
}

export function paramsDeExportacao(f: FiltroDeExportacao): Record<string, string> {
  const params = paramsDeIndicadores(f);
  if (f.clienteId) params['clienteId'] = f.clienteId;
  if (f.tecnicoId) params['tecnicoId'] = f.tecnicoId;
  if (f.tipo) params['tipo'] = f.tipo;
  return params;
}

/** Nome do arquivo baixado, montado só com as datas do filtro (nunca com dado digitado). */
export function nomeDaPlanilha(f: FiltroDeIndicadores): string {
  if (f.de && f.ate) return `relatorios-emitidos-${f.de}-a-${f.ate}.xlsx`;
  if (f.de) return `relatorios-emitidos-desde-${f.de}.xlsx`;
  if (f.ate) return `relatorios-emitidos-ate-${f.ate}.xlsx`;
  return 'relatorios-emitidos.xlsx';
}

/** Visão gerencial (só gestor): valores, indicadores e exportação. A exportação chega como arquivo na memória (exige o token). */
@Service()
export class GerencialApi {
  private readonly http = inject(HttpClient);
  readonly urlDosIndicadores = `${inject(API_URL)}/gerencial/indicadores`;
  private readonly urlDaExportacao = `${inject(API_URL)}/gerencial/exportar-relatorios`;

  exportar(filtro: FiltroDeExportacao): Promise<Blob> {
    return firstValueFrom(this.http.get(this.urlDaExportacao, { params: paramsDeExportacao(filtro), responseType: 'blob' }));
  }
}
