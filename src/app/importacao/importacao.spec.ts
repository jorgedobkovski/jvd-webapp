import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../core/api-url';
import { API, proximoTick } from '../core/teste-apoio';
import { Ocorrencia, RelatorioDeImportacao } from './importacao-api';
import { ImportacaoTela } from './importacao';

const relatorio = (s: Partial<RelatorioDeImportacao> = {}): RelatorioDeImportacao => ({
  importacaoId: null,
  tipo: 'Clientes',
  simulacao: true,
  totalLidos: 120,
  totalImportados: 100,
  totalRejeitados: 5,
  totalAvisos: 7,
  totalIgnoradas: 8,
  ocorrencias: [
    { linha: 4, gravidade: 'Erro', motivo: 'Código de serviço repetido na planilha.' },
    { linha: 9, gravidade: 'Aviso', motivo: 'CPF/CNPJ inválido: o cadastro ficou incompleto.' },
  ],
  ...s,
});

const historicoVazio = { itens: [], pagina: 1, tamanho: 10, total: 0 };

describe('ImportacaoTela', () => {
  let http: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({
      imports: [ImportacaoTela],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ImportacaoTela);
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

  async function abrir(historico: object = historicoVazio) {
    const t = montar();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes`).flush(historico);
    await depois(t.fixture);
    return t;
  }

  function planilha(nome = 'clientes.xlsx', tamanho = 2048): File {
    const arquivo = new File([new Uint8Array(8)], nome);
    Object.defineProperty(arquivo, 'size', { value: tamanho });
    return arquivo;
  }

  function escolher(t: Tela, arquivo: File | null) {
    const campo = t.el.querySelector<HTMLInputElement>('#arquivo')!;
    Object.defineProperty(campo, 'files', { value: arquivo ? [arquivo] : [], configurable: true });
    campo.dispatchEvent(new Event('change'));
    t.fixture.detectChanges();
  }

  const botao = (t: Tela, texto: string) => Array.from(t.el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texto))!;

  async function simular(t: Tela, resposta: RelatorioDeImportacao = relatorio()) {
    botao(t, 'Simular importação').click();
    await proximoTick();
    const pedido = http.expectOne((r) => r.url === `${API}/importacoes/clientes`);
    expect(pedido.request.params.get('simular')).toBe('true');
    pedido.flush(resposta);
    await depois(t.fixture);
  }

  afterEach(() => http.verify());

  it('sem planilha escolhida não chama a API e pede a planilha', async () => {
    const t = await abrir();

    botao(t, 'Simular importação').click();
    await depois(t.fixture);

    http.expectNone((r) => r.url.startsWith(`${API}/importacoes/`));
    expect(t.el.textContent).toContain('Escolha a planilha antes de simular.');
  });

  it('recusa arquivo que não é .xlsx, vazio ou maior que 10 MB, sem chamar a API', async () => {
    const t = await abrir();

    escolher(t, planilha('clientes.csv'));
    expect(t.el.textContent).toContain('Escolha um arquivo .xlsx');
    escolher(t, planilha('vazio.xlsx', 0));
    expect(t.el.textContent).toContain('O arquivo está vazio.');
    escolher(t, planilha('grande.xlsx', 11 * 1024 * 1024));
    expect(t.el.textContent).toContain('O arquivo passa de 10 MB.');
    expect(t.el.textContent).not.toContain('Arquivo escolhido');
    http.expectNone((r) => r.url.startsWith(`${API}/importacoes/`));
  });

  it('simula enviando o arquivo no campo "arquivo" e mostra totais e ocorrências SEM oferecer importar antes de simular', async () => {
    const t = await abrir();
    expect(t.el.textContent).not.toContain('Importar de verdade');
    escolher(t, planilha());
    expect(t.el.textContent).toContain('Arquivo escolhido: clientes.xlsx');

    botao(t, 'Simular importação').click();
    await proximoTick();
    const pedido = http.expectOne((r) => r.url === `${API}/importacoes/clientes`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.params.get('simular')).toBe('true');
    expect(pedido.request.body instanceof FormData).toBe(true);
    expect((pedido.request.body as FormData).get('arquivo')).toBeInstanceOf(File);
    pedido.flush(relatorio());
    await depois(t.fixture);

    expect(t.el.textContent).toContain('Resultado da simulação (nada foi gravado)');
    expect(t.el.textContent).toContain('Seriam importadas');
    expect(t.el.textContent).toContain('Código de serviço repetido na planilha.');
    expect(t.el.textContent).toContain('Erro (não importada)');
    expect(t.el.textContent).toContain('Importar de verdade…');
  });

  it('importar de verdade só depois de confirmar, com o mesmo arquivo e simular=false, e atualiza o histórico', async () => {
    const t = await abrir();
    escolher(t, planilha());
    await simular(t);

    botao(t, 'Importar de verdade…').click();
    t.fixture.detectChanges();
    http.expectNone((r) => r.url.startsWith(`${API}/importacoes/`));
    expect(t.el.textContent).toContain('não poderá ser importada de novo');

    botao(t, 'Sim, importar').click();
    await proximoTick();
    const pedido = http.expectOne((r) => r.url === `${API}/importacoes/clientes`);
    expect(pedido.request.params.get('simular')).toBe('false');
    expect(((pedido.request.body as FormData).get('arquivo') as File).name).toBe('clientes.xlsx');
    pedido.flush(relatorio({ simulacao: false, importacaoId: 'imp-1' }));
    await proximoTick();
    t.fixture.detectChanges();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes`).flush({
      itens: [{ id: 'imp-1', tipo: 'Clientes', nomeArquivo: 'clientes.xlsx', usuarioId: 'u', executadaEm: '2026-11-01T12:00:00Z', totalLidos: 120, totalImportados: 100, totalRejeitados: 5, totalAvisos: 7, totalIgnoradas: 8 }],
      pagina: 1, tamanho: 10, total: 1,
    });
    await depois(t.fixture);

    expect(t.el.textContent).toContain('Importação concluída');
    expect(t.el.textContent).toContain('Planilha importada. 100 registro(s) gravado(s).');
    expect(t.el.textContent).not.toContain('Importar de verdade…');
    expect(t.el.querySelector('a[href="/importacao/imp-1"]')).not.toBeNull();
  });

  it('trocar a planilha depois de simular apaga o resultado e a permissão de importar', async () => {
    const t = await abrir();
    escolher(t, planilha());
    await simular(t);
    expect(t.el.textContent).toContain('Importar de verdade…');

    escolher(t, planilha('outra.xlsx'));

    expect(t.el.textContent).not.toContain('Resultado da simulação');
    expect(t.el.textContent).not.toContain('Importar de verdade…');
  });

  it('trocar o tipo (clientes → serviços) também invalida a simulação', async () => {
    const t = await abrir();
    escolher(t, planilha());
    await simular(t);

    const tipo = t.el.querySelector<HTMLSelectElement>('#tipo')!;
    tipo.value = 'servicos';
    tipo.dispatchEvent(new Event('input'));
    tipo.dispatchEvent(new Event('change'));
    await depois(t.fixture);

    expect(t.el.textContent).not.toContain('Resultado da simulação');
    expect(t.el.textContent).not.toContain('Importar de verdade…');
    expect(t.el.textContent).toContain('entra só o grupo SERVIÇOS');
  });

  it('simulação sem nada a importar não oferece importar', async () => {
    const t = await abrir();
    escolher(t, planilha());

    await simular(t, relatorio({ totalImportados: 0, totalRejeitados: 120 }));

    expect(t.el.textContent).toContain('Nada a importar neste arquivo.');
    expect(t.el.textContent).not.toContain('Importar de verdade…');
  });

  it('planilha já importada (409) mostra a mensagem da API e não oferece importar', async () => {
    const t = await abrir();
    escolher(t, planilha());

    botao(t, 'Simular importação').click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes/clientes`).flush(
      { codigo: 'importacao.arquivo_ja_importado', detail: 'Esta planilha já foi importada.', erros: [{ codigo: 'importacao.arquivo_ja_importado', mensagem: 'Esta planilha já foi importada.' }] },
      { status: 409, statusText: 'Conflict' },
    );
    await depois(t.fixture);

    expect(t.el.textContent).toContain('Esta planilha já foi importada.');
    expect(t.el.textContent).not.toContain('Importar de verdade…');
  });

  it('409 ao importar de verdade (outra pessoa importou antes): mostra a mensagem e NÃO volta a oferecer importar', async () => {
    const t = await abrir();
    escolher(t, planilha());
    await simular(t);
    botao(t, 'Importar de verdade…').click();
    t.fixture.detectChanges();

    botao(t, 'Sim, importar').click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes/clientes`).flush(
      { codigo: 'importacao.arquivo_ja_importado', detail: 'Esta planilha já foi importada.', erros: [{ codigo: 'importacao.arquivo_ja_importado', mensagem: 'Esta planilha já foi importada.' }] },
      { status: 409, statusText: 'Conflict' },
    );
    await depois(t.fixture);

    expect(t.el.textContent).toContain('Esta planilha já foi importada.');
    expect(t.el.textContent).not.toContain('Importar de verdade…');
    expect(t.el.textContent).not.toContain('Resultado da simulação');
  });

  it('ao abrir a confirmação, o foco vai para "Sim, importar"', async () => {
    const t = await abrir();
    document.body.appendChild(t.el);
    escolher(t, planilha());
    await simular(t);

    botao(t, 'Importar de verdade…').click();
    t.fixture.detectChanges();
    await depois(t.fixture);

    expect(document.activeElement?.textContent).toContain('Sim, importar');
    t.el.remove();
  });

  it('erro de estrutura (400) aparece na tela', async () => {
    const t = await abrir();
    escolher(t, planilha());

    botao(t, 'Simular importação').click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes/clientes`).flush({ detail: 'A planilha não parece ser de clientes.', erros: [{ codigo: 'validacao', mensagem: 'A planilha não parece ser de clientes.' }] }, { status: 400, statusText: 'Bad Request' });
    await depois(t.fixture);

    expect(t.el.textContent).toContain('A planilha não parece ser de clientes.');
  });

  it('falha ao importar de verdade mostra o erro, fecha a confirmação e não marca como concluída', async () => {
    const t = await abrir();
    escolher(t, planilha());
    await simular(t);
    botao(t, 'Importar de verdade…').click();
    t.fixture.detectChanges();

    botao(t, 'Sim, importar').click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes/clientes`).flush({}, { status: 500, statusText: 'Server Error' });
    await depois(t.fixture);

    expect(t.el.textContent).toContain('O servidor encontrou um problema');
    expect(t.el.textContent).not.toContain('Planilha importada');
  });

  it('clique repetido em Simular não envia a planilha duas vezes', async () => {
    const t = await abrir();
    escolher(t, planilha());
    const formulario = t.el.querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match((r) => r.url === `${API}/importacoes/clientes`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush(relatorio());
    await depois(t.fixture);
  });

  it('muitas ocorrências aparecem de 50 em 50', async () => {
    const t = await abrir();
    escolher(t, planilha());
    const ocorrencias: Ocorrencia[] = Array.from({ length: 120 }, (_, i) => ({ linha: i + 2, gravidade: 'Aviso', motivo: `Aviso ${i + 2}` }));

    await simular(t, relatorio({ ocorrencias }));
    expect(t.el.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(t.el.textContent).toContain('Ocorrências (120)');

    botao(t, 'Mostrar mais').click();
    t.fixture.detectChanges();
    expect(t.el.querySelectorAll('tbody tr')).toHaveLength(100);
    botao(t, 'Mostrar mais').click();
    t.fixture.detectChanges();
    expect(t.el.querySelectorAll('tbody tr')).toHaveLength(120);
    expect(t.el.textContent).not.toContain('Mostrar mais');
  });

  it('histórico vazio e erro de carga do histórico', async () => {
    const t = await abrir();
    expect(t.el.textContent).toContain('Nenhuma importação feita ainda.');
    TestBed.resetTestingModule();

    const u = montar();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes`).flush({}, { status: 500, statusText: 'Server Error' });
    await depois(u.fixture);
    expect(u.el.textContent).toContain('Não foi possível carregar o histórico.');
    u.el.querySelector<HTMLButtonElement>('#titulo-historico ~ .alerta-erro button')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/importacoes`).flush(historicoVazio);
    await depois(u.fixture);
  });
});
