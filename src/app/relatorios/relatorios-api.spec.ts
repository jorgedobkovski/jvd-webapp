import { paramsDeRelatorios, rotuloDoEstado, rotuloDoTipo } from './relatorios-api';

describe('relatorios-api', () => {
  it('parâmetros: só envia o preenchido, com página e tamanho padrão', () => {
    expect(paramsDeRelatorios({})).toEqual({ pagina: 1, tamanho: 20 });
    expect(paramsDeRelatorios({ numero: 0, status: 'Emitido', tipo: 'Corretiva', de: '2026-10-01', ate: '2026-10-31', clienteId: 'c', equipamentoId: 'e', tecnicoId: 't', pagina: 2, tamanho: 5 })).toEqual({
      numero: 0, status: 'Emitido', tipo: 'Corretiva', de: '2026-10-01', ate: '2026-10-31', clienteId: 'c', equipamentoId: 'e', tecnicoId: 't', pagina: 2, tamanho: 5,
    });
  });

  it('rótulo do estado destaca a retificação', () => {
    expect(rotuloDoEstado({ status: 'Rascunho', revisao: 0 })).toBe('Rascunho');
    expect(rotuloDoEstado({ status: 'Emitido', revisao: 0 })).toBe('Emitido');
    expect(rotuloDoEstado({ status: 'Emitido', revisao: 2 })).toBe('Retificado — revisão 2');
    expect(rotuloDoEstado({ status: 'Cancelado', revisao: 2 })).toBe('Cancelado');
  });

  it('rótulo do tipo de serviço', () => {
    expect(rotuloDoTipo('Instalacao')).toBe('Instalação');
    expect(rotuloDoTipo('Inspecao')).toBe('Inspeção');
    expect(rotuloDoTipo('Outro')).toBe('Outro');
  });
});
