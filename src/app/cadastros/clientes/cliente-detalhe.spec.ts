import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { Sessao } from '../../core/sessao';
import { API, proximoTick } from '../../core/teste-apoio';
import { clienteSintetico, equipamentoSintetico, sessaoFalsa } from '../teste-cadastros';
import { ClienteDetalhe } from './cliente-detalhe';

describe('ClienteDetalhe', () => {
  let http: HttpTestingController;

  function montar(gestor: boolean) {
    TestBed.configureTestingModule({
      imports: [ClienteDetalhe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: Sessao, useValue: sessaoFalsa(gestor) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'cli-1' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ClienteDetalhe);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function responder(fixture: ReturnType<typeof montar>['fixture'], cliente = clienteSintetico()) {
    await proximoTick();
    http.expectOne(`${API}/clientes/cli-1`).flush(cliente);
    const equipamentos = http.expectOne((r) => r.url === `${API}/equipamentos`);
    expect(equipamentos.request.params.get('clienteId')).toBe('cli-1');
    equipamentos.flush({ itens: [equipamentoSintetico()], pagina: 1, tamanho: 100, total: 1 });
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    history.replaceState(null, '');
  });

  it('mostra os dados com CPF/CNPJ e endereço formatados, e os equipamentos do cliente', async () => {
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.textContent).toContain('Mercado Teste Ltda');
    expect(el.textContent).toContain('12.345.678/0001-95');
    expect(el.textContent).toContain('Rua Teste, 10 — Centro — Porto Velho/RO — CEP 76800-000');
    expect(el.textContent).toContain('Balança Teste');
  });

  it('técnico não vê Desativar; gestor vê, e só desativa depois de confirmar', async () => {
    const tecnico = montar(false);
    await responder(tecnico.fixture);
    expect(tecnico.el.textContent).not.toContain('Desativar');
    TestBed.resetTestingModule();

    const { fixture, el } = montar(true);
    await responder(fixture);
    const botao = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Desativar')!;
    botao.click();
    fixture.detectChanges();
    http.expectNone(`${API}/clientes/cli-1/desativar`);
    expect(el.textContent).toContain('Técnicos deixam de vê-lo');

    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Sim, desativar'))!.click();
    const pedido = http.expectOne(`${API}/clientes/cli-1/desativar`);
    expect(pedido.request.method).toBe('POST');
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    await proximoTick();
    http.expectOne(`${API}/clientes/cli-1`).flush(clienteSintetico({ ativo: false }));
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Inativo');
    expect(el.textContent).toContain('Reativar');
  });

  it('cliente sem documento aparece como incompleto', async () => {
    const { fixture, el } = montar(true);
    await responder(fixture, clienteSintetico({ documento: null, cadastroIncompleto: true }));

    expect(el.textContent).toContain('Incompleto');
    expect(el.textContent).toContain('Não informado');
  });

  it('mostra os avisos de duplicidade recebidos do formulário, com link para os outros cadastros', async () => {
    history.replaceState({ avisos: [{ codigo: 'cliente.documento_repetido', mensagem: 'Já existe outro cadastro com este CPF/CNPJ.', ids: ['a', 'b'] }] }, '');
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.textContent).toContain('Já existe outro cadastro com este CPF/CNPJ.');
    expect(Array.from(el.querySelectorAll('a')).filter((a) => a.getAttribute('href')?.startsWith('/clientes/')).length).toBeGreaterThanOrEqual(2);
  });

  it('ignora avisos com formato inesperado no state', async () => {
    history.replaceState({ avisos: [{ qualquer: 'coisa' }, 'texto', null] }, '');
    const { fixture, el } = montar(false);
    await responder(fixture);

    expect(el.querySelector('.aviso')).toBeNull();
  });

  it('cliente inexistente mostra "não encontrado"', async () => {
    const { fixture, el } = montar(false);
    await proximoTick();
    http.expectOne(`${API}/clientes/cli-1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${API}/equipamentos`).flush({}, { status: 404, statusText: 'Not Found' });
    await proximoTick();
    fixture.detectChanges();

    expect(el.textContent).toContain('Cliente não encontrado.');
  });
});
