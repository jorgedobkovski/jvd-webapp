import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { Sessao } from '../../core/sessao';
import { API, proximoTick } from '../../core/teste-apoio';
import { UsuarioDoSistema } from './usuarios-api';
import { UsuarioFormulario } from './usuario-formulario';

function usuarioApi(sobrescrever: Partial<UsuarioDoSistema> = {}): UsuarioDoSistema {
  return {
    id: 'u-2',
    nome: 'Técnico Sintético',
    email: 'tecnico@exemplo.com',
    perfil: 'Tecnico',
    cpf: null,
    ativo: true,
    deveTrocarSenha: false,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    ...sobrescrever,
  };
}

describe('UsuarioFormulario', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  function montar(id: string | null = null, meuId = 'u-1') {
    TestBed.configureTestingModule({
      imports: [UsuarioFormulario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: Sessao, useValue: { usuario: signal({ id: meuId, nome: 'Gestor', perfil: 'Gestor', deveTrocarSenha: false }).asReadonly() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(UsuarioFormulario);
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
    campo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function enviar(fixture: ReturnType<typeof montar>['fixture']) {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await depois(fixture);
  }

  const botao = (el: HTMLElement, texto: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texto))!;

  afterEach(() => http.verify());

  it('novo usuário sem nome nem e-mail: não chama a API', async () => {
    const { fixture, el } = montar();
    await enviar(fixture);

    http.expectNone(`${API}/usuarios`);
    expect(el.textContent).toContain('Informe o nome.');
    expect(el.textContent).toContain('Informe o e-mail.');
  });

  it('cria gerando a senha provisória, mostra UMA vez e esconde ao concluir', async () => {
    const { fixture, el } = montar();
    digitar(fixture, '#nome', 'Técnico Novo');
    digitar(fixture, '#email', 'novo@exemplo.com');
    digitar(fixture, '#perfil', 'Gestor');

    await enviar(fixture);
    const pedido = http.expectOne(`${API}/usuarios`);
    expect(pedido.request.method).toBe('POST');
    const corpo = pedido.request.body as { nome: string; email: string; perfil: string; senhaProvisoria: string };
    expect(corpo).toMatchObject({ nome: 'Técnico Novo', email: 'novo@exemplo.com', perfil: 'Gestor' });
    expect(corpo.senhaProvisoria).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{10,}$/);
    pedido.flush(usuarioApi({ nome: 'Técnico Novo', perfil: 'Gestor', deveTrocarSenha: true }), { status: 201, statusText: 'Created' });
    await depois(fixture);

    // A senha mostrada é a mesma que foi enviada.
    expect(el.querySelector('output')!.textContent).toBe(corpo.senhaProvisoria);
    expect(el.textContent).toContain('não aparece de novo');

    botao(el, 'Concluir').click();
    await depois(fixture);
    expect(el.textContent).not.toContain(corpo.senhaProvisoria);
    expect(navegar).toHaveBeenCalledWith(['/usuarios']);
  });

  it('se a criação falha (e-mail em uso), NÃO mostra senha nenhuma', async () => {
    const { fixture, el } = montar();
    digitar(fixture, '#nome', 'Técnico Novo');
    digitar(fixture, '#email', 'repetido@exemplo.com');

    await enviar(fixture);
    http.expectOne(`${API}/usuarios`).flush({ codigo: 'usuario.email_em_uso', detail: 'Já existe um usuário com este e-mail.' }, { status: 409, statusText: 'Conflict' });
    await depois(fixture);

    expect(el.querySelector('output')).toBeNull();
    expect(el.textContent).toContain('Já existe um usuário com este e-mail.');
  });

  it('copiar usa a área de transferência e avisa quando consegue ou não', async () => {
    const { fixture, el } = montar();
    digitar(fixture, '#nome', 'Técnico Novo');
    digitar(fixture, '#email', 'novo@exemplo.com');
    await enviar(fixture);
    const pedido = http.expectOne(`${API}/usuarios`);
    const senha = (pedido.request.body as { senhaProvisoria: string }).senhaProvisoria;
    pedido.flush(usuarioApi(), { status: 201, statusText: 'Created' });
    await depois(fixture);

    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    botao(el, 'Copiar senha').click();
    await depois(fixture);
    expect(escrever).toHaveBeenCalledWith(senha);
    expect(el.textContent).toContain('Senha copiada.');

    escrever.mockRejectedValue(new Error('negado'));
    botao(el, 'Copiar senha').click();
    await depois(fixture);
    expect(el.textContent).toContain('Não foi possível copiar');
  });

  it('edição: e-mail só leitura, salva nome/perfil/CPF sem mandar e-mail nem versão', async () => {
    const { fixture, el } = montar('u-2');
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi());
    await depois(fixture);
    expect(el.querySelector('#email')).toBeNull();
    expect(el.textContent).toContain('tecnico@exemplo.com');

    digitar(fixture, '#nome', 'Técnico Renomeado');
    await enviar(fixture);

    const pedido = http.expectOne(`${API}/usuarios/u-2`);
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual({ nome: 'Técnico Renomeado', perfil: 'Tecnico', cpf: '' });
    pedido.flush(usuarioApi({ nome: 'Técnico Renomeado' }));
    await depois(fixture);
    expect(el.textContent).toContain('Usuário salvo.');
  });

  it('mudar o perfil avisa que as sessões serão encerradas', async () => {
    const { fixture, el } = montar('u-2');
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi());
    await depois(fixture);
    expect(el.textContent).not.toContain('encerra as sessões');

    digitar(fixture, '#perfil', 'Gestor');

    expect(el.textContent).toContain('Mudar o perfil encerra as sessões');
  });

  it('desativa só depois de confirmar', async () => {
    const { fixture, el } = montar('u-2');
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi());
    await depois(fixture);

    botao(el, 'Desativar').click();
    fixture.detectChanges();
    http.expectNone(`${API}/usuarios/u-2/desativar`);
    botao(el, 'Sim, desativar').click();
    http.expectOne(`${API}/usuarios/u-2/desativar`).flush(null, { status: 204, statusText: 'No Content' });
    await proximoTick();
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi({ ativo: false }));
    await depois(fixture);

    expect(el.textContent).toContain('Inativo');
    expect(el.textContent).toContain('Reativar');
  });

  it('redefinir senha gera uma nova, envia e mostra uma vez', async () => {
    const { fixture, el } = montar('u-2');
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi());
    await depois(fixture);

    botao(el, 'Redefinir senha').click();
    fixture.detectChanges();
    botao(el, 'Sim, gerar nova senha').click();
    const pedido = http.expectOne(`${API}/usuarios/u-2/redefinir-senha`);
    const senha = (pedido.request.body as { novaSenhaProvisoria: string }).novaSenhaProvisoria;
    expect(senha).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{10,}$/);
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    await proximoTick();
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi({ deveTrocarSenha: true }));
    await depois(fixture);

    expect(el.querySelector('output')!.textContent).toBe(senha);
    botao(el, 'Concluir').click();
    await depois(fixture);
    expect(el.querySelector('output')).toBeNull();
    expect(el.textContent).toContain('Senha provisória pendente');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('o gestor não desativa nem redefine a PRÓPRIA senha por aqui', async () => {
    const { fixture, el } = montar('u-1', 'u-1');
    http.expectOne(`${API}/usuarios/u-1`).flush(usuarioApi({ id: 'u-1', perfil: 'Gestor' }));
    await depois(fixture);

    expect(el.textContent).toContain('Você');
    expect(el.textContent).not.toContain('Desativar');
    expect(el.textContent).not.toContain('Redefinir senha');
    expect(el.textContent).toContain('Trocar senha');
  });

  it('o id da rota em MAIÚSCULAS também é reconhecido como o próprio usuário', async () => {
    const { fixture, el } = montar('ABC-DEF', 'abc-def');
    http.expectOne(`${API}/usuarios/ABC-DEF`).flush(usuarioApi({ id: 'abc-def', perfil: 'Gestor' }));
    await depois(fixture);

    expect(el.textContent).not.toContain('Desativar');
    expect(el.textContent).not.toContain('Redefinir senha');
  });

  it('o gestor não rebaixa o próprio perfil: o seletor fica desabilitado em si mesmo e liberado nos outros', async () => {
    const eu = montar('u-1', 'u-1');
    http.expectOne(`${API}/usuarios/u-1`).flush(usuarioApi({ id: 'u-1', perfil: 'Gestor' }));
    await depois(eu.fixture);
    expect(eu.el.querySelector<HTMLSelectElement>('#perfil')!.disabled).toBe(true);
    TestBed.resetTestingModule();

    const outro = montar('u-2', 'u-1');
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi());
    await depois(outro.fixture);
    expect(outro.el.querySelector<HTMLSelectElement>('#perfil')!.disabled).toBe(false);
  });

  it('recusa da API (último gestor) aparece na tela', async () => {
    const { fixture, el } = montar('u-2');
    http.expectOne(`${API}/usuarios/u-2`).flush(usuarioApi({ perfil: 'Gestor' }));
    await depois(fixture);

    botao(el, 'Desativar').click();
    fixture.detectChanges();
    botao(el, 'Sim, desativar').click();
    http.expectOne(`${API}/usuarios/u-2/desativar`).flush({ codigo: 'usuario.ultimo_gestor', detail: 'Não é possível desativar o último gestor.' }, { status: 409, statusText: 'Conflict' });
    await depois(fixture);

    expect(el.textContent).toContain('Não é possível desativar o último gestor.');
  });

  it('usuário inexistente mostra o erro sem formulário vazio', async () => {
    const { fixture, el } = montar('nao-existe');
    http.expectOne(`${API}/usuarios/nao-existe`).flush({ detail: 'Usuário não encontrado.' }, { status: 404, statusText: 'Not Found' });
    await depois(fixture);

    expect(el.textContent).toContain('Usuário não encontrado.');
    expect(el.querySelector('form')).toBeNull();
  });

  it('Enter repetido durante o envio não cria dois usuários', async () => {
    const { fixture } = montar();
    digitar(fixture, '#nome', 'Técnico Novo');
    digitar(fixture, '#email', 'novo@exemplo.com');
    const formulario = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!;

    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedidos = http.match(`${API}/usuarios`);
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush(usuarioApi(), { status: 201, statusText: 'Created' });
    await depois(fixture);
  });
});
