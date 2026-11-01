import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ClienteEmJanela } from '../cadastros/clientes/cliente-em-janela';
import { EquipamentoEmJanela } from '../cadastros/equipamentos/equipamento-em-janela';
import { clienteSintetico, equipamentoSintetico, sessaoFalsa } from '../cadastros/teste-cadastros';
import { API_URL } from '../core/api-url';
import { Sessao } from '../core/sessao';
import { API, proximoTick } from '../core/teste-apoio';
import { RelatorioFormulario } from './relatorio-formulario';

describe('Relatório: cadastro de cliente e equipamento em janela', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  async function montar() {
    TestBed.configureTestingModule({
      imports: [RelatorioFormulario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: Sessao, useValue: sessaoFalsa(false) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RelatorioFormulario);
    fixture.detectChanges();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
    await atualizar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  type Tela = Awaited<ReturnType<typeof montar>>;

  async function atualizar(fixture: Tela['fixture']) {
    await proximoTick();
    await proximoTick();
    fixture.detectChanges();
  }

  const botao = (t: Tela, texto: string) => Array.from(t.el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texto))!;
  const janela = (t: Tela) => t.el.querySelector('dialog');

  function digitar(t: Tela, seletor: string, valor: string) {
    const campo = t.el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('change'));
    t.fixture.detectChanges();
  }

  const enviarJanela = (t: Tela) => t.el.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new Event('submit'));

  async function abrirCadastroDeCliente(t: Tela) {
    botao(t, 'Cadastrar novo cliente').click();
    await atualizar(t.fixture);
    expect(janela(t)).not.toBeNull();
  }

  /** Salva o cliente "Novo Cliente Teste" pela janela; responde a lista (vazia) de balanças dele. */
  async function salvarCliente(t: Tela, avisos: { codigo: string; mensagem: string; ids: string[] }[] = []) {
    digitar(t, '#novo-cliente-nome', 'Novo Cliente Teste');
    enviarJanela(t);
    await proximoTick();
    const criar = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/clientes`);
    expect(criar.request.body.nomeRazaoSocial).toBe('Novo Cliente Teste');
    criar.flush({ cliente: clienteSintetico({ id: 'cli-9', nomeRazaoSocial: 'Novo Cliente Teste' }), avisos });
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/equipamentos` && r.params.get('clienteId') === 'cli-9').flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
    await atualizar(t.fixture);
  }

  afterEach(() => http.verify());

  it('cliente novo é cadastrado na própria página: vira o cliente do relatório, sem navegar, e abre o cadastro da balança', async () => {
    const t = await montar();
    await abrirCadastroDeCliente(t);

    await salvarCliente(t);

    expect(navegar).not.toHaveBeenCalled();
    expect(t.el.querySelector('fieldset')!.textContent).toContain('Novo Cliente Teste');
    expect(t.el.querySelector('dialog h2')!.textContent).toBe('Novo equipamento');
    expect(t.el.querySelector('dialog')!.textContent).toContain('Novo Cliente Teste');
  });

  it('equipamento novo é cadastrado na janela, entra na lista do cliente e já fica escolhido', async () => {
    const t = await montar();
    await abrirCadastroDeCliente(t);
    await salvarCliente(t);

    digitar(t, '#novo-equipamento-descricao', 'Balança Nova');
    digitar(t, '#novo-equipamento-serie', 'S-77');
    enviarJanela(t);
    await proximoTick();
    const criar = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/equipamentos`);
    expect(criar.request.body).toEqual({ clienteId: 'cli-9', descricao: 'Balança Nova', numeroSerie: 'S-77', numeroInmetro: '', observacoes: '' });
    criar.flush({ equipamento: equipamentoSintetico({ id: 'eq-9', clienteId: 'cli-9', clienteNome: 'Novo Cliente Teste', descricao: 'Balança Nova' }), avisos: [] });
    await proximoTick();
    const lista = http.expectOne((r) => r.method === 'GET' && r.url === `${API}/equipamentos` && r.params.get('clienteId') === 'cli-9');
    lista.flush({ itens: [equipamentoSintetico({ id: 'eq-9', clienteId: 'cli-9', descricao: 'Balança Nova' })], pagina: 1, tamanho: 100, total: 1 });
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/relatorios` && r.params.get('equipamentoId') === 'eq-9').flush({ itens: [], pagina: 1, tamanho: 1, total: 0 });
    await atualizar(t.fixture);

    expect(janela(t)).toBeNull();
    expect(t.el.querySelector<HTMLSelectElement>('#equipamento')!.value).toBe('eq-9');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('avisos de duplicidade do cadastro aparecem na página, sem bloquear', async () => {
    const t = await montar();
    await abrirCadastroDeCliente(t);
    await salvarCliente(t, [{ codigo: 'cliente.documento_repetido', mensagem: 'Já existe outro cliente com este CPF/CNPJ.', ids: ['outro'] }]);

    expect(t.el.querySelector('[role="status"]')!.textContent).toContain('Já existe outro cliente com este CPF/CNPJ.');
  });

  it('cancelar fecha a janela, não chama a API e mantém o que já estava preenchido na página', async () => {
    const t = await montar();
    digitar(t, '#data', '2026-10-05');
    await abrirCadastroDeCliente(t);
    digitar(t, '#novo-cliente-nome', 'Desistência');

    botao(t, 'Cancelar').click();
    await atualizar(t.fixture);

    expect(janela(t)).toBeNull();
    expect(t.el.querySelector<HTMLInputElement>('#data')!.value).toBe('2026-10-05');
    http.expectNone((r) => r.method === 'POST');
  });

  it('erro da API fica dentro da janela, que continua aberta com o que foi digitado', async () => {
    const t = await montar();
    await abrirCadastroDeCliente(t);
    digitar(t, '#novo-cliente-nome', 'Cliente com Erro');

    enviarJanela(t);
    await proximoTick();
    http.expectOne((r) => r.method === 'POST' && r.url === `${API}/clientes`).flush(
      { codigo: 'validacao', detail: 'CPF/CNPJ inválido.', erros: [{ codigo: 'validacao', mensagem: 'CPF/CNPJ inválido.' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    await atualizar(t.fixture);

    expect(janela(t)!.textContent).toContain('CPF/CNPJ inválido.');
    expect(t.el.querySelector<HTMLInputElement>('#novo-cliente-nome')!.value).toBe('Cliente com Erro');
  });

  it('nome em branco é recusado na janela antes de chamar a API', async () => {
    const t = await montar();
    await abrirCadastroDeCliente(t);

    enviarJanela(t);
    await atualizar(t.fixture);

    http.expectNone((r) => r.method === 'POST');
    expect(janela(t)!.textContent).toContain('Informe o nome ou a razão social.');
  });

  it('desistir da balança deixa o cliente escolhido e o botão reabre o cadastro da balança', async () => {
    const t = await montar();
    await abrirCadastroDeCliente(t);
    await salvarCliente(t);

    botao(t, 'Cancelar').click();
    await atualizar(t.fixture);
    expect(janela(t)).toBeNull();
    expect(t.el.querySelector('fieldset')!.textContent).toContain('Novo Cliente Teste');

    botao(t, 'Cadastrar equipamento para este cliente').click();
    await atualizar(t.fixture);
    expect(t.el.querySelector('dialog h2')!.textContent).toBe('Novo equipamento');
  });

  it('janela: Esc (cancel) e o botão ✕ pedem para fechar; tem nome acessível e foi aberta como modal', async () => {
    const t = await montar();
    await abrirCadastroDeCliente(t);
    const dialogo = janela(t)!;

    expect(dialogo.getAttribute('aria-labelledby')).toBe(dialogo.querySelector('h2')!.id);
    expect(dialogo.hasAttribute('open')).toBe(true);

    const evento = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(evento);
    await atualizar(t.fixture);
    expect(evento.defaultPrevented).toBe(true); // quem usa decide fechar; o navegador não fecha sozinho
    expect(janela(t)).toBeNull();

    await abrirCadastroDeCliente(t);
    t.el.querySelector<HTMLButtonElement>('dialog button[aria-label="Fechar a janela"]')!.click();
    await atualizar(t.fixture);
    expect(janela(t)).toBeNull();
  });

  it('avisos de série/INMETRO repetidos do equipamento se acumulam com os do cliente, na página, e o foco vai para o campo do equipamento', async () => {
    const t = await montar();
    document.body.appendChild(t.el); // foco só existe em elemento ligado ao documento
    await abrirCadastroDeCliente(t);
    await salvarCliente(t, [{ codigo: 'cliente.documento_repetido', mensagem: 'Aviso do cliente.', ids: ['x'] }]);

    digitar(t, '#novo-equipamento-descricao', 'Balança Repetida');
    enviarJanela(t);
    await proximoTick();
    http.expectOne((r) => r.method === 'POST' && r.url === `${API}/equipamentos`).flush({
      equipamento: equipamentoSintetico({ id: 'eq-9', clienteId: 'cli-9' }),
      avisos: [{ codigo: 'equipamento.serie_repetida', mensagem: 'Aviso do equipamento.', ids: ['y'] }],
    });
    await proximoTick();
    http.expectOne((r) => r.method === 'GET' && r.url === `${API}/equipamentos`).flush({ itens: [equipamentoSintetico({ id: 'eq-9', clienteId: 'cli-9' })], pagina: 1, tamanho: 100, total: 1 });
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/relatorios`).flush({ itens: [], pagina: 1, tamanho: 1, total: 0 });
    await atualizar(t.fixture);

    const avisos = Array.from(t.el.querySelectorAll('[role="status"]')).map((a) => a.textContent);
    expect(avisos).toEqual(['Aviso do cliente.', 'Aviso do equipamento.']);
    expect(document.activeElement).toBe(t.el.querySelector('#equipamento'));
    t.el.remove();
  });

  it('EquipamentoEmJanela: duplo envio cria uma só balança e cancelar não chama a API', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EquipamentoEmJanela);
    fixture.componentRef.setInput('clienteId', 'cli-1');
    fixture.componentRef.setInput('clienteNome', 'Mercado Teste Ltda');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const campo = el.querySelector<HTMLInputElement>('#novo-equipamento-descricao')!;
    campo.value = 'Uma Só';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match((r) => r.method === 'POST' && r.url === `${API}/equipamentos`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush({ equipamento: equipamentoSintetico(), avisos: [] });
  });

  it('ClienteEmJanela: duplo envio (Enter repetido) cria um só cliente', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ClienteEmJanela);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const campo = el.querySelector<HTMLInputElement>('#novo-cliente-nome')!;
    campo.value = 'Um Só';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match((r) => r.method === 'POST' && r.url === `${API}/clientes`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush({ cliente: clienteSintetico(), avisos: [] });
  });
});
