import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { API, proximoTick } from '../../core/teste-apoio';
import { Servico } from './catalogo-api';
import { CatalogoLista } from './catalogo-lista';

const servico = (s: Partial<Servico> = {}): Servico => ({
  id: 's-1', codigoOrigem: 'C1', descricao: 'Troca de célula', precoSugerido: 1234.5, ativo: true,
  criadoEm: '2026-11-01T10:00:00Z', atualizadoEm: '2026-11-01T10:00:00Z', versao: 'v1', ...s,
});

describe('CatalogoLista', () => {
  let http: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({ imports: [CatalogoLista], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CatalogoLista);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function responder(fixture: ReturnType<typeof montar>['fixture'], itens: Servico[]) {
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({ itens, pagina: 1, tamanho: 20, total: itens.length });
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('lista com preço em reais (ou traço quando não há) e etiqueta de inativo', async () => {
    const { fixture, el } = montar();
    await responder(fixture, [servico(), servico({ id: 's-2', descricao: 'Aferição', precoSugerido: null, ativo: false })]);

    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.querySelectorAll('ul.md\\:hidden li')).toHaveLength(2);
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('R$ 1.234,50');
    expect(el.textContent).toContain('—');
    expect(el.textContent).toContain('Inativo');
  });

  it('filtra por situação e busca, voltando para a página 1', async () => {
    const { fixture, el } = montar();
    await responder(fixture, [servico()]);

    const busca = el.querySelector<HTMLInputElement>('#busca')!;
    busca.value = 'célula';
    busca.dispatchEvent(new Event('input'));
    const situacao = el.querySelector<HTMLSelectElement>('#situacao')!;
    situacao.value = 'ativos';
    situacao.dispatchEvent(new Event('input'));
    situacao.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/catalogo-servicos`);
    expect(pedido.request.params.get('busca')).toBe('célula');
    expect(pedido.request.params.get('ativo')).toBe('true');
    expect(pedido.request.params.get('pagina')).toBe('1');
    pedido.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum serviço encontrado.');
  });

  it('falha ao carregar mostra o erro e permite tentar de novo', async () => {
    const { fixture, el } = montar();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({}, { status: 500, statusText: 'Server Error' });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Não foi possível carregar o catálogo.');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
  });
});
