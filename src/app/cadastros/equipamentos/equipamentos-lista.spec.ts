import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { Sessao } from '../../core/sessao';
import { API, proximoTick } from '../../core/teste-apoio';
import { equipamentoSintetico, sessaoFalsa } from '../teste-cadastros';
import { EquipamentosLista } from './equipamentos-lista';

describe('EquipamentosLista', () => {
  let http: HttpTestingController;

  function montar(gestor: boolean) {
    TestBed.configureTestingModule({
      imports: [EquipamentosLista],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }, { provide: Sessao, useValue: sessaoFalsa(gestor) }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EquipamentosLista);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function responder(fixture: ReturnType<typeof montar>['fixture'], itens = [equipamentoSintetico()], total = itens.length) {
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/equipamentos`).flush({ itens, pagina: 1, tamanho: 20, total });
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('lista os equipamentos com o cliente, em cartões (celular) e tabela (computador)', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.querySelectorAll('ul.md\\:hidden li')).toHaveLength(1);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(el.textContent).toContain('Balança Teste');
    expect(el.textContent).toContain('Mercado Teste Ltda');
    expect(el.textContent).toContain('SERIE-1');
  });

  it('técnico não vê o filtro de situação e não envia "ativo"', async () => {
    const { fixture, el } = montar(false);
    await proximoTick();
    const inicial = http.expectOne((r) => r.url === `${API}/equipamentos`);
    expect(inicial.request.params.has('ativo')).toBe(false);
    inicial.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
    fixture.detectChanges();

    expect(el.querySelector('#situacao')).toBeNull();
  });

  it('gestor filtra por situação, e a busca volta para a página 1', async () => {
    const { fixture, el } = montar(true);
    await responder(fixture, [equipamentoSintetico()], 45);

    // vai para a página 2 e depois busca: tem de voltar para a 1
    Array.from(el.querySelectorAll<HTMLButtonElement>('jvd-paginacao button')).find((b) => b.textContent?.includes('Próxima'))!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/equipamentos` && r.params.get('pagina') === '2').flush({ itens: [], pagina: 2, tamanho: 20, total: 45 });
    await proximoTick();
    fixture.detectChanges();

    const busca = el.querySelector<HTMLInputElement>('#busca')!;
    busca.value = 'balança';
    busca.dispatchEvent(new Event('input'));
    const situacao = el.querySelector<HTMLSelectElement>('#situacao')!;
    situacao.value = 'inativos';
    situacao.dispatchEvent(new Event('input'));
    situacao.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/equipamentos`);
    expect(pedido.request.params.get('busca')).toBe('balança');
    expect(pedido.request.params.get('ativo')).toBe('false');
    expect(pedido.request.params.get('pagina')).toBe('1');
    pedido.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum equipamento encontrado.');
  });

  it('equipamento inativo aparece marcado', async () => {
    const { fixture, el } = montar(true);
    await responder(fixture, [equipamentoSintetico({ ativo: false })]);

    expect(el.textContent).toContain('Inativo');
  });

  it('falha ao carregar mostra o erro e permite tentar de novo', async () => {
    const { fixture, el } = montar(false);
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/equipamentos`).flush({}, { status: 500, statusText: 'Server Error' });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Não foi possível carregar os equipamentos.');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/equipamentos`).flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
  });
});
