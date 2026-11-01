import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { Sessao } from '../../core/sessao';
import { API, proximoTick } from '../../core/teste-apoio';
import { clienteSintetico, sessaoFalsa } from '../teste-cadastros';
import { ClientesLista } from './clientes-lista';

describe('ClientesLista', () => {
  let http: HttpTestingController;

  function montar(gestor: boolean) {
    TestBed.configureTestingModule({
      imports: [ClientesLista],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }, { provide: Sessao, useValue: sessaoFalsa(gestor) }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ClientesLista);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function responder(fixture: ReturnType<typeof montar>['fixture'], itens = [clienteSintetico()], total = itens.length) {
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens, pagina: 1, tamanho: 20, total });
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('lista os clientes (cartões no celular e tabela no computador) com CPF/CNPJ formatado', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.querySelectorAll('ul.md\\:hidden li')).toHaveLength(1);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(el.textContent).toContain('12.345.678/0001-95');
  });

  it('técnico não vê os filtros de situação nem de incompletos', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.querySelector('#situacao')).toBeNull();
    expect(el.textContent).not.toContain('Só cadastros incompletos');
  });

  it('gestor filtra por situação e por incompletos, e a busca volta para a página 1', async () => {
    const { fixture, el } = montar(true);
    await responder(fixture);
    expect(el.querySelector('#situacao')).not.toBeNull();

    const busca = el.querySelector<HTMLInputElement>('#busca')!;
    busca.value = 'mercado';
    busca.dispatchEvent(new Event('input'));
    const situacao = el.querySelector<HTMLSelectElement>('#situacao')!;
    situacao.value = 'inativos';
    situacao.dispatchEvent(new Event('input'));
    situacao.dispatchEvent(new Event('change'));
    const incompletos = el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    incompletos.checked = true;
    incompletos.dispatchEvent(new Event('input'));
    incompletos.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/clientes`);
    expect(pedido.request.params.get('busca')).toBe('mercado');
    expect(pedido.request.params.get('ativo')).toBe('false');
    expect(pedido.request.params.get('incompleto')).toBe('true');
    expect(pedido.request.params.get('pagina')).toBe('1');
    pedido.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum cliente encontrado.');
  });

  it('paginação pede a página seguinte', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture, [clienteSintetico()], 45);

    Array.from(el.querySelectorAll<HTMLButtonElement>('jvd-paginacao button')).find((b) => b.textContent?.includes('Próxima'))!.click();
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/clientes`);
    expect(pedido.request.params.get('pagina')).toBe('2');
    pedido.flush({ itens: [], pagina: 2, tamanho: 20, total: 45 });
    await proximoTick();
  });

  it('falha ao carregar mostra o erro e permite tentar de novo', async () => {
    const { fixture, el } = montar(false);
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({}, { status: 500, statusText: 'Server Error' });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Não foi possível carregar os clientes.');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
  });
});
