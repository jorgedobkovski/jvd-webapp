import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { API, proximoTick } from '../../core/teste-apoio';
import { Servico, paramsDoCatalogo } from './catalogo-api';
import { ServicoFormulario } from './servico-formulario';

function servico(sobrescrever: Partial<Servico> = {}): Servico {
  return { id: 's-1', codigoOrigem: 'C1', descricao: 'Troca de célula', precoSugerido: 150.5, ativo: true, criadoEm: '2026-11-01T10:00:00Z', atualizadoEm: '2026-11-01T10:00:00Z', versao: 'v1', ...sobrescrever };
}

describe('ServicoFormulario', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  function montar(id: string | null = null) {
    TestBed.configureTestingModule({
      imports: [ServicoFormulario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ServicoFormulario);
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

  it('descrição obrigatória: não chama a API', async () => {
    const { fixture, el } = montar();
    await enviar(fixture);

    http.expectNone(`${API}/catalogo-servicos`);
    expect(el.textContent).toContain('Informe a descrição do serviço.');
  });

  it('preço inválido é recusado antes de chamar a API', async () => {
    const { fixture, el } = montar();
    digitar(fixture, '#descricao', 'Aferição');
    digitar(fixture, '#preco', '10,999');

    await enviar(fixture);

    http.expectNone(`${API}/catalogo-servicos`);
    expect(el.textContent).toContain('até 2 casas decimais');
  });

  it('cria convertendo o preço digitado ("1.234,50") para número, e leva à edição com os avisos', async () => {
    const { fixture } = montar();
    digitar(fixture, '#descricao', 'Aferição');
    digitar(fixture, '#codigo', 'AF1');
    digitar(fixture, '#preco', '1.234,50');

    await enviar(fixture);
    const pedido = http.expectOne(`${API}/catalogo-servicos`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({ descricao: 'Aferição', codigoOrigem: 'AF1', precoSugerido: 1234.5 });
    const aviso = { codigo: 'catalogo.descricao_repetida', mensagem: 'Já existe outro serviço com esta descrição.', ids: ['x'] };
    pedido.flush({ servico: servico({ id: 'novo' }), avisos: [aviso] });
    await depois(fixture);

    expect(navegar).toHaveBeenCalledWith(['/catalogo', 'novo', 'editar'], { state: { avisos: [aviso] } });
  });

  it('preço vazio vai como nulo (sem preço sugerido)', async () => {
    const { fixture } = montar();
    digitar(fixture, '#descricao', 'Aferição');

    await enviar(fixture);
    const pedido = http.expectOne(`${API}/catalogo-servicos`);
    expect(pedido.request.body.precoSugerido).toBeNull();
    pedido.flush({ servico: servico(), avisos: [] });
    await depois(fixture);
  });

  it('edição mostra o preço com vírgula e salva com a versão que a pessoa viu', async () => {
    const { fixture, el } = montar('s-1');
    http.expectOne(`${API}/catalogo-servicos/s-1`).flush(servico({ versao: 'v7' }));
    await depois(fixture);
    expect(el.querySelector<HTMLInputElement>('#preco')!.value).toBe('150,5');

    digitar(fixture, '#descricao', 'Troca de célula de carga');
    await enviar(fixture);

    const pedido = http.expectOne(`${API}/catalogo-servicos/s-1`);
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toMatchObject({ descricao: 'Troca de célula de carga', precoSugerido: 150.5, versao: 'v7' });
    pedido.flush({ servico: servico({ descricao: 'Troca de célula de carga', versao: 'v8' }), avisos: [] });
    await depois(fixture);
    expect(el.textContent).toContain('Serviço salvo.');
  });

  it('conflito de versão avisa e permite recarregar', async () => {
    const { fixture, el } = montar('s-1');
    http.expectOne(`${API}/catalogo-servicos/s-1`).flush(servico());
    await depois(fixture);

    await enviar(fixture);
    http.expectOne(`${API}/catalogo-servicos/s-1`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
    await depois(fixture);
    expect(el.textContent).toContain('Outra pessoa alterou este serviço');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    http.expectOne(`${API}/catalogo-servicos/s-1`).flush(servico({ descricao: 'Descrição atual', versao: 'v9' }));
    await depois(fixture);
    expect(el.querySelector<HTMLInputElement>('#descricao')!.value).toBe('Descrição atual');
  });

  it('desativa só depois de confirmar e recarrega o estado', async () => {
    const { fixture, el } = montar('s-1');
    http.expectOne(`${API}/catalogo-servicos/s-1`).flush(servico());
    await depois(fixture);

    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Desativar')!.click();
    fixture.detectChanges();
    http.expectNone(`${API}/catalogo-servicos/s-1/desativar`);
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Sim, desativar'))!.click();
    http.expectOne(`${API}/catalogo-servicos/s-1/desativar`).flush(null, { status: 204, statusText: 'No Content' });
    await proximoTick();
    http.expectOne(`${API}/catalogo-servicos/s-1`).flush(servico({ ativo: false }));
    await depois(fixture);

    expect(el.textContent).toContain('Inativo');
    expect(el.textContent).toContain('Reativar');
  });

  it('serviço inexistente mostra o erro sem formulário vazio', async () => {
    const { fixture, el } = montar('nao-existe');
    http.expectOne(`${API}/catalogo-servicos/nao-existe`).flush({ detail: 'Serviço não encontrado.' }, { status: 404, statusText: 'Not Found' });
    await depois(fixture);

    expect(el.textContent).toContain('Serviço não encontrado.');
    expect(el.querySelector('form')).toBeNull();
  });

  it('Enter repetido durante o envio não manda a gravação duas vezes', async () => {
    const { fixture } = montar();
    digitar(fixture, '#descricao', 'Aferição');
    const formulario = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match(`${API}/catalogo-servicos`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush({ servico: servico({ id: 'novo' }), avisos: [] });
    await depois(fixture);
  });
});

describe('paramsDoCatalogo', () => {
  it('só envia o preenchido', () => {
    expect(paramsDoCatalogo({})).toEqual({ pagina: 1, tamanho: 20 });
    expect(paramsDoCatalogo({ busca: ' célula ', ativo: false, pagina: 2 })).toEqual({ busca: 'célula', ativo: false, pagina: 2, tamanho: 20 });
  });
});
