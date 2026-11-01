import { paramsDeClientes } from './clientes-api';
import { paramsDeEquipamentos } from '../equipamentos/equipamentos-api';

describe('parâmetros de consulta', () => {
  it('clientes: só envia o que foi preenchido, com página e tamanho padrão', () => {
    expect(paramsDeClientes({})).toEqual({ pagina: 1, tamanho: 20 });
    expect(paramsDeClientes({ busca: '  Mercado  ', uf: 'RO', ativo: false, incompleto: true, pagina: 3 })).toEqual({
      busca: 'Mercado',
      uf: 'RO',
      ativo: false,
      incompleto: true,
      pagina: 3,
      tamanho: 20,
    });
    expect(paramsDeClientes({ busca: '   ', uf: '', incompleto: false })).toEqual({ pagina: 1, tamanho: 20 });
  });

  it('equipamentos: filtra por cliente e situação', () => {
    expect(paramsDeEquipamentos({})).toEqual({ pagina: 1, tamanho: 20 });
    expect(paramsDeEquipamentos({ clienteId: 'abc', ativo: true, tamanho: 100 })).toEqual({ clienteId: 'abc', ativo: true, pagina: 1, tamanho: 100 });
  });
});
