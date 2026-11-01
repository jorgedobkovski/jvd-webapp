import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../core/api-url';
import { API, proximoTick } from '../../core/teste-apoio';
import { UsuarioDoSistema, paramsDeUsuarios } from './usuarios-api';
import { UsuariosLista } from './usuarios-lista';

const usuario = (s: Partial<UsuarioDoSistema> = {}): UsuarioDoSistema => ({
  id: 'u-2', nome: 'Técnico Sintético', email: 'tecnico@exemplo.com', perfil: 'Tecnico', cpf: null, ativo: true, deveTrocarSenha: false,
  criadoEm: '2026-11-01T10:00:00Z', atualizadoEm: '2026-11-01T10:00:00Z', ...s,
});

describe('UsuariosLista', () => {
  let http: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({ imports: [UsuariosLista], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UsuariosLista);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function responder(fixture: ReturnType<typeof montar>['fixture'], itens: UsuarioDoSistema[]) {
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/usuarios`).flush({ itens, pagina: 1, tamanho: 20, total: itens.length });
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  it('parâmetros: só o preenchido', () => {
    expect(paramsDeUsuarios({})).toEqual({ pagina: 1, tamanho: 20 });
    expect(paramsDeUsuarios({ busca: ' ana ', perfil: 'Gestor', ativo: false })).toEqual({ busca: 'ana', perfil: 'Gestor', ativo: false, pagina: 1, tamanho: 20 });
  });

  it('lista com perfil e etiquetas de inativo e de senha provisória, sem mostrar CPF', async () => {
    const { fixture, el } = montar();
    await responder(fixture, [usuario({ cpf: '12345678909', deveTrocarSenha: true }), usuario({ id: 'u-3', nome: 'Gestora Sintética', perfil: 'Gestor', ativo: false })]);

    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.querySelectorAll('ul.md\\:hidden li')).toHaveLength(2);
    expect(el.textContent).toContain('Senha provisória');
    expect(el.textContent).toContain('Inativo');
    expect(el.textContent).toContain('Gestor');
    expect(el.textContent).not.toContain('123.456.789-09');
    expect(el.textContent).not.toContain('12345678909');
  });

  it('filtra por perfil e situação, voltando para a página 1', async () => {
    const { fixture, el } = montar();
    await responder(fixture, [usuario()]);

    const busca = el.querySelector<HTMLInputElement>('#busca')!;
    busca.value = 'ana';
    busca.dispatchEvent(new Event('input'));
    for (const [id, valor] of [['#perfil', 'Gestor'], ['#situacao', 'inativos']] as const) {
      const campo = el.querySelector<HTMLSelectElement>(id)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      campo.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();

    const pedido = http.expectOne((r) => r.url === `${API}/usuarios`);
    expect(pedido.request.params.get('busca')).toBe('ana');
    expect(pedido.request.params.get('perfil')).toBe('Gestor');
    expect(pedido.request.params.get('ativo')).toBe('false');
    expect(pedido.request.params.get('pagina')).toBe('1');
    pedido.flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum usuário encontrado.');
  });

  it('falha ao carregar mostra o erro e permite tentar de novo', async () => {
    const { fixture, el } = montar();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/usuarios`).flush({}, { status: 500, statusText: 'Server Error' });
    await proximoTick();
    fixture.detectChanges();
    expect(el.textContent).toContain('Não foi possível carregar os usuários.');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    await proximoTick();
    http.expectOne((r) => r.url === `${API}/usuarios`).flush({ itens: [], pagina: 1, tamanho: 20, total: 0 });
    await proximoTick();
  });
});
