import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/api-url';
import { Aviso, Pagina } from '../../compartilhado/modelos';

export interface Equipamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  descricao: string;
  numeroSerie: string | null;
  numeroInmetro: string | null;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  versao: string;
}

export interface DadosDoEquipamento {
  clienteId: string;
  descricao: string;
  numeroSerie: string;
  numeroInmetro: string;
  observacoes: string;
}

export interface EquipamentoSalvo {
  equipamento: Equipamento;
  avisos: Aviso[];
}

export interface FiltroDeEquipamentos {
  busca?: string;
  clienteId?: string;
  ativo?: boolean;
  pagina?: number;
  tamanho?: number;
}

export function paramsDeEquipamentos(f: FiltroDeEquipamentos): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (f.busca?.trim()) params['busca'] = f.busca.trim();
  if (f.clienteId) params['clienteId'] = f.clienteId;
  if (f.ativo !== undefined) params['ativo'] = f.ativo;
  params['pagina'] = f.pagina ?? 1;
  params['tamanho'] = f.tamanho ?? 20;
  return params;
}

@Service()
export class EquipamentosApi {
  private readonly http = inject(HttpClient);
  readonly url = `${inject(API_URL)}/equipamentos`;

  /** Balanças de um cliente (até 100); o técnico só recebe as ativas. */
  async listarDoCliente(clienteId: string): Promise<Equipamento[]> {
    const pagina = await firstValueFrom(this.http.get<Pagina<Equipamento>>(this.url, { params: paramsDeEquipamentos({ clienteId, ativo: true, tamanho: 100 }) }));
    return pagina.itens;
  }

  obter(id: string): Promise<Equipamento> {
    return firstValueFrom(this.http.get<Equipamento>(`${this.url}/${encodeURIComponent(id)}`));
  }

  criar(dados: DadosDoEquipamento): Promise<EquipamentoSalvo> {
    return firstValueFrom(this.http.post<EquipamentoSalvo>(this.url, dados));
  }

  atualizar(id: string, dados: DadosDoEquipamento, versao: string): Promise<EquipamentoSalvo> {
    return firstValueFrom(this.http.put<EquipamentoSalvo>(`${this.url}/${encodeURIComponent(id)}`, { ...dados, versao }));
  }

  desativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/desativar`, {}));
  }

  reativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/reativar`, {}));
  }
}
