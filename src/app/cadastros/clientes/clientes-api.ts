import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/api-url';
import { Aviso, Pagina } from '../../compartilhado/modelos';

export interface Cliente {
  id: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string | null;
  inscricaoEstadualRg: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  cadastroIncompleto: boolean;
  origem: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  versao: string;
}

/** Campos editáveis (textos vazios = "sem valor"; a API apara e normaliza). */
export interface DadosDoCliente {
  nomeRazaoSocial: string;
  nomeFantasia: string;
  documento: string;
  inscricaoEstadualRg: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
}

export interface ClienteSalvo {
  cliente: Cliente;
  avisos: Aviso[];
}

export interface FiltroDeClientes {
  busca?: string;
  uf?: string;
  ativo?: boolean;
  incompleto?: boolean;
  pagina?: number;
  tamanho?: number;
}

/** Parâmetros de consulta só com o que foi preenchido (a API trata ausente como "sem filtro"). */
export function paramsDeClientes(f: FiltroDeClientes): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (f.busca?.trim()) params['busca'] = f.busca.trim();
  if (f.uf) params['uf'] = f.uf;
  if (f.ativo !== undefined) params['ativo'] = f.ativo;
  if (f.incompleto) params['incompleto'] = true;
  params['pagina'] = f.pagina ?? 1;
  params['tamanho'] = f.tamanho ?? 20;
  return params;
}

/** Chamadas de clientes. As listas e o detalhe usam `httpResource` nas telas; aqui ficam as operações e buscas pontuais. */
@Service()
export class ClientesApi {
  private readonly http = inject(HttpClient);
  readonly url = `${inject(API_URL)}/clientes`;

  listar(filtro: FiltroDeClientes): Promise<Pagina<Cliente>> {
    return firstValueFrom(this.http.get<Pagina<Cliente>>(this.url, { params: paramsDeClientes(filtro) }));
  }

  obter(id: string): Promise<Cliente> {
    return firstValueFrom(this.http.get<Cliente>(`${this.url}/${encodeURIComponent(id)}`));
  }

  criar(dados: DadosDoCliente): Promise<ClienteSalvo> {
    return firstValueFrom(this.http.post<ClienteSalvo>(this.url, dados));
  }

  atualizar(id: string, dados: DadosDoCliente, versao: string): Promise<ClienteSalvo> {
    return firstValueFrom(this.http.put<ClienteSalvo>(`${this.url}/${encodeURIComponent(id)}`, { ...dados, versao }));
  }

  desativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/desativar`, {}));
  }

  reativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/reativar`, {}));
  }
}
