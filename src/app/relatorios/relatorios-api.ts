import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../core/api-url';

export type StatusRelatorio = 'Rascunho' | 'Emitido' | 'Cancelado';
export type TipoServico = 'Corretiva' | 'Preventiva' | 'Instalacao' | 'Inspecao';
export type ViaDoRelatorio = 'controle' | 'cliente' | 'fiscalizacao';

export const TIPOS_DE_SERVICO: readonly { valor: TipoServico; rotulo: string }[] = [
  { valor: 'Corretiva', rotulo: 'Manutenção corretiva' },
  { valor: 'Preventiva', rotulo: 'Manutenção preventiva' },
  { valor: 'Instalacao', rotulo: 'Instalação' },
  { valor: 'Inspecao', rotulo: 'Inspeção' },
];

export const VIAS: readonly { valor: ViaDoRelatorio; rotulo: string }[] = [
  { valor: 'cliente', rotulo: 'Via do cliente' },
  { valor: 'controle', rotulo: 'Via de controle' },
  { valor: 'fiscalizacao', rotulo: 'Via de fiscalização' },
];

export function rotuloDoTipo(tipo: string): string {
  return TIPOS_DE_SERVICO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

export interface RelatorioResumo {
  id: string;
  numero: number | null;
  numeroFormatado: string | null;
  status: StatusRelatorio;
  tipoServico: TipoServico;
  dataServico: string;
  clienteId: string;
  clienteNome: string;
  equipamentoId: string;
  equipamentoDescricao: string;
  tecnicoId: string;
  tecnicoNome: string;
  totalGeral: number;
  revisao: number;
}

export interface SnapshotDoCliente {
  nome: string;
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
}

export interface SnapshotDoEquipamento {
  descricao: string;
  numeroSerie: string | null;
  numeroInmetro: string | null;
}

export interface RelatorioDetalhe extends RelatorioResumo {
  servicoExecutado: string;
  observacoes: string | null;
  verificacaoAnteriorData: string | null;
  verificacaoAnteriorCertificado: string | null;
  numeroSeloReparador: string | null;
  garantiaDias: number;
  garantiaExtenso: string;
  total: number;
  desconto: number;
  catalogoServicoId: string | null;
  cliente: SnapshotDoCliente | null;
  equipamento: SnapshotDoEquipamento | null;
  emitidoEm: string | null;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  criadoEm: string;
  atualizadoEm: string;
  versao: string;
}

/** Corpo do rascunho. `tecnicoId` só vale para o gestor; omitido = o próprio usuário (criar) ou o atual (editar). */
export interface DadosDoRascunho {
  clienteId: string;
  equipamentoId: string;
  tecnicoId: string | null;
  tipoServico: TipoServico;
  dataServico: string;
  servicoExecutado: string;
  observacoes: string;
  verificacaoAnteriorData: string | null;
  verificacaoAnteriorCertificado: string;
  numeroSeloReparador: string;
  garantiaDias: number;
  total: number;
  desconto: number;
  catalogoServicoId: string | null;
}

/** Corpo da retificação: cliente, balança e executor NÃO mudam por aqui (a API também ignora). */
export interface DadosDaRetificacao {
  motivo: string;
  atualizarDadosDeCadastro: boolean;
  tipoServico: TipoServico;
  dataServico: string;
  servicoExecutado: string;
  observacoes: string;
  verificacaoAnteriorData: string | null;
  verificacaoAnteriorCertificado: string;
  numeroSeloReparador: string;
  garantiaDias: number;
  total: number;
  desconto: number;
  catalogoServicoId: string | null;
}

/** Uma retificação do histórico: JSON só com os campos que mudaram (antes e depois); pode conter dados pessoais. */
export interface RevisaoDoRelatorio {
  revisao: number;
  retificadoEm: string;
  retificadoPor: string;
  retificadoPorNome: string;
  motivo: string;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
}

export interface FiltroDeRelatorios {
  numero?: number;
  status?: StatusRelatorio;
  tipo?: TipoServico;
  de?: string;
  ate?: string;
  clienteId?: string;
  equipamentoId?: string;
  pagina?: number;
  tamanho?: number;
}

export function paramsDeRelatorios(f: FiltroDeRelatorios): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (f.numero !== undefined) params['numero'] = f.numero;
  if (f.status) params['status'] = f.status;
  if (f.tipo) params['tipo'] = f.tipo;
  if (f.de) params['de'] = f.de;
  if (f.ate) params['ate'] = f.ate;
  if (f.clienteId) params['clienteId'] = f.clienteId;
  if (f.equipamentoId) params['equipamentoId'] = f.equipamentoId;
  params['pagina'] = f.pagina ?? 1;
  params['tamanho'] = f.tamanho ?? 20;
  return params;
}

