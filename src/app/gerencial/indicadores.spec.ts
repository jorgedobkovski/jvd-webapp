import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { sessaoFalsa } from '../cadastros/teste-cadastros';
import { esteAno, esteMes, hoje, mesPassado } from '../compartilhado/datas';
import { API_URL } from '../core/api-url';
import { Sessao } from '../core/sessao';
import { API, proximoTick } from '../core/teste-apoio';
import { Indicadores, nomeDaPlanilha, paramsDeExportacao } from './gerencial-api';
import { IndicadoresPagina } from './indicadores';

const indicadores = (sobrescrever: Partial<Indicadores> = {}): Indicadores => ({
  de: null,
  ate: null,
  totais: { quantidade: 3, total: 1000, descontos: 100, totalGeral: 900, ticketMedio: 300 },
  porExecutor: [{ tecnicoId: 'u-1', tecnicoNome: 'Técnico Sintético', quantidade: 3, totalGeral: 900 }],
  porTipo: [
    { tipo: 'Corretiva', quantidade: 2, totalGeral: 700 },
    { tipo: 'Inspecao', quantidade: 1, totalGeral: 200 },
  ],
  maioresClientes: [{ clienteId: 'c-1', clienteNome: 'Cliente Sintético Ltda', quantidade: 3, totalGeral: 900 }],
  ...sobrescrever,
});

const usuario = (id: string, nome: string) => ({ id, nome, email: `${id}@exemplo.com`, perfil: 'Tecnico', cpf: null, ativo: true, deveTrocarSenha: false, criadoEm: '', atualizadoEm: '' });

