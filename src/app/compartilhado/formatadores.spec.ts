import { UFS, formatarCep, formatarDocumento, formatarEndereco, formatarReais, lerPreco, soDigitos } from './formatadores';

describe('formatadores', () => {
  it('soDigitos tira tudo que não é número', () => {
    expect(soDigitos('123.456.789-09')).toBe('12345678909');
    expect(soDigitos(null)).toBe('');
  });

  it('formata CPF e CNPJ; outros tamanhos voltam como vieram', () => {
    expect(formatarDocumento('12345678909')).toBe('123.456.789-09');
    expect(formatarDocumento('12345678000195')).toBe('12.345.678/0001-95');
    expect(formatarDocumento('123')).toBe('123');
    expect(formatarDocumento(null)).toBe('');
  });

  it('formata CEP de 8 dígitos', () => {
    expect(formatarCep('76800000')).toBe('76800-000');
    expect(formatarCep('7680')).toBe('7680');
  });

  it('monta o endereço pulando o que falta', () => {
    expect(
      formatarEndereco({ logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Porto Velho', uf: 'RO', cep: '76800000' }),
    ).toBe('Rua A, 10 — Centro — Porto Velho/RO — CEP 76800-000');
    expect(formatarEndereco({ logradouro: null, numero: null, bairro: null, cidade: 'Ji-Paraná', uf: null, cep: null })).toBe('Ji-Paraná');
    expect(formatarEndereco({ logradouro: ' ', numero: null, bairro: null, cidade: null, uf: null, cep: null })).toBe('');
  });

  it('tem as 27 UFs', () => {
    expect(UFS).toHaveLength(27);
    expect(new Set(UFS).size).toBe(27);
  });

  it('formata valores em reais; sem valor vira traço', () => {
    expect(formatarReais(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatarReais(null)).toBe('—');
    expect(formatarReais(undefined)).toBe('—');
  });

  it('lê o preço digitado: vírgula ou ponto, até 2 casas; vazio = sem preço; inválido = undefined', () => {
    expect(lerPreco('150')).toBe(150);
    expect(lerPreco('150,5')).toBe(150.5);
    expect(lerPreco('1.234,56')).toBe(1234.56);
    expect(lerPreco('1234.56')).toBe(1234.56);
    expect(lerPreco(' 0 ')).toBe(0);
    expect(lerPreco('')).toBeNull();
    expect(lerPreco('   ')).toBeNull();
    for (const ruim of ['abc', '-5', '1,234', '1.2345', '12345678901', '1,2,3', 'R$ 10']) expect(lerPreco(ruim)).toBeUndefined();
  });
});
