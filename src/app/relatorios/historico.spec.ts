import { mudancasDaRevisao } from './historico';

const reais = (texto: string) => texto.replace(/\s/g, ' ');

describe('mudancasDaRevisao', () => {
  it('formata datas, valores em reais e o tipo de serviço, só dos campos que mudaram', () => {
    const mudancas = mudancasDaRevisao(
      { tipoServico: 'Corretiva', dataServico: '2026-10-30', total: 100, totalGeral: 90 },
      { tipoServico: 'Instalacao', dataServico: '2026-10-31', total: 150.5, totalGeral: 140.5 },
    );

    expect(mudancas.map((m) => [m.campo, reais(m.antes), reais(m.depois)])).toEqual([
      ['Tipo de serviço', 'Manutenção corretiva', 'Instalação'],
      ['Data do serviço', '30/10/2026', '31/10/2026'],
      ['Total', 'R$ 100,00', 'R$ 150,50'],
      ['Total geral', 'R$ 90,00', 'R$ 140,50'],
    ]);
  });

  it('valor ausente ou vazio aparece como traço (campo que passou a existir ou deixou de existir)', () => {
    const [m] = mudancasDaRevisao({ numeroSeloReparador: null }, { numeroSeloReparador: 'SELO-1' });
    expect(m).toEqual({ campo: 'Selo reparador', antes: '—', depois: 'SELO-1' });
    const [n] = mudancasDaRevisao({ observacoes: 'Algo' }, { observacoes: '' });
    expect(n).toEqual({ campo: 'Observações', antes: 'Algo', depois: '—' });
  });

  it('catálogo aparece sem expor o identificador', () => {
    const [m] = mudancasDaRevisao({ catalogoServicoId: null }, { catalogoServicoId: 'a1b2-c3' });
    expect(m).toEqual({ campo: 'Serviço do catálogo', antes: '—', depois: 'Item do catálogo' });
  });

  it('trocar um item do catálogo por outro não vira "Item do catálogo → Item do catálogo"', () => {
    const [m] = mudancasDaRevisao({ catalogoServicoId: 'a' }, { catalogoServicoId: 'b' });
    expect(m).toEqual({ campo: 'Serviço do catálogo', antes: 'Item do catálogo anterior', depois: 'Outro item do catálogo' });
  });

  it('campo que só mudou de nulo para vazio (mesma aparência) não vira linha', () => {
    expect(mudancasDaRevisao({ observacoes: null, total: 10 }, { observacoes: '', total: 10 })).toEqual([]);
  });

  it('cópias do cliente e do equipamento mostram só os subcampos que mudaram, com documento e CEP formatados', () => {
    const mudancas = mudancasDaRevisao(
      { cliente: { nome: 'Mercado A', documento: '12345678000195', cep: '76800000', cidade: 'Porto Velho' }, equipamento: { descricao: 'Balança', numeroSerie: 'S-1' } },
      { cliente: { nome: 'Mercado B', documento: '12345678909', cep: '76800000', cidade: 'Porto Velho' }, equipamento: { descricao: 'Balança', numeroSerie: 'S-2' } },
    );

    expect(mudancas).toEqual([
      { campo: 'Cliente: Nome', antes: 'Mercado A', depois: 'Mercado B' },
      { campo: 'Cliente: CPF/CNPJ', antes: '12.345.678/0001-95', depois: '123.456.789-09' },
      { campo: 'Equipamento: Nº de série', antes: 'S-1', depois: 'S-2' },
    ]);
  });

  it('ignora campos desconhecidos e entradas que não são objeto (nunca mostra chave crua)', () => {
    expect(mudancasDaRevisao({ campoNovoDaApi: 1, senha: 'x' }, { campoNovoDaApi: 2, senha: 'y' })).toEqual([]);
    expect(mudancasDaRevisao(null, undefined)).toEqual([]);
    expect(mudancasDaRevisao('texto', [1, 2])).toEqual([]);
    expect(mudancasDaRevisao({ cliente: 'estranho' }, { cliente: 7 })).toEqual([]);
  });

  it('a ordem segue a do formulário, não a do JSON', () => {
    const mudancas = mudancasDaRevisao({ desconto: 1, total: 5, garantiaDias: 30 }, { desconto: 2, total: 6, garantiaDias: 60 });
    expect(mudancas.map((m) => m.campo)).toEqual(['Garantia (dias)', 'Total', 'Desconto']);
  });
});
