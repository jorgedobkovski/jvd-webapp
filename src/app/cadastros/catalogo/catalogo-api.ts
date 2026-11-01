import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Aviso, Pagina } from '../../compartilhado/modelos';
import { API_URL } from '../../core/api-url';

export interface Servico {
  id: string;
  codigoOrigem: string | null;
  descricao: string;
  precoSugerido: number | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  versao: string;
}

/** Corpo de criação/edição: `precoSugerido` nulo = sem preço sugerido. */
export interface DadosDoServico {
  descricao: string;
  codigoOrigem: string;
  precoSugerido: number | null;
}

export interface ServicoSalvo {
  servico: Servico;
  avisos: Aviso[];
}

export interface FiltroDoCatalogo {
  busca?: string;
  ativo?: boolean;
  pagina?: number;
  tamanho?: number;
}

export function paramsDoCatalogo(f: FiltroDoCatalogo): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (f.busca?.trim()) params['busca'] = f.busca.trim();
  if (f.ativo !== undefined) params['ativo'] = f.ativo;
  params['pagina'] = f.pagina ?? 1;
  params['tamanho'] = f.tamanho ?? 20;
  return params;
}

@Service()
export class CatalogoApi {
  private readonly http = inject(HttpClient);
  readonly url = `${inject(API_URL)}/catalogo-servicos`;

  /** Serviços ativos (até 100) para sugerir o texto e o preço no relatório. O técnico só recebe ativos. */
  async listarAtivos(): Promise<Servico[]> {
    const pagina = await firstValueFrom(this.http.get<Pagina<Servico>>(this.url, { params: paramsDoCatalogo({ ativo: true, tamanho: 100 }) }));
    return pagina.itens;
  }

  obter(id: string): Promise<Servico> {
    return firstValueFrom(this.http.get<Servico>(`${this.url}/${encodeURIComponent(id)}`));
  }

  criar(dados: DadosDoServico): Promise<ServicoSalvo> {
    return firstValueFrom(this.http.post<ServicoSalvo>(this.url, dados));
  }

  atualizar(id: string, dados: DadosDoServico, versao: string): Promise<ServicoSalvo> {
    return firstValueFrom(this.http.put<ServicoSalvo>(`${this.url}/${encodeURIComponent(id)}`, { ...dados, versao }));
  }

  desativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/desativar`, {}));
  }

  reativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/reativar`, {}));
  }
}
