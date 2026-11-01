import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Servico } from '../cadastros/catalogo/catalogo-api';
import { API_URL } from '../core/api-url';
import { API, proximoTick } from '../core/teste-apoio';
import { RelatorioRetificacao } from './relatorio-retificacao';
import { detalheSintetico } from './teste-relatorios';

const servico = (s: Partial<Servico> = {}): Servico => ({
  id: 's-1', codigoOrigem: null, descricao: 'Troca de célula', precoSugerido: 150, ativo: true,
  criadoEm: '2026-11-01T10:00:00Z', atualizadoEm: '2026-11-01T10:00:00Z', versao: 'v1', ...s,
});

describe('RelatorioRetificacao', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  function montar() {
    TestBed.configureTestingModule({
      imports: [RelatorioRetificacao],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r-1' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RelatorioRetificacao);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  type Tela = ReturnType<typeof montar>;

  const depois = async (fixture: Tela['fixture']) => {
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
    await proximoTick();
  };

  async function abrir(detalhe = detalheSintetico({ versao: 'v5' }), catalogo: Servico[] = []) {
    const t = montar();
    await proximoTick();
    http.expectOne(`${API}/relatorios/r-1`).flush(detalhe);
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({ itens: catalogo, pagina: 1, tamanho: 100, total: catalogo.length });
    await depois(t.fixture);
    return t;
  }

  function preencher(t: Tela, seletor: string, valor: string) {
    const campo = t.el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('change'));
    t.fixture.detectChanges();
  }

  const enviar = async (t: Tela) => {
    t.el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await depois(t.fixture);
  };

  afterEach(() => http.verify());

  it('carrega o relatório emitido, mostra cliente e balança só para leitura e explica que o número fica', async () => {
    const t = await abrir();

    expect(t.el.querySelector('h1')!.textContent).toContain('Retificar relatório nº 000042');
    expect(t.el.textContent).toContain('Mercado Teste Ltda');
    expect(t.el.textContent).toContain('Balança Teste');
    expect(t.el.textContent).toContain('mantém o número');
    expect(t.el.querySelector<HTMLTextAreaElement>('#servico')!.value).toBe('Troca da célula de carga');
    expect(t.el.querySelector<HTMLInputElement>('#total')!.value).toBe('150');
    expect(t.el.querySelector<HTMLInputElement>('#desconto')!.value).toBe('10');
    expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-123');
    expect(t.el.querySelector('#cliente')).toBeNull();
    expect(t.el.querySelector('#equipamento')).toBeNull();
  });

  it('tipo de serviço em branco mostra a mensagem e marca o campo como inválido (o envio não fica mudo)', async () => {
    const t = await abrir();
    preencher(t, '#motivo', 'Ajuste');
    preencher(t, '#tipo', '');

    await enviar(t);

    http.expectNone(`${API}/relatorios/r-1/retificar`);
    expect(t.el.querySelector('#tipo-erro')!.textContent).toContain('Escolha o tipo de serviço.');
    expect(t.el.querySelector('#tipo')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('sem motivo não chama a API e mostra a mensagem; motivo só com espaços também é recusado', async () => {
    const t = await abrir();

    await enviar(t);
    http.expectNone(`${API}/relatorios/r-1/retificar`);
    expect(t.el.textContent).toContain('Informe o motivo da retificação.');

    preencher(t, '#motivo', '    ');
    await enviar(t);
    http.expectNone(`${API}/relatorios/r-1/retificar`);
  });

  it('retifica enviando o motivo, os valores convertidos e a versão que a pessoa viu, e volta ao detalhe', async () => {
    const t = await abrir();
    preencher(t, '#motivo', '  Valor digitado errado  ');
    preencher(t, '#total', '1.234,50');
    preencher(t, '#servico', 'Serviço corrigido');

    await enviar(t);

    const pedido = http.expectOne(`${API}/relatorios/r-1/retificar`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      motivo: 'Valor digitado errado',
      atualizarDadosDeCadastro: false,
      tipoServico: 'Corretiva',
      dataServico: '2026-10-30',
      servicoExecutado: 'Serviço corrigido',
      observacoes: 'Sem observações extras',
      verificacaoAnteriorData: '2025-10-01',
      verificacaoAnteriorCertificado: 'CERT-123',
      numeroSeloReparador: 'SELO-9',
      garantiaDias: 30,
      total: 1234.5,
      desconto: 10,
      catalogoServicoId: null,
      versao: 'v5',
    });
    pedido.flush(detalheSintetico({ revisao: 1, versao: 'v6' }));
    await depois(t.fixture);
    expect(navegar).toHaveBeenCalledWith(['/relatorios', 'r-1']);
  });

  it('a opção de atualizar os dados cadastrais só vai marcada se a pessoa marcar', async () => {
    const t = await abrir();
    preencher(t, '#motivo', 'Cadastro do cliente estava errado');
    const caixa = t.el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(caixa.checked).toBe(false);
    caixa.checked = true;
    caixa.dispatchEvent(new Event('input'));
    caixa.dispatchEvent(new Event('change'));
    t.fixture.detectChanges();

    await enviar(t);

    const pedido = http.expectOne(`${API}/relatorios/r-1/retificar`);
    expect(pedido.request.body.atualizarDadosDeCadastro).toBe(true);
    pedido.flush(detalheSintetico({ revisao: 1 }));
    await depois(t.fixture);
  });

  it('retificação sem nenhuma diferença é recusada pela API e a mensagem aparece, sem sair da tela', async () => {
    const t = await abrir();
    preencher(t, '#motivo', 'Nada mudou');

    await enviar(t);
    http.expectOne(`${API}/relatorios/r-1/retificar`).flush(
      { codigo: 'relatorio.sem_alteracao', detail: 'Nenhum dado foi alterado.', erros: [{ codigo: 'relatorio.sem_alteracao', mensagem: 'Nenhum dado foi alterado.' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    await depois(t.fixture);

    expect(t.el.textContent).toContain('Nenhum dado foi alterado.');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('conflito de versão avisa e permite recarregar os dados atuais', async () => {
    const t = await abrir();
    preencher(t, '#motivo', 'Ajuste');

    await enviar(t);
    http.expectOne(`${API}/relatorios/r-1/retificar`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
    await depois(t.fixture);
    expect(t.el.textContent).toContain('Outra pessoa alterou este relatório');

    t.el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    await proximoTick();
    http.expectOne(`${API}/relatorios/r-1`).flush(detalheSintetico({ versao: 'v9', servicoExecutado: 'Texto atual' }));
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
    await depois(t.fixture);
    expect(t.el.querySelector<HTMLTextAreaElement>('#servico')!.value).toBe('Texto atual');
    expect(t.el.querySelector<HTMLTextAreaElement>('#motivo')!.value).toBe('');
  });

  it('não retifica rascunho nem cancelado: mostra o motivo e nenhum formulário', async () => {
    const rascunho = await abrir(detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null }));
    expect(rascunho.el.textContent).toContain('ainda é um rascunho');
    expect(rascunho.el.querySelector('form')).toBeNull();
    TestBed.resetTestingModule();

    const cancelado = await abrir(detalheSintetico({ status: 'Cancelado' }));
    expect(cancelado.el.textContent).toContain('foi cancelado e não pode ser retificado');
    expect(cancelado.el.querySelector('form')).toBeNull();
  });

  it('relatório inexistente (ou de outro técnico) mostra o erro, sem formulário', async () => {
    const t = montar();
    await proximoTick();
    http.expectOne(`${API}/relatorios/r-1`).flush({ detail: 'Relatório não encontrado.' }, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
    await depois(t.fixture);

    expect(t.el.textContent).toContain('Relatório não encontrado.');
    expect(t.el.querySelector('form')).toBeNull();
  });

  it('o item do catálogo do relatório continua selecionável mesmo desativado depois', async () => {
    const t = await abrir(detalheSintetico({ catalogoServicoId: 's-antigo' }), [servico()]);

    const select = t.el.querySelector<HTMLSelectElement>('#catalogo')!;
    expect(select.textContent).toContain('Troca de célula');
    expect(select.textContent).toContain('Item atual do catálogo (inativo)');
    expect(select.value).toBe('s-antigo');
  });

  it('desconto maior que o total é recusado antes de chamar a API', async () => {
    const t = await abrir();
    preencher(t, '#motivo', 'Ajuste');
    preencher(t, '#desconto', '999');

    await enviar(t);

    http.expectNone(`${API}/relatorios/r-1/retificar`);
    expect(t.el.textContent).toContain('O desconto não pode ser maior que o total.');
  });

  it('Enter repetido durante o envio não manda a retificação duas vezes', async () => {
    const t = await abrir();
    preencher(t, '#motivo', 'Ajuste');
    const formulario = t.el.querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match(`${API}/relatorios/r-1/retificar`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush(detalheSintetico({ revisao: 1 }));
    await depois(t.fixture);
  });
});
