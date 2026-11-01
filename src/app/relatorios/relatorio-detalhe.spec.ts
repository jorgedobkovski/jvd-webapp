import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { sessaoFalsa } from '../cadastros/teste-cadastros';
import { API_URL } from '../core/api-url';
import { Sessao } from '../core/sessao';
import { API, proximoTick } from '../core/teste-apoio';
import { RelatorioDetalheTela } from './relatorio-detalhe';
import { detalheSintetico } from './teste-relatorios';

describe('RelatorioDetalheTela', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  function montar() {
    TestBed.configureTestingModule({
      imports: [RelatorioDetalheTela],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: Sessao, useValue: sessaoFalsa(false) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r-1' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RelatorioDetalheTela);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const depois = async (fixture: ReturnType<typeof montar>['fixture']) => {
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(detalhe = detalheSintetico()) {
    const tela = montar();
    http.expectOne(`${API}/relatorios/r-1`).flush(detalhe);
    await depois(tela.fixture);
    return tela;
  }

  const botao = (el: HTMLElement, texto: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texto))!;

  afterEach(() => http.verify());

  it('emitido: mostra os dados do snapshot (cliente com CNPJ e endereço formatados), garantia por extenso e totais', async () => {
    const { el } = await abrir();

    expect(el.querySelector('h1')!.textContent).toContain('Relatório nº 000042');
    expect(el.textContent).toContain('12.345.678/0001-95');
    expect(el.textContent).toContain('Rua Teste, 10 — Centro — Porto Velho/RO — CEP 76800-000');
    expect(el.textContent).toContain('Série SERIE-1');
    expect(el.textContent).toContain('01/10/2025');
    expect(el.textContent).toContain('certificado CERT-123');
    expect(el.textContent).toContain('30 dias (trinta)');
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('Total geral R$ 140,00');
    expect(el.textContent).not.toContain('Emitir');
  });

  it('retificado destaca a revisão', async () => {
    const { el } = await abrir(detalheSintetico({ revisao: 2 }));
    expect(el.textContent).toContain('Retificado — revisão 2');
  });

  it('emitido: baixa o PDF da via escolhida, com o nome do relatório', async () => {
    const { fixture, el } = await abrir();
    const criar = vi.fn().mockReturnValue('blob:pdf');
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    let nome = '';
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nome = this.download;
    });

    const via = el.querySelector<HTMLSelectElement>('#via')!;
    via.value = 'fiscalizacao';
    via.dispatchEvent(new Event('input'));
    via.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    botao(el, 'Baixar PDF').click();
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/relatorios/r-1/pdf`);
    expect(pedido.request.params.get('via')).toBe('fiscalizacao');
    expect(pedido.request.responseType).toBe('blob');
    pedido.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    await depois(fixture);

    expect(criar).toHaveBeenCalledOnce();
    expect(nome).toBe('relatorio-000042.pdf');
    clique.mockRestore();
  });

  it('falha ao baixar o PDF mostra o erro', async () => {
    const { fixture, el } = await abrir();

    botao(el, 'Baixar PDF').click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/relatorios/r-1/pdf`).flush(new Blob(['x']), { status: 500, statusText: 'Server Error' });
    await depois(fixture);

    expect(el.querySelector('.alerta-erro')!.textContent).toContain('O servidor encontrou um problema');
  });

  it('cancelado mostra o motivo e continua oferecendo o PDF', async () => {
    const { el } = await abrir(detalheSintetico({ status: 'Cancelado', canceladoEm: '2026-10-31T10:00:00Z', motivoCancelamento: 'Emitido para o cliente errado' }));

    expect(el.textContent).toContain('Relatório cancelado em 31/10/2026');
    expect(el.textContent).toContain('Emitido para o cliente errado');
    expect(botao(el, 'Baixar PDF')).toBeTruthy();
  });

  it('rascunho: oferece Editar, Emitir e Descartar, e não oferece PDF', async () => {
    const { el } = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null, cliente: null, equipamento: null }));

    expect(el.querySelector('h1')!.textContent).toContain('Rascunho de relatório');
    expect(el.textContent).toContain('Editar');
    expect(botao(el, 'Emitir')).toBeTruthy();
    expect(botao(el, 'Descartar')).toBeTruthy();
    expect(el.querySelector('#via')).toBeNull();
    expect(el.textContent).toContain('Mercado Teste Ltda');
  });

  it('emitir só acontece depois de confirmar, e mostra o número recebido', async () => {
    const { fixture, el } = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null, versao: 'v3' }));

    botao(el, 'Emitir').click();
    fixture.detectChanges();
    http.expectNone(`${API}/relatorios/r-1/emitir`);
    expect(el.textContent).toContain('deixa de poder ser editado diretamente');

    botao(el, 'Sim, emitir').click();
    const pedido = http.expectOne(`${API}/relatorios/r-1/emitir`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({ versao: 'v3' });
    pedido.flush(detalheSintetico({ numeroFormatado: '000077', versao: 'v4' }));
    await depois(fixture);

    expect(el.querySelector('h1')!.textContent).toContain('Relatório nº 000077');
    expect(botao(el, 'Baixar PDF')).toBeTruthy();
  });

  it('recusa da emissão (cliente sem documento) aparece na tela e o rascunho continua', async () => {
    const { fixture, el } = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null }));

    botao(el, 'Emitir').click();
    fixture.detectChanges();
    botao(el, 'Sim, emitir').click();
    http.expectOne(`${API}/relatorios/r-1/emitir`).flush(
      { codigo: 'relatorio.cliente_sem_documento', detail: 'O cliente precisa ter CPF ou CNPJ para emitir.', erros: [{ codigo: 'relatorio.cliente_sem_documento', mensagem: 'O cliente precisa ter CPF ou CNPJ para emitir.' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    await depois(fixture);

    expect(el.textContent).toContain('O cliente precisa ter CPF ou CNPJ para emitir.');
    expect(botao(el, 'Emitir')).toBeTruthy();
  });

  it('conflito ao emitir pede para recarregar antes', async () => {
    const { fixture, el } = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null }));

    botao(el, 'Emitir').click();
    fixture.detectChanges();
    botao(el, 'Sim, emitir').click();
    http.expectOne(`${API}/relatorios/r-1/emitir`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
    await depois(fixture);

    expect(el.textContent).toContain('Outra pessoa alterou este rascunho');
  });

  it('descartar só depois de confirmar e volta para a lista', async () => {
    const { fixture, el } = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null }));

    botao(el, 'Descartar').click();
    fixture.detectChanges();
    http.expectNone(`${API}/relatorios/r-1`);
    botao(el, 'Sim, descartar').click();
    const pedido = http.expectOne(`${API}/relatorios/r-1`);
    expect(pedido.request.method).toBe('DELETE');
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    await depois(fixture);

    expect(navegar).toHaveBeenCalledWith(['/relatorios']);
  });

  it('falha ao carregar (rede ou 500) mostra o erro e permite tentar de novo', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/relatorios/r-1`).flush({}, { status: 500, statusText: 'Server Error' });
    await depois(fixture);
    expect(el.querySelector('.alerta-erro')!.textContent).toContain('O servidor encontrou um problema');

    botao(el, 'Tentar de novo').click();
    http.expectOne(`${API}/relatorios/r-1`).flush(detalheSintetico());
    await depois(fixture);

    expect(el.querySelector('h1')!.textContent).toContain('Relatório nº 000042');
    expect(el.querySelector('.alerta-erro')).toBeNull();
  });

  it('sem conexão (status 0) também mostra o erro', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/relatorios/r-1`).error(new ProgressEvent('error'), { status: 0 });
    await depois(fixture);

    expect(el.textContent).toContain('Sem conexão com o servidor');
  });

  it('ao abrir a confirmação, o foco vai para o botão que confirma', async () => {
    const { fixture, el } = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null }));
    document.body.appendChild(el);

    botao(el, 'Emitir').click();
    fixture.detectChanges();
    await depois(fixture);
    expect(document.activeElement?.textContent).toContain('Sim, emitir');

    botao(el, 'Voltar').click();
    botao(el, 'Descartar').click();
    fixture.detectChanges();
    await depois(fixture);
    expect(document.activeElement?.textContent).toContain('Sim, descartar');
    el.remove();
  });

  it('relatório inexistente (ou de outro técnico) mostra "não encontrado"', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/relatorios/r-1`).flush({ detail: 'Relatório não encontrado.' }, { status: 404, statusText: 'Not Found' });
    await depois(fixture);

    expect(el.textContent).toContain('Relatório não encontrado.');
  });
});
