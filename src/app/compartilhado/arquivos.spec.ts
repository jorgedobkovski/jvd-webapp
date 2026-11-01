import { salvarArquivo } from './arquivos';

describe('salvarArquivo', () => {
  it('baixa o arquivo com o nome pedido, sem deixar o link na página, e solta o endereço depois', () => {
    vi.useFakeTimers();
    const criar = vi.fn().mockReturnValue('blob:teste');
    const soltar = vi.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: soltar });
    let baixado: { href: string; nome: string } | null = null;
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      baixado = { href: this.href, nome: this.download };
    });

    salvarArquivo(new Blob(['%PDF'], { type: 'application/pdf' }), 'relatorio-000042.pdf');

    expect(criar).toHaveBeenCalledOnce();
    expect(baixado).toEqual({ href: 'blob:teste', nome: 'relatorio-000042.pdf' });
    expect(document.querySelector('a[download]')).toBeNull();
    expect(soltar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(soltar).toHaveBeenCalledWith('blob:teste');
    clique.mockRestore();
    vi.useRealTimers();
  });
});