/** Rótulo curto do estado para etiquetas: "Rascunho", "Emitido", "Retificado — revisão 2", "Cancelado". */
export function rotuloDoEstado(r: Pick<RelatorioResumo, 'status' | 'revisao'>): string {
  if (r.status === 'Emitido' && r.revisao > 0) return `Retificado — revisão ${r.revisao}`;
  return r.status;
}

@Service()
export class RelatoriosApi {
  private readonly http = inject(HttpClient);
  readonly url = `${inject(API_URL)}/relatorios`;

  obter(id: string): Promise<RelatorioDetalhe> {
    return firstValueFrom(this.http.get<RelatorioDetalhe>(`${this.url}/${encodeURIComponent(id)}`));
  }

  /** O relatório emitido mais recente de uma balança que a pessoa enxerga (o técnico só vê os seus), ou `null`. */
  async ultimoEmitidoDoEquipamento(equipamentoId: string): Promise<RelatorioDetalhe | null> {
    const pagina = await firstValueFrom(
      this.http.get<{ itens: RelatorioResumo[] }>(this.url, { params: paramsDeRelatorios({ equipamentoId, status: 'Emitido', tamanho: 1 }) }),
    );
    const ultimo = pagina.itens[0];
    return ultimo ? this.obter(ultimo.id) : null;
  }

  criar(dados: DadosDoRascunho): Promise<RelatorioDetalhe> {
    return firstValueFrom(this.http.post<RelatorioDetalhe>(this.url, dados));
  }

  atualizar(id: string, dados: DadosDoRascunho, versao: string): Promise<RelatorioDetalhe> {
    return firstValueFrom(this.http.put<RelatorioDetalhe>(`${this.url}/${encodeURIComponent(id)}`, { ...dados, versao }));
  }

  descartar(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.url}/${encodeURIComponent(id)}`));
  }

  emitir(id: string, versao: string): Promise<RelatorioDetalhe> {
    return firstValueFrom(this.http.post<RelatorioDetalhe>(`${this.url}/${encodeURIComponent(id)}/emitir`, { versao }));
  }

  retificar(id: string, dados: DadosDaRetificacao, versao: string): Promise<RelatorioDetalhe> {
    return firstValueFrom(this.http.post<RelatorioDetalhe>(`${this.url}/${encodeURIComponent(id)}/retificar`, { ...dados, versao }));
  }

  cancelar(id: string, motivo: string, versao: string): Promise<RelatorioDetalhe> {
    return firstValueFrom(this.http.post<RelatorioDetalhe>(`${this.url}/${encodeURIComponent(id)}/cancelar`, { motivo, versao }));
  }

  listarRevisoes(id: string): Promise<RevisaoDoRelatorio[]> {
    return firstValueFrom(this.http.get<RevisaoDoRelatorio[]>(`${this.url}/${encodeURIComponent(id)}/revisoes`));
  }

  /** O PDF exige o token; por isso vem como arquivo na memória (não como link direto) e o chamador o baixa. */
  baixarPdf(id: string, via: ViaDoRelatorio): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.url}/${encodeURIComponent(id)}/pdf`, { params: { via }, responseType: 'blob' }),
    );
  }
}