describe('IndicadoresPagina', () => {
  let http: HttpTestingController;

  async function montar() {
    TestBed.configureTestingModule({
      imports: [IndicadoresPagina],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }, { provide: Sessao, useValue: sessaoFalsa(true) }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(IndicadoresPagina);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function atualizarTela(fixture: Awaited<ReturnType<typeof montar>>['fixture']) {
    // sem whenStable: com um pedido HTTP pendente ele nunca resolveria
    await proximoTick();
    await proximoTick();
    fixture.detectChanges();
  }

  async function responderInicial(fixture: Awaited<ReturnType<typeof montar>>['fixture'], resposta: Indicadores = indicadores()) {
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/usuarios`).flush({ itens: [usuario('u-1', 'Técnico Sintético')], pagina: 1, tamanho: 100, total: 1 });
    http.expectOne((r) => r.url === `${API}/gerencial/indicadores`).flush(resposta);
    await atualizarTela(fixture);
  }

  function preencher(el: HTMLElement, seletor: string, valor: string) {
    const campo = el.querySelector<HTMLInputElement | HTMLSelectElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('change'));
  }

  const clicar = (el: HTMLElement, texto: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))!.click();
  const texto = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!.replace(/\s/g, ' ');

  afterEach(() => http.verify());

  it('abre no mês corrente e mostra totais e os três rankings', async () => {
    const { fixture, el } = await montar();
    await proximoTick();
    const pedido = http.expectOne((r) => r.url === `${API}/gerencial/indicadores`);
    expect(pedido.request.params.get('de')).toBe(esteMes(hoje()).de);
    expect(pedido.request.params.get('ate')).toBe(esteMes(hoje()).ate);
    expect(pedido.request.params.has('tipo')).toBe(false);
    pedido.flush(indicadores());
    http.expectOne((r) => r.url === `${API}/usuarios`).flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
    await atualizarTela(fixture);

    expect(texto(el, 'quantidade')).toBe('3');
    expect(texto(el, 'total')).toContain('1.000,00');
    expect(texto(el, 'descontos')).toContain('100,00');
    expect(texto(el, 'total-geral')).toContain('900,00');
    expect(texto(el, 'ticket')).toContain('300,00');
    expect(texto(el, 'por-executor')).toContain('Técnico Sintético');
    expect(texto(el, 'por-tipo')).toContain('Manutenção corretiva');
    expect(texto(el, 'por-tipo')).toContain('Inspeção');
    expect(texto(el, 'por-cliente')).toContain('Cliente Sintético Ltda');
  });

  it('período sem relatórios emitidos mostra o aviso, sem tabelas', async () => {
    const { fixture, el } = await montar();
    await responderInicial(fixture, indicadores({ totais: { quantidade: 0, total: 0, descontos: 0, totalGeral: 0, ticketMedio: 0 }, porExecutor: [], porTipo: [], maioresClientes: [] }));

    expect(el.textContent).toContain('Nenhum relatório emitido no período.');
    expect(el.querySelector('table')).toBeNull();
  });

  it('período invertido não consulta e mostra o erro no campo', async () => {
    const { fixture, el } = await montar();
    await responderInicial(fixture);

    preencher(el, '#de', '2026-10-20');
    preencher(el, '#ate', '2026-10-01');
    fixture.detectChanges();
    clicar(el, 'Atualizar');
    await atualizarTela(fixture);

    http.expectNone((r) => r.url === `${API}/gerencial/indicadores`);
    expect(el.querySelector('#ate-erro')!.textContent).toContain('anterior');
  });

  it('atalhos de período consultam o intervalo certo', async () => {
    const { fixture, el } = await montar();
    await responderInicial(fixture);

    for (const [rotulo, periodo] of [['Mês passado', mesPassado(hoje())], ['Este ano', esteAno(hoje())]] as const) {
      clicar(el, rotulo);
      await atualizarTela(fixture);
      const pedido = http.expectOne((r) => r.url === `${API}/gerencial/indicadores`);
      expect(pedido.request.params.get('de')).toBe(periodo.de);
      expect(pedido.request.params.get('ate')).toBe(periodo.ate);
      pedido.flush(indicadores());
      await atualizarTela(fixture);
    }
  });

  it('falha na consulta mostra o alerta e "Tentar de novo" consulta outra vez', async () => {
    const { fixture, el } = await montar();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/usuarios`).flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
    http.expectOne((r) => r.url === `${API}/gerencial/indicadores`).flush({}, { status: 500, statusText: 'x' });
    await atualizarTela(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Não foi possível carregar os indicadores.');

    clicar(el, 'Tentar de novo');
    await atualizarTela(fixture);
    http.expectOne((r) => r.url === `${API}/gerencial/indicadores`).flush(indicadores());
    await atualizarTela(fixture);
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  describe('planilha', () => {
    let nomeBaixado: string | null;

    beforeEach(() => {
      nomeBaixado = null;
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste');
      vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        nomeBaixado = this.download;
      });
    });

    afterEach(() => vi.restoreAllMocks());

    it('baixa com TODOS os filtros aplicados (período, executor, tipo e cliente) e nome com o período', async () => {
      const { fixture, el } = await montar();
      await responderInicial(fixture);

      preencher(el, '#de', '2026-10-01');
      preencher(el, '#ate', '2026-10-31');
      preencher(el, '#tipo', 'Preventiva');
      preencher(el, '#executor', 'u-1');
      fixture.componentInstance['cliente'].set({ id: 'c-9', nome: 'Cliente Sintético' } as never);
      fixture.detectChanges();
      clicar(el, 'Atualizar');
      await atualizarTela(fixture);
      http.expectOne((r) => r.url === `${API}/gerencial/indicadores`).flush(indicadores());
      await atualizarTela(fixture);

      clicar(el, 'Baixar planilha');
      await atualizarTela(fixture);
      const pedido = http.expectOne((r) => r.url === `${API}/gerencial/exportar-relatorios`);
      expect(pedido.request.responseType).toBe('blob');
      expect(pedido.request.params.get('de')).toBe('2026-10-01');
      expect(pedido.request.params.get('ate')).toBe('2026-10-31');
      expect(pedido.request.params.get('tipo')).toBe('Preventiva');
      expect(pedido.request.params.get('tecnicoId')).toBe('u-1');
      expect(pedido.request.params.get('clienteId')).toBe('c-9');
      pedido.flush(new Blob(['x']));
      await atualizarTela(fixture);

      expect(nomeBaixado).toBe('relatorios-emitidos-2026-10-01-a-2026-10-31.xlsx');
    });

    it('enquanto gera, o botão fica desabilitado e um segundo clique não dispara outro pedido', async () => {
      const { fixture, el } = await montar();
      await responderInicial(fixture);

      clicar(el, 'Baixar planilha');
      await atualizarTela(fixture);
      const botao = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Gerando'))!;
      expect(botao.disabled).toBe(true);
      void fixture.componentInstance['exportar']();
      await proximoTick();
      http.expectOne((r) => r.url === `${API}/gerencial/exportar-relatorios`).flush(new Blob(['x']));
      await atualizarTela(fixture);
      expect(el.textContent).toContain('Baixar planilha');
    });

    it('erro da API (corpo em Blob) aparece com a mensagem dela e nada é baixado', async () => {
      const { fixture, el } = await montar();
      await responderInicial(fixture);

      clicar(el, 'Baixar planilha');
      await atualizarTela(fixture);
      const corpo = new Blob([JSON.stringify({ codigo: 'validacao', detail: 'A exportação passa de 20.000 relatórios.', erros: [{ codigo: 'validacao', mensagem: 'A exportação passa de 20.000 relatórios.' }] })]);
      http.expectOne((r) => r.url === `${API}/gerencial/exportar-relatorios`).flush(corpo, { status: 400, statusText: 'Bad Request' });
      await proximoTick();
      await proximoTick();
      await atualizarTela(fixture);

      expect(el.querySelector('[role="alert"]')!.textContent).toContain('passa de 20.000');
      expect(nomeBaixado).toBeNull();
    });
  });
});

describe('gerencial-api (funções puras)', () => {
  it('nome da planilha usa só as datas do filtro', () => {
    expect(nomeDaPlanilha({})).toBe('relatorios-emitidos.xlsx');
    expect(nomeDaPlanilha({ de: '2026-01-01' })).toBe('relatorios-emitidos-desde-2026-01-01.xlsx');
    expect(nomeDaPlanilha({ ate: '2026-01-31' })).toBe('relatorios-emitidos-ate-2026-01-31.xlsx');
    expect(nomeDaPlanilha({ de: '2026-01-01', ate: '2026-01-31' })).toBe('relatorios-emitidos-2026-01-01-a-2026-01-31.xlsx');
  });

  it('parâmetros omitem o que está vazio', () => {
    expect(paramsDeExportacao({ de: '', tipo: undefined, clienteId: 'c' })).toEqual({ clienteId: 'c' });
  });
});

