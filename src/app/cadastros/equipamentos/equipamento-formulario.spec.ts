import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { Sessao } from '../../core/sessao';
import { API, proximoTick } from '../../core/teste-apoio';
import { clienteSintetico, equipamentoSintetico, sessaoFalsa } from '../teste-cadastros';
import { EquipamentoFormulario } from './equipamento-formulario';

describe('EquipamentoFormulario', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  function montar(opcoes: { id?: string; clienteId?: string; gestor?: boolean } = {}) {
    TestBed.configureTestingModule({
      imports: [EquipamentoFormulario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: Sessao, useValue: sessaoFalsa(opcoes.gestor ?? false) },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(opcoes.id ? { id: opcoes.id } : {}),
              queryParamMap: convertToParamMap(opcoes.clienteId ? { clienteId: opcoes.clienteId } : {}),
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EquipamentoFormulario);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function depois(fixture: ReturnType<typeof montar>['fixture']) {
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

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

  it('sem escolher cliente nem descrever: não chama a API e mostra as mensagens', async () => {
    const { fixture, el } = montar();
    await depois(fixture);

    await enviar(fixture);

    http.expectNone(`${API}/equipamentos`);
    expect(el.textContent).toContain('Escolha o cliente.');
    expect(el.textContent).toContain('Informe a descrição');
  });

  it('chegando do detalhe do cliente, já vem com o cliente escolhido e cria o equipamento', async () => {
    const { fixture, el } = montar({ clienteId: 'cli-1' });
    http.expectOne(`${API}/clientes/cli-1`).flush(clienteSintetico());
    await depois(fixture);
    expect(el.textContent).toContain('Mercado Teste Ltda');

    digitar(fixture, '#descricao', 'Balança nova');
    digitar(fixture, '#serie', 'S-9');
    await enviar(fixture);

    const pedido = http.expectOne(`${API}/equipamentos`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toMatchObject({ clienteId: 'cli-1', descricao: 'Balança nova', numeroSerie: 'S-9' });
    const aviso = { codigo: 'equipamento.serie_repetida', mensagem: 'Já existe outro equipamento com este número de série.', ids: ['x'] };
    pedido.flush({ equipamento: equipamentoSintetico({ id: 'novo' }), avisos: [aviso] });
    await depois(fixture);

    expect(navegar).toHaveBeenCalledWith(['/equipamentos', 'novo', 'editar'], { state: { avisos: [aviso] } });
  });

  it('escolhe o cliente por busca entre os ATIVOS', async () => {
    const { fixture, el } = montar();
    await depois(fixture);

    digitar(fixture, '#busca-cliente', 'mercado');
    el.querySelector<HTMLButtonElement>('button.botao-secundario')!.click();
    const busca = http.expectOne((r) => r.url === `${API}/clientes`);
    expect(busca.request.params.get('busca')).toBe('mercado');
    expect(busca.request.params.get('ativo')).toBe('true');
    busca.flush({ itens: [clienteSintetico()], pagina: 1, tamanho: 8, total: 1 });
    await depois(fixture);

    const opcao = Array.from(el.querySelectorAll<HTMLButtonElement>('ul button')).find((b) => b.textContent?.includes('Mercado Teste Ltda'))!;
    opcao.click();
    await depois(fixture);

    expect(el.querySelector('#busca-cliente')).toBeNull();
    expect(el.textContent).toContain('Mercado Teste Ltda');
  });

  it('edição: carrega, avisa da transferência ao trocar de cliente e salva com a versão', async () => {
    const { fixture, el } = montar({ id: 'eq-1' });
    http.expectOne(`${API}/equipamentos/eq-1`).flush(equipamentoSintetico({ versao: 'ev5' }));
    await depois(fixture);
    expect(el.querySelector<HTMLInputElement>('#descricao')!.value).toBe('Balança Teste');
    expect(el.textContent).not.toContain('será transferida');

    // Escolhe outro cliente.
    el.querySelectorAll<HTMLButtonElement>('fieldset button')[0].click();
    await depois(fixture);
    digitar(fixture, '#busca-cliente', 'outro');
    el.querySelector<HTMLButtonElement>('fieldset button.botao-secundario')!.click();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens: [clienteSintetico({ id: 'cli-2', nomeRazaoSocial: 'Outro Cliente' })], pagina: 1, tamanho: 8, total: 1 });
    await depois(fixture);
    Array.from(el.querySelectorAll<HTMLButtonElement>('ul button')).find((b) => b.textContent?.includes('Outro Cliente'))!.click();
    await depois(fixture);
    expect(el.textContent).toContain('será transferida');

    await enviar(fixture);
    const pedido = http.expectOne(`${API}/equipamentos/eq-1`);
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toMatchObject({ clienteId: 'cli-2', versao: 'ev5' });
    pedido.flush({ equipamento: equipamentoSintetico({ clienteId: 'cli-2', clienteNome: 'Outro Cliente', versao: 'ev6' }), avisos: [] });
    await depois(fixture);

    expect(el.textContent).toContain('Equipamento salvo.');
    expect(el.textContent).not.toContain('será transferida');
  });

  it('cancelar a troca de cliente mantém o cliente atual, sem buscar de novo', async () => {
    const { fixture, el } = montar({ id: 'eq-1' });
    http.expectOne(`${API}/equipamentos/eq-1`).flush(equipamentoSintetico());
    await depois(fixture);

    el.querySelectorAll<HTMLButtonElement>('fieldset button')[0].click();
    await depois(fixture);
    expect(el.querySelector('#busca-cliente')).not.toBeNull();

    Array.from(el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.includes('Cancelar e manter'))!.click();
    await depois(fixture);

    expect(el.querySelector('#busca-cliente')).toBeNull();
    expect(el.textContent).toContain('Mercado Teste Ltda');
    expect(el.textContent).not.toContain('será transferida');
  });

  it('equipamento inexistente (ou de cliente inativo para o técnico) mostra o erro sem formulário vazio', async () => {
    const { fixture, el } = montar({ id: 'nao-existe' });
    http.expectOne(`${API}/equipamentos/nao-existe`).flush({ detail: 'Equipamento não encontrado.' }, { status: 404, statusText: 'Not Found' });
    await depois(fixture);

    expect(el.textContent).toContain('Equipamento não encontrado.');
    expect(el.querySelector('form')).toBeNull();
  });

  it('Enter repetido durante o envio não manda a gravação duas vezes', async () => {
    const { fixture } = montar({ clienteId: 'cli-1' });
    http.expectOne(`${API}/clientes/cli-1`).flush(clienteSintetico());
    await depois(fixture);
    digitar(fixture, '#descricao', 'Balança nova');
    const formulario = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match(`${API}/equipamentos`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush({ equipamento: equipamentoSintetico({ id: 'novo' }), avisos: [] });
    await depois(fixture);
  });

  it('só o gestor vê Desativar', async () => {
    const tecnico = montar({ id: 'eq-1', gestor: false });
    http.expectOne(`${API}/equipamentos/eq-1`).flush(equipamentoSintetico());
    await depois(tecnico.fixture);
    expect(tecnico.el.textContent).not.toContain('Desativar');
    TestBed.resetTestingModule();

    const gestor = montar({ id: 'eq-1', gestor: true });
    http.expectOne(`${API}/equipamentos/eq-1`).flush(equipamentoSintetico());
    await depois(gestor.fixture);
    expect(gestor.el.textContent).toContain('Desativar');
  });

  it('conflito de versão avisa e permite recarregar', async () => {
    const { fixture, el } = montar({ id: 'eq-1' });
    http.expectOne(`${API}/equipamentos/eq-1`).flush(equipamentoSintetico({ versao: 'ev5' }));
    await depois(fixture);

    await enviar(fixture);
    http.expectOne(`${API}/equipamentos/eq-1`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
    await depois(fixture);
    expect(el.textContent).toContain('Outra pessoa alterou este equipamento');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    http.expectOne(`${API}/equipamentos/eq-1`).flush(equipamentoSintetico({ versao: 'ev9', descricao: 'Descrição atual' }));
    await depois(fixture);
    expect(el.querySelector<HTMLInputElement>('#descricao')!.value).toBe('Descrição atual');
  });
});
