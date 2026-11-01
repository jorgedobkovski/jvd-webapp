import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { CatalogoApi, Servico } from '../cadastros/catalogo/catalogo-api';
import { clienteSintetico, equipamentoSintetico, sessaoFalsa } from '../cadastros/teste-cadastros';
import { API_URL } from '../core/api-url';
import { Sessao } from '../core/sessao';
import { API, proximoTick } from '../core/teste-apoio';
import { RelatorioFormulario } from './relatorio-formulario';
import { detalheSintetico, resumoSintetico } from './teste-relatorios';

const servicoDoCatalogo = (s: Partial<Servico> = {}): Servico => ({
  id: 's-1', codigoOrigem: null, descricao: 'Troca de célula de carga', precoSugerido: 150.5, ativo: true,
  criadoEm: '2026-11-01T10:00:00Z', atualizadoEm: '2026-11-01T10:00:00Z', versao: 'v1', ...s,
});

describe('RelatorioFormulario', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  function montar(opcoes: { id?: string; gestor?: boolean } = {}) {
    TestBed.configureTestingModule({
      imports: [RelatorioFormulario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: Sessao, useValue: sessaoFalsa(opcoes.gestor ?? false) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(opcoes.id ? { id: opcoes.id } : {}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RelatorioFormulario);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const depois = async (fixture: ReturnType<typeof montar>['fixture']) => {
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
    await proximoTick();
  };

  type Tela = ReturnType<typeof montar>;

  /** Responde as listas de apoio que a tela pede ao abrir (catálogo e, para o gestor, usuários). */
  async function apoios(t: Tela, opcoes: { catalogo?: Servico[]; gestor?: boolean } = {}) {
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/catalogo-servicos`).flush({ itens: opcoes.catalogo ?? [], pagina: 1, tamanho: 100, total: 0 });
    if (opcoes.gestor) {
      await proximoTick();
      http.expectOne((r) => r.url === `${API}/usuarios`).flush({ itens: [{ id: 'u-9', nome: 'Outro Técnico', email: 'o@exemplo.com', perfil: 'Tecnico', cpf: null, ativo: true, deveTrocarSenha: false, criadoEm: '', atualizadoEm: '' }], pagina: 1, tamanho: 100, total: 1 });
    }
    await depois(t.fixture);
  }

  function preencher(t: Tela, seletor: string, valor: string) {
    const campo = t.el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(seletor)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('change'));
    t.fixture.detectChanges();
  }

  /** Busca e escolhe um cliente pelo seletor, e responde a lista de balanças dele. */
  async function escolherCliente(t: Tela, equipamentos = [equipamentoSintetico()]) {
    preencher(t, 'input[aria-label="Buscar cliente"]', 'mercado');
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.trim() === 'Buscar')!.click();
    await proximoTick();
    const busca = http.expectOne((r) => r.url === `${API}/clientes`);
    expect(busca.request.params.get('ativo')).toBe('true');
    busca.flush({ itens: [clienteSintetico()], pagina: 1, tamanho: 8, total: 1 });
    await depois(t.fixture);
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset ul button')).find((b) => b.textContent?.includes('Mercado Teste Ltda'))!.click();
    await proximoTick();
    const lista = http.expectOne((r) => r.url === `${API}/equipamentos`);
    expect(lista.request.params.get('clienteId')).toBe('cli-1');
    expect(lista.request.params.get('ativo')).toBe('true');
    lista.flush({ itens: equipamentos, pagina: 1, tamanho: 100, total: equipamentos.length });
    await depois(t.fixture);
  }

  /** Escolhe a balança e responde a busca do último relatório emitido dela (nenhum, por padrão). */
  async function escolherEquipamento(t: Tela, ultimo: ReturnType<typeof detalheSintetico> | null = null) {
    preencher(t, '#equipamento', 'eq-1');
    await depois(t.fixture);
    const busca = http.expectOne((r) => r.url === `${API}/relatorios`);
    expect(busca.request.params.get('equipamentoId')).toBe('eq-1');
    expect(busca.request.params.get('status')).toBe('Emitido');
    expect(busca.request.params.get('tamanho')).toBe('1');
    busca.flush({ itens: ultimo ? [resumoSintetico({ id: 'r-9' })] : [], pagina: 1, tamanho: 1, total: ultimo ? 1 : 0 });
    if (ultimo) {
      await proximoTick();
      http.expectOne(`${API}/relatorios/r-9`).flush(ultimo);
    }
    await depois(t.fixture);
  }

  /** Escolhe a balança `id` e responde a busca do último relatório emitido dela (ou nenhum). */
  async function escolherBalanca(t: Tela, id: string, ultimo: ReturnType<typeof detalheSintetico> | null) {
    preencher(t, '#equipamento', id);
    await depois(t.fixture);
    const busca = http.expectOne((r) => r.url === `${API}/relatorios` && r.params.get('equipamentoId') === id);
    busca.flush({ itens: ultimo ? [resumoSintetico({ id: 'r-' + id })] : [], pagina: 1, tamanho: 1, total: ultimo ? 1 : 0 });
    if (ultimo) {
      await proximoTick();
      http.expectOne(`${API}/relatorios/r-${id}`).flush(ultimo);
    }
    await depois(t.fixture);
  }

  const duasBalancas = [equipamentoSintetico(), equipamentoSintetico({ id: 'eq-2', descricao: 'Balança B' })];

  const enviar = async (t: Tela) => {
    t.el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await depois(t.fixture);
  };

  afterEach(() => http.verify());

  it('sem cliente, balança nem tipo: não chama a API e mostra as mensagens', async () => {
    const t = montar();
    await apoios(t);

    await enviar(t);

    http.expectNone(`${API}/relatorios`);
    expect(t.el.textContent).toContain('Escolha o cliente.');
    expect(t.el.textContent).toContain('Escolha o equipamento.');
    expect(t.el.textContent).toContain('Escolha o tipo de serviço.');
  });

  it('só oferece as balanças do cliente escolhido, e trocar de cliente zera a balança', async () => {
    const t = montar();
    await apoios(t);
    expect(t.el.querySelector<HTMLSelectElement>('#equipamento')!.textContent).toContain('Escolha o cliente primeiro');

    await escolherCliente(t);
    expect(t.el.querySelector<HTMLSelectElement>('#equipamento')!.textContent).toContain('Balança Teste — série SERIE-1');
    await escolherEquipamento(t);
    expect(t.el.querySelector<HTMLSelectElement>('#equipamento')!.value).toBe('eq-1');

    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.includes('Trocar cliente'))!.click();
    t.fixture.detectChanges();
    preencher(t, 'input[aria-label="Buscar cliente"]', 'outro');
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.trim() === 'Buscar')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens: [clienteSintetico({ id: 'cli-2', nomeRazaoSocial: 'Outro Cliente' })], pagina: 1, tamanho: 8, total: 1 });
    await depois(t.fixture);
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset ul button')).find((b) => b.textContent?.includes('Outro Cliente'))!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/equipamentos` && r.params.get('clienteId') === 'cli-2').flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
    await depois(t.fixture);

    expect(t.el.querySelector<HTMLSelectElement>('#equipamento')!.value).toBe('');
    expect(t.el.textContent).toContain('Este cliente não tem equipamento ativo');
    expect(t.el.textContent).toContain('Cadastrar equipamento para este cliente');
  });

  it('sugere a verificação anterior do último relatório da balança e preenche os campos vazios (editáveis)', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);

    await escolherEquipamento(t, detalheSintetico({ numeroFormatado: '000010', verificacaoAnteriorData: '2025-05-20', verificacaoAnteriorCertificado: 'CERT-777' }));

    expect(t.el.querySelector<HTMLInputElement>('#verificacao-data')!.value).toBe('2025-05-20');
    expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-777');
    expect(t.el.textContent).toContain('Sugerido pelo último relatório emitido desta balança (nº 000010)');
    expect(t.el.textContent).toContain('20/05/2025');

    // editável: a pessoa corrige
    preencher(t, '#verificacao-certificado', 'CERT-888');
    expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-888');
  });

  it('digitar em outros campos NÃO refaz a busca da sugestão nem apaga o aviso (regressão: effect lia o formulário inteiro)', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    await escolherEquipamento(t, detalheSintetico({ verificacaoAnteriorData: '2025-05-20', verificacaoAnteriorCertificado: 'CERT-777' }));

    preencher(t, '#servico', 'Limpeza');
    preencher(t, '#observacoes', 'Cliente presente');
    preencher(t, '#total', '10');
    await depois(t.fixture);

    http.expectNone((r) => r.url === `${API}/relatorios`);
    expect(t.el.textContent).toContain('Sugerido pelo último relatório emitido desta balança');
  });

  it('não sobrescreve verificação já digitada, mas oferece a sugestão', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    preencher(t, '#verificacao-certificado', 'MEU-CERT');

    await escolherEquipamento(t, detalheSintetico({ verificacaoAnteriorData: '2025-05-20', verificacaoAnteriorCertificado: 'CERT-777' }));

    expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('MEU-CERT');
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Usar a sugestão'))!.click();
    t.fixture.detectChanges();
    expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-777');
  });

  it('balança sem relatório anterior: sem sugestão', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);

    await escolherEquipamento(t, null);

    expect(t.el.textContent).not.toContain('Sugerido pelo último relatório');
    expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('');
  });

  it('serviço do catálogo preenche o texto e o total vazios, sem apagar o que já foi digitado', async () => {
    const t = montar();
    await apoios(t, { catalogo: [servicoDoCatalogo(), servicoDoCatalogo({ id: 's-2', descricao: 'Aferição', precoSugerido: 80 })] });

    preencher(t, '#catalogo', 's-1');
    await depois(t.fixture);
    expect(t.el.querySelector<HTMLTextAreaElement>('#servico')!.value).toBe('Troca de célula de carga');
    expect(t.el.querySelector<HTMLInputElement>('#total')!.value).toBe('150,5');

    preencher(t, '#catalogo', 's-2');
    await depois(t.fixture);
    expect(t.el.querySelector<HTMLTextAreaElement>('#servico')!.value).toBe('Troca de célula de carga');
    expect(t.el.querySelector<HTMLInputElement>('#total')!.value).toBe('150,5');
  });

  it('total geral é calculado na tela e o desconto maior que o total é recusado', async () => {
    const t = montar();
    await apoios(t);

    preencher(t, '#total', '150,50');
    preencher(t, '#desconto', '10');
    await depois(t.fixture);
    expect(t.el.textContent?.replace(/\s/g, ' ')).toContain('Total geral: R$ 140,50');

    preencher(t, '#desconto', '200');
    await depois(t.fixture);
    expect(t.el.textContent).toContain('O desconto não pode ser maior que o total.');
  });

  it('valores e garantia inválidos são recusados antes de chamar a API', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    await escolherEquipamento(t);
    preencher(t, '#tipo', 'Corretiva');
    preencher(t, '#total', '10,999');
    preencher(t, '#garantia', '10000');

    await enviar(t);

    http.expectNone(`${API}/relatorios`);
    expect(t.el.textContent).toContain('Use um valor como 150 ou 150,50.');
    expect(t.el.textContent).toContain('Informe os dias de garantia (0 a 9.999).');
  });

  it('salva o rascunho com os valores convertidos e leva ao detalhe (técnico não manda executor)', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    await escolherEquipamento(t);
    preencher(t, '#tipo', 'Preventiva');
    preencher(t, '#data', '2026-10-30');
    preencher(t, '#servico', 'Limpeza e ajuste');
    preencher(t, '#observacoes', 'Cliente presente');
    preencher(t, '#selo', 'SELO-1');
    preencher(t, '#garantia', '30');
    preencher(t, '#total', '1.234,50');
    preencher(t, '#desconto', '34,5');

    await enviar(t);

    const pedido = http.expectOne(`${API}/relatorios`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      clienteId: 'cli-1',
      equipamentoId: 'eq-1',
      tecnicoId: null,
      tipoServico: 'Preventiva',
      dataServico: '2026-10-30',
      servicoExecutado: 'Limpeza e ajuste',
      observacoes: 'Cliente presente',
      verificacaoAnteriorData: null,
      verificacaoAnteriorCertificado: '',
      numeroSeloReparador: 'SELO-1',
      garantiaDias: 30,
      total: 1234.5,
      desconto: 34.5,
      catalogoServicoId: null,
    });
    pedido.flush(detalheSintetico({ id: 'novo', status: 'Rascunho' }));
    await depois(t.fixture);
    expect(navegar).toHaveBeenCalledWith(['/relatorios', 'novo']);
  });

  it('rascunho mínimo (sem serviço, sem valores) é aceito: garantia 0 e totais 0', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    await escolherEquipamento(t);
    preencher(t, '#tipo', 'Inspecao');

    await enviar(t);

    const pedido = http.expectOne(`${API}/relatorios`);
    expect(pedido.request.body).toMatchObject({ garantiaDias: 0, total: 0, desconto: 0, servicoExecutado: '', tipoServico: 'Inspecao' });
    pedido.flush(detalheSintetico({ id: 'novo', status: 'Rascunho' }));
    await depois(t.fixture);
  });

  it('gestor escolhe o executor e o envia; "Eu mesmo" não manda nada', async () => {
    const t = montar({ gestor: true });
    await apoios(t, { gestor: true });
    expect(t.el.querySelector('#executor')).not.toBeNull();
    await escolherCliente(t);
    await escolherEquipamento(t);
    preencher(t, '#tipo', 'Corretiva');
    preencher(t, '#executor', 'u-9');

    await enviar(t);

    const pedido = http.expectOne(`${API}/relatorios`);
    expect(pedido.request.body.tecnicoId).toBe('u-9');
    pedido.flush(detalheSintetico({ id: 'novo', status: 'Rascunho' }));
    await depois(t.fixture);
  });

  it('técnico não vê a escolha de executor', async () => {
    const t = montar({ gestor: false });
    await apoios(t);

    expect(t.el.querySelector('#executor')).toBeNull();
  });

  it('erro da API (ex.: cliente inativo) aparece na tela e nada navega', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    await escolherEquipamento(t);
    preencher(t, '#tipo', 'Corretiva');

    await enviar(t);
    http.expectOne(`${API}/relatorios`).flush({ detail: 'O equipamento não pertence ao cliente.', erros: [{ codigo: 'validacao', mensagem: 'O equipamento não pertence ao cliente.' }] }, { status: 400, statusText: 'Bad Request' });
    await depois(t.fixture);

    expect(t.el.textContent).toContain('O equipamento não pertence ao cliente.');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('Enter repetido durante o envio não cria dois rascunhos', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    await escolherEquipamento(t);
    preencher(t, '#tipo', 'Corretiva');
    const formulario = t.el.querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match(`${API}/relatorios`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush(detalheSintetico({ id: 'novo', status: 'Rascunho' }));
    await depois(t.fixture);
  });

  describe('edição de rascunho', () => {
    async function abrirEdicao(detalhe = detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null, versao: 'v5', catalogoServicoId: null })) {
      const t = montar({ id: 'r-1' });
      await apoios(t);
      http.expectOne(`${API}/relatorios/r-1`).flush(detalhe);
      await proximoTick();
      if (detalhe.status === 'Rascunho') {
        http.expectOne((r) => r.url === `${API}/equipamentos` && r.params.get('clienteId') === 'cli-1').flush({ itens: [equipamentoSintetico()], pagina: 1, tamanho: 100, total: 1 });
      }
      await depois(t.fixture);
      return t;
    }

    it('carrega os dados do rascunho, sem pedir sugestão de verificação, e salva com a versão que a pessoa viu', async () => {
      const t = await abrirEdicao();

      expect(t.el.querySelector<HTMLSelectElement>('#equipamento')!.value).toBe('eq-1');
      expect(t.el.querySelector<HTMLSelectElement>('#tipo')!.value).toBe('Corretiva');
      expect(t.el.querySelector<HTMLInputElement>('#data')!.value).toBe('2026-10-30');
      expect(t.el.querySelector<HTMLTextAreaElement>('#servico')!.value).toBe('Troca da célula de carga');
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-123');
      expect(t.el.querySelector<HTMLInputElement>('#total')!.value).toBe('150');
      expect(t.el.querySelector<HTMLInputElement>('#desconto')!.value).toBe('10');
      expect(t.el.textContent).toContain('Mercado Teste Ltda');
      http.expectNone((r) => r.url === `${API}/relatorios` && r.params.has('equipamentoId'));

      preencher(t, '#servico', 'Serviço corrigido');
      await enviar(t);

      const pedido = http.expectOne(`${API}/relatorios/r-1`);
      expect(pedido.request.method).toBe('PUT');
      expect(pedido.request.body).toMatchObject({ clienteId: 'cli-1', equipamentoId: 'eq-1', servicoExecutado: 'Serviço corrigido', total: 150, desconto: 10, versao: 'v5' });
      pedido.flush(detalheSintetico({ status: 'Rascunho', versao: 'v6' }));
      await depois(t.fixture);
      expect(navegar).toHaveBeenCalledWith(['/relatorios', 'r-1']);
    });

    it('relatório já emitido não abre como rascunho', async () => {
      const t = await abrirEdicao(detalheSintetico({ status: 'Emitido' }));

      expect(t.el.textContent).toContain('já foi emitido e não pode ser editado como rascunho');
      expect(t.el.querySelector('form')).toBeNull();
    });

    it('conflito de versão avisa e permite recarregar', async () => {
      const t = await abrirEdicao();

      await enviar(t);
      http.expectOne(`${API}/relatorios/r-1`).flush({ codigo: 'conflito', detail: 'x' }, { status: 409, statusText: 'Conflict' });
      await depois(t.fixture);
      expect(t.el.textContent).toContain('Outra pessoa alterou este rascunho');
      expect(navegar).not.toHaveBeenCalled();

      t.el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
      await proximoTick();
      http.expectOne(`${API}/relatorios/r-1`).flush(detalheSintetico({ status: 'Rascunho', versao: 'v9', servicoExecutado: 'Texto atual' }));
      await proximoTick();
      http.expectOne((r) => r.url === `${API}/equipamentos`).flush({ itens: [equipamentoSintetico()], pagina: 1, tamanho: 100, total: 1 });
      await depois(t.fixture);
      expect(t.el.querySelector<HTMLTextAreaElement>('#servico')!.value).toBe('Texto atual');
      expect(t.el.textContent).not.toContain('Outra pessoa alterou este rascunho');
    });

    it('rascunho inexistente (ou de outro técnico) mostra o erro sem formulário', async () => {
      const t = montar({ id: 'nao-existe' });
      await apoios(t);
      http.expectOne(`${API}/relatorios/nao-existe`).flush({ detail: 'Relatório não encontrado.' }, { status: 404, statusText: 'Not Found' });
      await depois(t.fixture);

      expect(t.el.textContent).toContain('Relatório não encontrado.');
      expect(t.el.querySelector('form')).toBeNull();
    });
  });


  describe('trocar de balança (a verificação anterior é da balança, não do relatório)', () => {
    const doEq1 = () => detalheSintetico({ verificacaoAnteriorData: '2025-05-20', verificacaoAnteriorCertificado: 'CERT-A' });

    it('o que a sugestão preencheu para a balança A é DESFEITO ao trocar para a B sem relatório anterior', async () => {
      const t = montar();
      await apoios(t);
      await escolherCliente(t, duasBalancas);
      await escolherBalanca(t, 'eq-1', doEq1());
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-A');

      await escolherBalanca(t, 'eq-2', null);

      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('');
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-data')!.value).toBe('');
      expect(t.el.textContent).not.toContain('Sugerido pelo último relatório');
    });

    it('ao trocar para uma balança COM relatório, os campos passam a ser os da nova balança', async () => {
      const t = montar();
      await apoios(t);
      await escolherCliente(t, duasBalancas);
      await escolherBalanca(t, 'eq-1', doEq1());

      await escolherBalanca(t, 'eq-2', detalheSintetico({ verificacaoAnteriorData: '2024-03-02', verificacaoAnteriorCertificado: 'CERT-B' }));

      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-B');
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-data')!.value).toBe('2024-03-02');
    });

    it('o que a PESSOA digitou fica, mas com aviso para conferir', async () => {
      const t = montar();
      await apoios(t);
      await escolherCliente(t, duasBalancas);
      await escolherBalanca(t, 'eq-1', doEq1());
      preencher(t, '#verificacao-certificado', 'DIGITADO-POR-MIM');

      await escolherBalanca(t, 'eq-2', null);

      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('DIGITADO-POR-MIM');
      expect(t.el.textContent).toContain('confira a verificação anterior abaixo');
    });

    it('o que o digitado à mão em uma balança sem histórico também gera o aviso ao trocar de balança', async () => {
      const t = montar();
      await apoios(t);
      await escolherCliente(t, duasBalancas);
      await escolherBalanca(t, 'eq-1', null);
      preencher(t, '#verificacao-certificado', 'CERT-MANUAL-A');

      await escolherBalanca(t, 'eq-2', null);

      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-MANUAL-A');
      expect(t.el.textContent).toContain('confira a verificação anterior abaixo');
    });

    it('trocar de CLIENTE também zera a balança e desfaz a verificação sugerida', async () => {
      const t = montar();
      await apoios(t);
      await escolherCliente(t, duasBalancas);
      await escolherBalanca(t, 'eq-1', doEq1());

      Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.includes('Trocar cliente'))!.click();
      t.fixture.detectChanges();
      preencher(t, 'input[aria-label="Buscar cliente"]', 'outro');
      Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.trim() === 'Buscar')!.click();
      await proximoTick();
      http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens: [clienteSintetico({ id: 'cli-2', nomeRazaoSocial: 'Outro Cliente' })], pagina: 1, tamanho: 8, total: 1 });
      await depois(t.fixture);
      Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset ul button')).find((b) => b.textContent?.includes('Outro Cliente'))!.click();
      await proximoTick();
      http.expectOne((r) => r.url === `${API}/equipamentos` && r.params.get('clienteId') === 'cli-2').flush({ itens: [], pagina: 1, tamanho: 100, total: 0 });
      await depois(t.fixture);

      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('');
      expect(t.el.querySelector<HTMLSelectElement>('#equipamento')!.value).toBe('');
    });
  });

  describe('edição de rascunho: voltar para a balança original', () => {
    async function abrirEdicaoComDuasBalancas(verificacao: { data: string | null; certificado: string | null }) {
      const t = montar({ id: 'r-1' });
      await apoios(t);
      http.expectOne(`${API}/relatorios/r-1`).flush(
        detalheSintetico({ status: 'Rascunho', numero: null, numeroFormatado: null, verificacaoAnteriorData: verificacao.data, verificacaoAnteriorCertificado: verificacao.certificado }),
      );
      await proximoTick();
      http.expectOne((r) => r.url === `${API}/equipamentos`).flush({ itens: duasBalancas, pagina: 1, tamanho: 100, total: 2 });
      await depois(t.fixture);
      return t;
    }

    it('rascunho sem verificação: ir para a balança B (preenche) e voltar para a A DESFAZ o que veio da B', async () => {
      const t = await abrirEdicaoComDuasBalancas({ data: null, certificado: null });
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('');

      await escolherBalanca(t, 'eq-2', detalheSintetico({ verificacaoAnteriorData: '2024-03-02', verificacaoAnteriorCertificado: 'CERT-BALANCA-B' }));
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-BALANCA-B');

      preencher(t, '#equipamento', 'eq-1'); // volta para a original: não busca sugestão
      await depois(t.fixture);

      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('');
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-data')!.value).toBe('');
      http.expectNone((r) => r.url === `${API}/relatorios`);
    });

    it('rascunho COM verificação própria: trocar de balança avisa; voltar para a original não avisa à toa e mantém os dados', async () => {
      const t = await abrirEdicaoComDuasBalancas({ data: '2025-10-01', certificado: 'CERT-123' });

      await escolherBalanca(t, 'eq-2', null);
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-123');
      expect(t.el.textContent).toContain('confira a verificação anterior abaixo');

      preencher(t, '#equipamento', 'eq-1');
      await depois(t.fixture);
      expect(t.el.querySelector<HTMLInputElement>('#verificacao-certificado')!.value).toBe('CERT-123');
      expect(t.el.textContent).not.toContain('confira a verificação anterior abaixo');
    });
  });

  it('resposta ATRASADA das balanças do cliente anterior não sobrescreve a lista do cliente atual', async () => {
    const t = montar();
    await apoios(t);

    // escolhe o cliente A (a resposta das balanças dele fica pendente)
    preencher(t, 'input[aria-label="Buscar cliente"]', 'a');
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.trim() === 'Buscar')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens: [clienteSintetico({ id: 'cli-a', nomeRazaoSocial: 'Cliente A' })], pagina: 1, tamanho: 8, total: 1 });
    await depois(t.fixture);
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset ul button')).find((b) => b.textContent?.includes('Cliente A'))!.click();
    await proximoTick();
    const pendenteA = http.expectOne((r) => r.url === `${API}/equipamentos` && r.params.get('clienteId') === 'cli-a');

    // troca para o cliente B, que responde primeiro
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.includes('Trocar cliente'))!.click();
    t.fixture.detectChanges();
    preencher(t, 'input[aria-label="Buscar cliente"]', 'b');
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset button')).find((b) => b.textContent?.trim() === 'Buscar')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/clientes`).flush({ itens: [clienteSintetico({ id: 'cli-b', nomeRazaoSocial: 'Cliente B' })], pagina: 1, tamanho: 8, total: 1 });
    await depois(t.fixture);
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('fieldset ul button')).find((b) => b.textContent?.includes('Cliente B'))!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/equipamentos` && r.params.get('clienteId') === 'cli-b').flush({ itens: [equipamentoSintetico({ id: 'eq-b', descricao: 'Balança do B', clienteId: 'cli-b' })], pagina: 1, tamanho: 100, total: 1 });
    await depois(t.fixture);

    // a resposta velha do A chega por último
    pendenteA.flush({ itens: [equipamentoSintetico({ id: 'eq-a', descricao: 'Balança do A', clienteId: 'cli-a' })], pagina: 1, tamanho: 100, total: 1 });
    await depois(t.fixture);

    const opcoes = t.el.querySelector<HTMLSelectElement>('#equipamento')!.textContent!;
    expect(opcoes).toContain('Balança do B');
    expect(opcoes).not.toContain('Balança do A');
  });

  it('desconto sem total é recusado, e o total geral nunca aparece negativo', async () => {
    const t = montar();
    await apoios(t);

    preencher(t, '#desconto', '50');
    await depois(t.fixture);

    expect(t.el.textContent).toContain('O desconto não pode ser maior que o total.');
    expect(t.el.textContent).toContain('Total geral: —');
    expect(t.el.textContent).not.toContain('-R$');
  });

  it('certificado e selo acima de 60 caracteres mostram a mensagem (o envio não fica mudo)', async () => {
    const t = montar();
    await apoios(t);
    await escolherCliente(t);
    await escolherEquipamento(t);
    preencher(t, '#tipo', 'Corretiva');
    preencher(t, '#verificacao-certificado', 'x'.repeat(61));
    preencher(t, '#selo', 'y'.repeat(61));
    preencher(t, '#servico', 'z'.repeat(4001));
    preencher(t, '#observacoes', 'w'.repeat(2001));

    await enviar(t);

    http.expectNone(`${API}/relatorios`);
    expect(t.el.querySelector('#certificado-erro')!.textContent).toContain('Use no máximo 60 caracteres.');
    expect(t.el.querySelector('#selo-erro')!.textContent).toContain('Use no máximo 60 caracteres.');
    expect(t.el.querySelector('#servico-erro')!.textContent).toContain('Use no máximo 4.000 caracteres.');
    expect(t.el.querySelector('#observacoes-erro')!.textContent).toContain('Use no máximo 2.000 caracteres.');
    expect(t.el.querySelector('#servico')!.getAttribute('aria-invalid')).toBe('true');
    expect(t.el.querySelector('#selo')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('o catálogo vem só de itens ativos (o técnico nem recebe os inativos)', async () => {
    const api = TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }] }).inject(CatalogoApi);
    http = TestBed.inject(HttpTestingController);
    const promessa = api.listarAtivos();
    const pedido = http.expectOne((r) => r.url === `${API}/catalogo-servicos`);
    expect(pedido.request.params.get('ativo')).toBe('true');
    expect(pedido.request.params.get('tamanho')).toBe('100');
    pedido.flush({ itens: [servicoDoCatalogo()], pagina: 1, tamanho: 100, total: 1 });
    expect(await promessa).toHaveLength(1);
  });
});
