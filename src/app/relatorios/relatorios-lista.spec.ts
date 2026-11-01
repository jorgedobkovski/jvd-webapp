import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { clienteSintetico, sessaoFalsa } from '../cadastros/teste-cadastros';
import { API_URL } from '../core/api-url';
import { Sessao } from '../core/sessao';
import { API, proximoTick } from '../core/teste-apoio';
import { RelatoriosLista } from './relatorios-lista';
import { resumoSintetico } from './teste-relatorios';

describe('RelatoriosLista', () => {
  let http: HttpTestingController;
  let ehGestor = false;

  const usuario = (id: string, nome: string, ativo = true) => ({ id, nome, email: `${id}@exemplo.com`, perfil: 'Tecnico', cpf: null, ativo, deveTrocarSenha: false, criadoEm: '', atualizadoEm: '' });

  function montar(gestor: boolean) {
    ehGestor = gestor;
    TestBed.configureTestingModule({
      imports: [RelatoriosLista],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }, { provide: Sessao, useValue: sessaoFalsa(gestor) }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RelatoriosLista);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function responder(fixture: ReturnType<typeof montar>['fixture'], itens = [resumoSintetico()], total = itens.length) {
    await proximoTick();
    if (ehGestor) http.expectOne((r) => r.url === `${API}/usuarios`).flush({ itens: [usuario('u-1', 'Técnico Sintético'), usuario('u-2', 'Ex-técnico', false)], pagina: 1, tamanho: 100, total: 2 });
    http.expectOne((r) => r.url === `${API}/relatorios`).flush({ itens, pagina: 1, tamanho: 20, total });
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function preencher(el: HTMLElement, seletor: string, valor: string) {
    const campo = el.querySelector<HTMLInputElement | HTMLSelectElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('change'));
  }

  afterEach(() => http.verify());

  it('técnico: "Meus relatórios", sem coluna de executor, com número, data, tipo e total', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.querySelector('h1')!.textContent).toBe('Meus relatórios');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(el.querySelectorAll('ul.md\\:hidden li')).toHaveLength(1);
    expect(el.textContent).toContain('000042');
    expect(el.textContent).toContain('30/10/2026');
    expect(el.textContent).toContain('Manutenção corretiva');
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('R$ 140,00');
    expect(el.textContent).not.toContain('Executor');
  });

  it('gestor vê "Relatórios" e o executor de cada um', async () => {
    const { fixture, el } = montar(true);
    await responder(fixture);

    expect(el.querySelector('h1')!.textContent).toBe('Relatórios');
    expect(el.textContent).toContain('Técnico Sintético');
  });

  it('técnico NÃO vê os filtros de executor e de cliente, e a tela nem consulta os usuários', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.querySelector('#executor')).toBeNull();
    expect(el.textContent).not.toContain('Cliente (opcional)');
    http.expectNone((r) => r.url === `${API}/usuarios`);
  });

  it('gestor filtra por executor (inclusive de quem já saiu) e o filtro vai para a API', async () => {
    const { fixture, el } = montar(true);
    await responder(fixture);
    const opcoes = el.querySelector<HTMLSelectElement>('#executor')!.textContent!;
    expect(opcoes).toContain('Técnico Sintético');
    expect(opcoes).toContain('Ex-técnico (inativo)');

    preencher(el, '#executor', 'u-2');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/relatorios`);
    expect(pedido.request.params.get('tecnicoId')).toBe('u-2');
    pedido.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
  });

  it('gestor filtra por cliente e pode limpar o filtro', async () => {
    const { fixture, el } = montar(true);
    await responder(fixture);

    preencher(el, 'input[aria-label="Buscar cliente"]', 'mercado');
    Array.from(el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.trim() === 'Buscar')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens: [clienteSintetico()], pagina: 1, tamanho: 8, total: 1 });
    await proximoTick();
    fixture.detectChanges();
    Array.from(el.querySelectorAll<HTMLButtonElement>('fieldset ul button')).find((b) => b.textContent?.includes('Mercado Teste Ltda'))!.click();
    fixture.detectChanges();

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();
    const comCliente = http.expectOne((r) => r.url === `${API}/relatorios`);
    expect(comCliente.request.params.get('clienteId')).toBe('cli-1');
    comCliente.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
    fixture.detectChanges();

    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Limpar o filtro de cliente'))!.click();
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();
    const semCliente = http.expectOne((r) => r.url === `${API}/relatorios`);
    expect(semCliente.request.params.has('clienteId')).toBe(false);
    semCliente.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
  });

  it('rascunho aparece sem número e retificado destaca a revisão', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture, [resumoSintetico({ id: 'r-2', numero: null, numeroFormatado: null, status: 'Rascunho' }), resumoSintetico({ revisao: 3 })]);

    expect(el.textContent).toContain('Rascunho');
    expect(el.textContent).toContain('Retificado — revisão 3');
  });

  it('filtros viram parâmetros e a busca volta para a página 1', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture, [resumoSintetico()], 45);

    preencher(el, '#numero', '42');
    preencher(el, '#status', 'Emitido');
    preencher(el, '#tipo', 'Preventiva');
    preencher(el, '#de', '2026-10-01');
    preencher(el, '#ate', '2026-10-31');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/relatorios`);
    expect(pedido.request.params.get('numero')).toBe('42');
    expect(pedido.request.params.get('status')).toBe('Emitido');
    expect(pedido.request.params.get('tipo')).toBe('Preventiva');
    expect(pedido.request.params.get('de')).toBe('2026-10-01');
    expect(pedido.request.params.get('ate')).toBe('2026-10-31');
    expect(pedido.request.params.get('pagina')).toBe('1');
    pedido.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum relatório encontrado.');
  });

  it('número inválido e período invertido são recusados sem chamar a API', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture);

    preencher(el, '#numero', 'abc');
    preencher(el, '#de', '2026-10-31');
    preencher(el, '#ate', '2026-10-01');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();
    fixture.detectChanges();

    http.expectNone((r) => r.url === `${API}/relatorios`);
    expect(el.textContent).toContain('Use só números.');
    expect(el.textContent).toContain('A data final não pode ser anterior à inicial.');
  });

  it('falha ao carregar mostra o erro e permite tentar de novo', async () => {
    const { fixture, el } = montar(false);
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/relatorios`).flush({}, { status: 500, statusText: 'Server Error' });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Não foi possível carregar os relatórios.');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/relatorios`).flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
  });
});
