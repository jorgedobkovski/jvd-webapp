import { RelatorioDetalhe, RelatorioResumo } from './relatorios-api';

/** Dados sintéticos (nunca reais) dos testes das telas de relatório. */
export function resumoSintetico(sobrescrever: Partial<RelatorioResumo> = {}): RelatorioResumo {
  return {
    id: 'r-1',
    numero: 42,
    numeroFormatado: '000042',
    status: 'Emitido',
    tipoServico: 'Corretiva',
    dataServico: '2026-10-30',
    clienteId: 'cli-1',
    clienteNome: 'Mercado Teste Ltda',
    equipamentoId: 'eq-1',
    equipamentoDescricao: 'Balança Teste',
    tecnicoId: 'u-1',
    tecnicoNome: 'Técnico Sintético',
    totalGeral: 140,
    revisao: 0,
    ...sobrescrever,
  };
}

export function detalheSintetico(sobrescrever: Partial<RelatorioDetalhe> = {}): RelatorioDetalhe {
  return {
    ...resumoSintetico(),
    servicoExecutado: 'Troca da célula de carga',
    observacoes: 'Sem observações extras',
    verificacaoAnteriorData: '2025-10-01',
    verificacaoAnteriorCertificado: 'CERT-123',
    numeroSeloReparador: 'SELO-9',
    garantiaDias: 30,
    garantiaExtenso: '30 dias (trinta)',
    total: 150,
    desconto: 10,
    catalogoServicoId: null,
    cliente: {
      nome: 'Mercado Teste Ltda',
      nomeFantasia: null,
      documento: '12345678000195',
      inscricaoEstadualRg: null,
      logradouro: 'Rua Teste',
      numero: '10',
      bairro: 'Centro',
      cep: '76800000',
      cidade: 'Porto Velho',
      uf: 'RO',
      telefone: null,
    },
    equipamento: { descricao: 'Balança Teste', numeroSerie: 'SERIE-1', numeroInmetro: 'INMETRO-1' },
    emitidoEm: '2026-10-30T12:00:00Z',
    canceladoEm: null,
    motivoCancelamento: null,
    criadoEm: '2026-10-30T10:00:00Z',
    atualizadoEm: '2026-10-30T12:00:00Z',
    versao: 'v1',
    ...sobrescrever,
  };
}
