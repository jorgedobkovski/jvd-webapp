import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Pagina } from '../../compartilhado/modelos';
import { API_URL } from '../../core/api-url';
import { Perfil } from '../../core/modelos';

export interface UsuarioDoSistema {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  cpf: string | null;
  ativo: boolean;
  deveTrocarSenha: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosDoUsuario {
  nome: string;
  perfil: Perfil;
  cpf: string;
}

export interface NovoUsuario extends DadosDoUsuario {
  email: string;
  senhaProvisoria: string;
}

export interface FiltroDeUsuarios {
  busca?: string;
  perfil?: Perfil;
  ativo?: boolean;
  pagina?: number;
  tamanho?: number;
}

export function paramsDeUsuarios(f: FiltroDeUsuarios): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (f.busca?.trim()) params['busca'] = f.busca.trim();
  if (f.perfil) params['perfil'] = f.perfil;
  if (f.ativo !== undefined) params['ativo'] = f.ativo;
  params['pagina'] = f.pagina ?? 1;
  params['tamanho'] = f.tamanho ?? 20;
  return params;
}

/** Gestão de usuários (só gestor). A senha provisória só trafega na criação e na redefinição, nunca é guardada aqui. */
@Service()
export class UsuariosApi {
  private readonly http = inject(HttpClient);
  readonly url = `${inject(API_URL)}/usuarios`;

  /** Todos os usuários (até 100, ativos e inativos), para o gestor filtrar relatórios por executor. */
  async listarTodos(): Promise<UsuarioDoSistema[]> {
    const pagina = await firstValueFrom(this.http.get<Pagina<UsuarioDoSistema>>(this.url, { params: paramsDeUsuarios({ tamanho: 100 }) }));
    return pagina.itens;
  }

  /** Usuários ativos (até 100), para o gestor escolher o executor de um relatório. */
  async listarAtivos(): Promise<UsuarioDoSistema[]> {
    const pagina = await firstValueFrom(this.http.get<Pagina<UsuarioDoSistema>>(this.url, { params: paramsDeUsuarios({ ativo: true, tamanho: 100 }) }));
    return pagina.itens;
  }

  obter(id: string): Promise<UsuarioDoSistema> {
    return firstValueFrom(this.http.get<UsuarioDoSistema>(`${this.url}/${encodeURIComponent(id)}`));
  }

  criar(dados: NovoUsuario): Promise<UsuarioDoSistema> {
    return firstValueFrom(this.http.post<UsuarioDoSistema>(this.url, dados));
  }

  atualizar(id: string, dados: DadosDoUsuario): Promise<UsuarioDoSistema> {
    return firstValueFrom(this.http.put<UsuarioDoSistema>(`${this.url}/${encodeURIComponent(id)}`, dados));
  }

  desativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/desativar`, {}));
  }

  reativar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/reativar`, {}));
  }

  redefinirSenha(id: string, novaSenhaProvisoria: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/${encodeURIComponent(id)}/redefinir-senha`, { novaSenhaProvisoria }));
  }
}
