import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { API, proximoTick } from '../../core/teste-apoio';
import { clienteSintetico } from '../teste-cadastros';
import { ClienteFormulario } from './cliente-formulario';

describe('ClienteFormulario', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  function montar(id: string | null) {
    TestBed.configureTestingModule({
      imports: [ClienteFormulario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ClienteFormulario);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function digitar(fixture: ReturnType<typeof montar>['fixture'], id: string, valor: string) {
    const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function enviar(fixture: ReturnType<typeof montar>['fixture']) {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  it('novo cliente sem nome: não chama a API e mostra a mensagem', async () => {
    const { fixture, el } = montar(null);

    await enviar(fixture);
    fixture.detectChanges();

    http.expectNone(`${API}/clientes`);
    expect(el.textContent).toContain('Informe o nome ou a razão social.');
  });

  it('cria o cliente, leva ao detalhe e repassa os avisos de duplicidade', async () => {
    const { fixture } = montar(null);
    await digitar(fixture, 'nome', 'Mercado Novo');
    await digitar(fixture, 'documento', '123.456.789-09');

    await enviar(fixture);
    const pedido = http.expectOne(`${API}/clientes`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toMatchObject({ nomeRazaoSocial: 'Mercado Novo', documento: '123.456.789-09' });
    const aviso = { codigo: 'cliente.documento_repetido', mensagem: 'Já existe outro cadastro com este CPF/CNPJ.', ids: ['outro'] };
    pedido.flush({ cliente: clienteSintetico({ id: 'novo' }), avisos: [aviso] });
    await proximoTick();

    expect(navegar).toHaveBeenCalledWith(['/clientes', 'novo'], { state: { avisos: [aviso] } });
  });

  it('erros de validação da API aparecem todos, sem navegar', async () => {
    const { fixture, el } = montar(null);
    await digitar(fixture, 'nome', 'Mercado Novo');

    await enviar(fixture);
    http.expectOne(`${API}/clientes`).flush(
      { detail: 'CPF/CNPJ inválido.', codigo: 'validacao', erros: [{ codigo: 'validacao', mensagem: 'CPF/CNPJ inválido.' }, { codigo: 'validacao', mensagem: 'CEP inválido.' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    await proximoTick();
    fixture.detectChanges();

    expect(el.textContent).toContain('CPF/CNPJ inválido.');
    expect(el.textContent).toContain('CEP inválido.');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('edição carrega o cadastro e salva com a versão que a pessoa viu', async () => {
    const { fixture, el } = montar('cli-1');
    http.expectOne(`${API}/clientes/cli-1`).flush(clienteSintetico({ versao: 'v7', nomeFantasia: null }));
    await proximoTick();
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('#nome')!.value).toBe('Mercado Teste Ltda');
    expect(el.querySelector<HTMLInputElement>('#fantasia')!.value).toBe('');

    await digitar(fixture, 'nome', 'Mercado Renomeado');
    await enviar(fixture);

    const pedido = http.expectOne(`${API}/clientes/cli-1`);
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toMatchObject({ nomeRazaoSocial: 'Mercado Renomeado', versao: 'v7' });
    pedido.flush({ cliente: clienteSintetico({ versao: 'v8' }), avisos: [] });
    await proximoTick();
    expect(navegar).toHaveBeenCalledWith(['/clientes', 'cli-1'], { state: { avisos: [] } });
  });

  it('conflito de versão avisa e permite recarregar os dados atuais', async () => {
    const { fixture, el } = montar('cli-1');
    http.expectOne(`${API}/clientes/cli-1`).flush(clienteSintetico({ versao: 'v7' }));
    await proximoTick();
    fixture.detectChanges();

    await enviar(fixture);
    http.expectOne(`${API}/clientes/cli-1`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Outra pessoa alterou este cliente');
    expect(navegar).not.toHaveBeenCalled();

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    http.expectOne(`${API}/clientes/cli-1`).flush(clienteSintetico({ versao: 'v9', nomeRazaoSocial: 'Nome Atualizado' }));
    await proximoTick();
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('#nome')!.value).toBe('Nome Atualizado');
    expect(el.textContent).not.toContain('Outra pessoa alterou este cliente');
  });

  it('cliente inexistente (ou inativo para o técnico) mostra o erro da API', async () => {
    const { fixture, el } = montar('nao-existe');
    http.expectOne(`${API}/clientes/nao-existe`).flush({ detail: 'Cliente não encontrado.' }, { status: 404, statusText: 'Not Found' });
    await proximoTick();
    fixture.detectChanges();

    expect(el.textContent).toContain('Cliente não encontrado.');
    // não oferece um formulário vazio para "salvar" um cadastro que não existe
    expect(el.querySelector('form')).toBeNull();
  });

  it('Enter repetido durante o envio não manda a gravação duas vezes', async () => {
    const { fixture } = montar(null);
    await digitar(fixture, 'nome', 'Mercado Novo');
    const formulario = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match(`${API}/clientes`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush({ cliente: clienteSintetico({ id: 'novo' }), avisos: [] });
    await proximoTick();
  });
});
