import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../core/api-url';

export type TipoDeImportacao = 'clientes' | 'servicos';

export const TIPOS_DE_IMPORTACAO: readonly { valor: TipoDeImportacao; rotulo: string; ajuda: string }[] = [
  { valor: 'clientes', rotulo: 'Clientes', ajuda: 'Planilha de clientes exportada do ERP (.xlsx).' },
  { valor: 'servicos', rotulo: 'Serviços (catálogo)', ajuda: 'Planilha de mercadorias do ERP (.xlsx); entra só o grupo SERVIÇOS.' },
];

/** Limite do envio (a API também recusa acima de 10 MB). */
export const TAMANHO_MAXIMO_DA_PLANILHA = 10 * 1024 * 1024;

export interface Ocorrencia {
  linha: number;
  gravidade: 'Aviso' | 'Erro';
  /** Texto fixo da API: nunca o conteúdo da linha da planilha (LGPD). */
  motivo: string;
}

export interface RelatorioDeImportacao {
  importacaoId: string | null;
  tipo: string;
  simulacao: boolean;
  totalLidos: number;
  totalImportados: number;
  totalRejeitados: number;
  totalAvisos: number;
  totalIgnoradas: number;
  ocorrencias: Ocorrencia[];
}

export interface ImportacaoResumo {
  id: string;
  tipo: string;
  nomeArquivo: string;
  usuarioId: string;
  executadaEm: string;
  totalLidos: number;
  totalImportados: number;
  totalRejeitados: number;
  totalAvisos: number;
  totalIgnoradas: number;
}

export interface ImportacaoDetalhe {
  importacao: ImportacaoResumo;
  ocorrencias: Ocorrencia[];
}

/**
 * Importação das planilhas do ERP (só gestor). A API **simula por padrão**: só `simular=false` grava. A carga real de
 * `data/` é uma operação à parte, com autorização do Owner (IA/Specs/IMPORTACAO.md).
 */
@Service()
export class ImportacaoApi {
  private readonly http = inject(HttpClient);
  readonly url = `${inject(API_URL)}/importacoes`;

  enviar(tipo: TipoDeImportacao, arquivo: File, simular: boolean): Promise<RelatorioDeImportacao> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo, arquivo.name);
    return firstValueFrom(this.http.post<RelatorioDeImportacao>(`${this.url}/${tipo}`, corpo, { params: { simular } }));
  }

  obter(id: string): Promise<ImportacaoDetalhe> {
    return firstValueFrom(this.http.get<ImportacaoDetalhe>(`${this.url}/${encodeURIComponent(id)}`));
  }
}
