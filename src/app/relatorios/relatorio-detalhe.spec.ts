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

  /** Abre o detalhe; com revisão > 0 a tela também pede o histórico, que é respondido aqui. */
  async function abrir(detalhe = detalheSintetico(), revisoes: unknown[] = []) {
    const tela = montar();
    http.expectOne(`${API}/relatorios/r-1`).flush(detalhe);
    if (detalhe.revisao > 0) {
      await proximoTick();
      http.expectOne(`${API}/relatorios/r-1/revisoes`).flush(revisoes);
    }
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
    const { el } = await abrir(detalheSintetico({ revisao: 2 }), []);
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

  describe('retificar, cancelar e histórico (7B)', () => {
    const revisao = (sobrescrever: Record<string, unknown> = {}) => ({
      revisao: 1,
      retificadoEm: '2026-10-31T15:30:00Z',
      retificadoPor: 'u-1',
      retificadoPorNome: 'Gestor Sintético',
      motivo: 'Valor digitado errado',
      dadosAnteriores: { total: 100, totalGeral: 90, servicoExecutado: 'Texto antigo' },
      dadosNovos: { total: 150, totalGeral: 140, servicoExecutado: 'Texto novo' },
      ...sobrescrever,
    });

    it('emitido oferece Retificar (link) e Cancelar relatório; rascunho e cancelado não', async () => {
      const emitido = await abrir();
      expect(emitido.el.querySelector<HTMLAnchorElement>('a[href="/relatorios/r-1/retificar"]')).not.toBeNull();
      expect(botao(emitido.el, 'Cancelar relatório')).toBeTruthy();
      TestBed.resetTestingModule();

      const cancelado = await abrir(detalheSintetico({ status: 'Cancelado', canceladoEm: '2026-10-31T10:00:00Z', motivoCancelamento: 'x' }));
      expect(cancelado.el.querySelector('a[href="/relatorios/r-1/retificar"]')).toBeNull();
      expect(cancelado.el.textContent).not.toContain('Cancelar relatório');
      TestBed.resetTestingModule();

      const rascunho = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null }));
      expect(rascunho.el.querySelector('a[href="/relatorios/r-1/retificar"]')).toBeNull();
    });

    it('cancelar exige o motivo, não chama a API sem ele e leva o foco para o campo', async () => {
      const { fixture, el } = await abrir();
      document.body.appendChild(el);

      botao(el, 'Cancelar relatório').click();
      fixture.detectChanges();
      await depois(fixture);
      expect(document.activeElement?.id).toBe('motivo-cancelamento');
      expect(el.textContent).toContain('nunca é reutilizado');

      botao(el, 'Sim, cancelar relatório').click();
      await depois(fixture);

      http.expectNone(`${API}/relatorios/r-1/cancelar`);
      expect(el.textContent).toContain('Informe o motivo do cancelamento.');
      el.remove();
    });

    it('cancelar com motivo envia motivo e versão, e a tela passa a mostrar Cancelado e o motivo', async () => {
      const { fixture, el } = await abrir(detalheSintetico({ versao: 'v7' }));

      botao(el, 'Cancelar relatório').click();
      fixture.detectChanges();
      const campo = el.querySelector<HTMLTextAreaElement>('#motivo-cancelamento')!;
      campo.value = '  Emitido para o cliente errado  ';
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      botao(el, 'Sim, cancelar relatório').click();
      await proximoTick();

      const pedido = http.expectOne(`${API}/relatorios/r-1/cancelar`);
      expect(pedido.request.method).toBe('POST');
      expect(pedido.request.body).toEqual({ motivo: 'Emitido para o cliente errado', versao: 'v7' });
      pedido.flush(detalheSintetico({ status: 'Cancelado', canceladoEm: '2026-10-31T10:00:00Z', motivoCancelamento: 'Emitido para o cliente errado', versao: 'v8' }));
      await depois(fixture);

      expect(el.textContent).toContain('Relatório cancelado em 31/10/2026');
      expect(el.textContent).toContain('Emitido para o cliente errado');
      expect(el.textContent).not.toContain('Cancelar relatório');
      expect(el.querySelector('a[href="/relatorios/r-1/retificar"]')).toBeNull();
    });

    it('recusa do cancelamento (já cancelado por outra pessoa) aparece na tela', async () => {
      const { fixture, el } = await abrir();
      botao(el, 'Cancelar relatório').click();
      fixture.detectChanges();
      const campo = el.querySelector<HTMLTextAreaElement>('#motivo-cancelamento')!;
      campo.value = 'Motivo';
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      botao(el, 'Sim, cancelar relatório').click();
      http.expectOne(`${API}/relatorios/r-1/cancelar`).flush({ codigo: 'relatorio.nao_esta_emitido', detail: 'O relatório não está emitido.', erros: [{ codigo: 'relatorio.nao_esta_emitido', mensagem: 'O relatório não está emitido.' }] }, { status: 409, statusText: 'Conflict' });
      await depois(fixture);

      expect(el.textContent).toContain('O relatório não está emitido.');
    });

    it('conflito de versão ao cancelar fecha o painel, traz o relatório atual e avisa', async () => {
      const { fixture, el } = await abrir();
      botao(el, 'Cancelar relatório').click();
      fixture.detectChanges();
      const campo = el.querySelector<HTMLTextAreaElement>('#motivo-cancelamento')!;
      campo.value = 'Motivo';
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      botao(el, 'Sim, cancelar relatório').click();
      http.expectOne(`${API}/relatorios/r-1/cancelar`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
      await proximoTick();
      http.expectOne(`${API}/relatorios/r-1`).flush(detalheSintetico({ versao: 'v9', servicoExecutado: 'Texto novo vindo do servidor' }));
      await depois(fixture);

      expect(el.textContent).toContain('A tela foi atualizada: confira os dados e cancele de novo');
      expect(el.textContent).toContain('Texto novo vindo do servidor');
      expect(el.querySelector('#motivo-cancelamento')).toBeNull();
    });

    it('sem retificações, não mostra histórico nem pede as revisões', async () => {
      const { el } = await abrir(detalheSintetico({ revisao: 0 }));

      expect(el.textContent).not.toContain('Histórico de retificações');
    });

    it('retificado mostra o histórico: revisão, quando, quem, motivo e o antes → depois legível', async () => {
      const { el } = await abrir(detalheSintetico({ revisao: 1 }), [revisao()]);

      expect(el.textContent).toContain('Histórico de retificações');
      expect(el.textContent).toContain('Revisão 1');
      expect(el.textContent).toContain('Gestor Sintético');
      expect(el.textContent).toContain('Motivo: Valor digitado errado');
      expect(el.textContent?.replace(/\s/g, ' ')).toContain('Total: R$ 100,00 → R$ 150,00');
      expect(el.textContent).toContain('Serviço executado: Texto antigo → Texto novo');
    });

    it('várias revisões aparecem em ordem', async () => {
      const { el } = await abrir(detalheSintetico({ revisao: 2 }), [revisao(), revisao({ revisao: 2, motivo: 'Segunda correção', dadosAnteriores: { garantiaDias: 30 }, dadosNovos: { garantiaDias: 60 } })]);

      const itens = Array.from(el.querySelectorAll('#sec-historico ~ ol > li')).map((li) => li.textContent ?? '');
      expect(itens).toHaveLength(2);
      expect(itens[0]).toContain('Revisão 1');
      expect(itens[1]).toContain('Revisão 2');
      expect(itens[1]).toContain('Garantia (dias): 30 → 60');
    });

    it('falha ao carregar o histórico mostra o erro, sem esconder o relatório', async () => {
      const tela = montar();
      http.expectOne(`${API}/relatorios/r-1`).flush(detalheSintetico({ revisao: 1 }));
      await proximoTick();
      http.expectOne(`${API}/relatorios/r-1/revisoes`).flush({}, { status: 500, statusText: 'Server Error' });
      await depois(tela.fixture);

      expect(tela.el.textContent).toContain('Histórico de retificações');
      expect(tela.el.textContent).toContain('O servidor encontrou um problema');
      expect(tela.el.querySelector('h1')!.textContent).toContain('Relatório nº 000042');
    });
  });

  it('relatório inexistente (ou de outro técnico) mostra "não encontrado"', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/relatorios/r-1`).flush({ detail: 'Relatório não encontrado.' }, { status: 404, statusText: 'Not Found' });
    await depois(fixture);

    expect(el.textContent).toContain('Relatório não encontrado.');
  });
});
