import { gerarSenhaProvisoria } from './senha-provisoria';

describe('gerarSenhaProvisoria', () => {
  it('cumpre a política da API em muitas gerações (10+, maiúscula, minúscula e número)', () => {
    for (let i = 0; i < 300; i++) {
      const senha = gerarSenhaProvisoria();
      expect(senha.length).toBeGreaterThanOrEqual(10);
      expect(senha).toMatch(/[A-Z]/);
      expect(senha).toMatch(/[a-z]/);
      expect(senha).toMatch(/\d/);
    }
  });

  it('não usa caracteres ambíguos nem símbolos', () => {
    for (let i = 0; i < 300; i++) expect(gerarSenhaProvisoria()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]+$/);
  });

  it('respeita o tamanho pedido, com mínimo de 10', () => {
    expect(gerarSenhaProvisoria(16)).toHaveLength(16);
    expect(gerarSenhaProvisoria(4)).toHaveLength(10);
  });

  it('gera senhas diferentes a cada chamada', () => {
    const senhas = new Set(Array.from({ length: 200 }, () => gerarSenhaProvisoria()));
    expect(senhas.size).toBe(200);
  });
});
