import { signal } from '@angular/core';
import { Cliente } from './clientes/clientes-api';
import { Equipamento } from './equipamentos/equipamentos-api';

/** Dados sintéticos (nunca reais) e apoios comuns dos testes das telas de cadastro. */
export function clienteSintetico(sobrescrever: Partial<Cliente> = {}): Cliente {
  return {
    id: 'cli-1',
    nomeRazaoSocial: 'Mercado Teste Ltda',
    nomeFantasia: 'Mercado Teste',
    documento: '12345678000195',
    inscricaoEstadualRg: '123',
    logradouro: 'Rua Teste',
    numero: '10',
    bairro: 'Centro',
    cep: '76800000',
    cidade: 'Porto Velho',
    uf: 'RO',
    telefone: '(69) 0000-0000',
    email: 'contato@exemplo.com',
    cadastroIncompleto: false,
    origem: 'Manual',
    ativo: true,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 'v1',
    ...sobrescrever,
  };
}

export function equipamentoSintetico(sobrescrever: Partial<Equipamento> = {}): Equipamento {
  return {
    id: 'eq-1',
    clienteId: 'cli-1',
    clienteNome: 'Mercado Teste Ltda',
    descricao: 'Balança Teste',
    numeroSerie: 'SERIE-1',
    numeroInmetro: 'INMETRO-1',
    observacoes: null,
    ativo: true,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 'ev1',
    ...sobrescrever,
  };
}

/** Sessão falsa só com o que as telas leem. */
export function sessaoFalsa(gestor: boolean) {
  const ehGestor = signal(gestor);
  return { ehGestor: ehGestor.asReadonly(), usuario: signal({ id: 'u', nome: 'Usuário', perfil: gestor ? 'Gestor' : 'Tecnico', deveTrocarSenha: false }).asReadonly() };
}
