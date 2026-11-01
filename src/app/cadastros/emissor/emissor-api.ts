import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/api-url';

export interface Emissor {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  inscricaoEstadual: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  telefones: string | null;
  numeroAutorizacaoIpem: string | null;
  responsavelTecnicoNome: string | null;
  responsavelTecnicoCpf: string | null;
  atualizadoEm: string;
  versao: string;
}

export interface DadosDoEmissor {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  telefones: string;
  numeroAutorizacaoIpem: string;
  responsavelTecnicoNome: string;
  responsavelTecnicoCpf: string;
}

@Service()
export class EmissorApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/emissor`;

  /** `null` enquanto o emissor nunca foi configurado (a API responde 404). */
  async obter(): Promise<Emissor | null> {
    try {
      return await firstValueFrom(this.http.get<Emissor>(this.url));
    } catch (erro) {
      if (erro instanceof HttpErrorResponse && erro.status === 404) return null;
      throw erro;
    }
  }

  /** Primeira gravação sem `versao`; depois, sempre com a versão que a pessoa viu. */
  salvar(dados: DadosDoEmissor, versao: string | null): Promise<Emissor> {
    return firstValueFrom(this.http.put<Emissor>(this.url, versao === null ? dados : { ...dados, versao }));
  }
}
