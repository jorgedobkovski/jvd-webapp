import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../core/api-url';
import { API, proximoTick } from '../../core/teste-apoio';
import { Emissor } from './emissor-api';
import { EmissorFormulario } from './emissor-formulario';

function emissor(sobrescrever: Partial<Emissor> = {}): Emissor {
  return {
    razaoSocial: 'Empresa Teste Ltda',
    nomeFantasia: null,
    cnpj: '12345678000195',
    inscricaoEstadual: null,
    logradouro: null,
    numero: null,
    bairro: null,
    cep: null,
    cidade: 'Porto Velho',
    uf: 'RO',
    telefones: null,
    numeroAutorizacaoIpem: 'IPEM-77',
    responsavelTecnicoNome: 'Responsável Sintético',
    responsavelTecnicoCpf: null,
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 'v1',
    ...sobrescrever,
  };
}

describe('EmissorFormulario', () => {
  let http: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({
      imports: [EmissorFormulario],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EmissorFormulario);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const depois = async (fixture: ReturnType<typeof montar>['fixture']) => {
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  function digitar(fixture: ReturnType<typeof montar>['fixture'], seletor: string, valor: string) {
    const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function enviar(fixture: ReturnType<typeof montar>['fixture']) {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await depois(fixture);
  }

  afterEach(() => http.verify());

  it('nunca configurado (404): mostra o aviso e a primeira gravação NÃO leva versão', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/emissor`).flush({ detail: 'Emissor não configurado.' }, { status: 404, statusText: 'Not Found' });
    await depois(fixture);
    expect(el.textContent).toContain('A empresa ainda não foi configurada');
    expect(el.querySelector('h1')!.textContent).toContain('Configurar a empresa');

    digitar(fixture, '#razao', 'Empresa Nova Ltda');
    digitar(fixture, '#cnpj', '12.345.678/0001-95');
    await enviar(fixture);

    const pedido = http.expectOne(`${API}/emissor`);
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toMatchObject({ razaoSocial: 'Empresa Nova Ltda', cnpj: '12.345.678/0001-95' });
    expect('versao' in pedido.request.body).toBe(false);
    pedido.flush(emissor({ razaoSocial: 'Empresa Nova Ltda', versao: 'v1' }));
    await depois(fixture);
    expect(el.textContent).toContain('Dados da empresa salvos.');
    expect(el.querySelector('h1')!.textContent).toContain('Dados da empresa');
  });

  it('razão social e CNPJ obrigatórios: não chama a API', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/emissor`).flush({}, { status: 404, statusText: 'Not Found' });
    await depois(fixture);

    await enviar(fixture);

    http.expectNone(`${API}/emissor`);
    expect(el.textContent).toContain('Informe a razão social.');
    expect(el.textContent).toContain('Informe o CNPJ.');
  });

  it('já configurado: carrega os dados e salva com a versão que a pessoa viu', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/emissor`).flush(emissor({ versao: 'v4' }));
    await depois(fixture);
    expect(el.querySelector<HTMLInputElement>('#razao')!.value).toBe('Empresa Teste Ltda');
    expect(el.querySelector<HTMLInputElement>('#ipem')!.value).toBe('IPEM-77');
    expect(el.querySelector<HTMLInputElement>('#fantasia')!.value).toBe('');

    digitar(fixture, '#fantasia', 'Teste Balanças');
    await enviar(fixture);

    const pedido = http.expectOne(`${API}/emissor`);
    expect(pedido.request.body).toMatchObject({ nomeFantasia: 'Teste Balanças', versao: 'v4' });
    pedido.flush(emissor({ nomeFantasia: 'Teste Balanças', versao: 'v5' }));
    await depois(fixture);

    // A versão nova vale para a próxima gravação.
    await enviar(fixture);
    expect(http.expectOne(`${API}/emissor`).request.body.versao).toBe('v5');
  });

  it('conflito de versão avisa e recarrega os dados atuais', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/emissor`).flush(emissor());
    await depois(fixture);

    await enviar(fixture);
    http.expectOne(`${API}/emissor`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
    await depois(fixture);
    expect(el.textContent).toContain('foram alterados por outra pessoa');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    http.expectOne(`${API}/emissor`).flush(emissor({ razaoSocial: 'Razão Atualizada', versao: 'v9' }));
    await depois(fixture);
    expect(el.querySelector<HTMLInputElement>('#razao')!.value).toBe('Razão Atualizada');
  });

  it('erro de validação da API (CNPJ inválido) aparece na tela', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/emissor`).flush(emissor());
    await depois(fixture);

    await enviar(fixture);
    http.expectOne(`${API}/emissor`).flush({ detail: 'CNPJ inválido.', erros: [{ codigo: 'validacao', mensagem: 'CNPJ inválido.' }] }, { status: 400, statusText: 'Bad Request' });
    await depois(fixture);

    expect(el.textContent).toContain('CNPJ inválido.');
  });

  it('falha ao carregar (que não é 404) mostra o erro e permite tentar de novo, sem formulário', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/emissor`).flush({}, { status: 500, statusText: 'Server Error' });
    await depois(fixture);
    expect(el.querySelector('form')).toBeNull();

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    http.expectOne(`${API}/emissor`).flush(emissor());
    await depois(fixture);
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('Enter repetido durante o envio não manda a gravação duas vezes', async () => {
    const { fixture } = montar();
    http.expectOne(`${API}/emissor`).flush(emissor());
    await depois(fixture);
    const formulario = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match(`${API}/emissor`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush(emissor({ versao: 'v2' }));
    await depois(fixture);
  });
});
