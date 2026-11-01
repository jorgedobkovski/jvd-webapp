import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { exigePerfil, exigeSessao, exigeUsuario, retornoSeguro, soVisitante } from './guardas';
import { Usuario } from './modelos';
import { Sessao } from './sessao';
import { usuario } from './teste-apoio';

describe('guardas', () => {
  const atual = signal<Usuario | null>(null);

  beforeEach(() => {
    atual.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Sessao, useValue: { usuario: atual.asReadonly(), autenticado: () => atual() !== null } },
      ],
    });
  });

  const rodar = (guarda: CanActivateFn, url = '/relatorios'): boolean | UrlTree =>
    TestBed.runInInjectionContext(() => guarda({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as boolean | UrlTree;
  const texto = (resultado: boolean | UrlTree) => (resultado instanceof UrlTree ? TestBed.inject(Router).serializeUrl(resultado) : resultado);

  it('exigeSessao: sem login vai para a entrada guardando o retorno', () => {
    expect(texto(rodar(exigeSessao))).toBe('/entrar?retorno=%2Frelatorios');
    expect(texto(rodar(exigeSessao, '/'))).toBe('/entrar');
  });

  it('exigeSessao: com login passa; com senha provisória vai para a troca', () => {
    atual.set(usuario());
    expect(rodar(exigeSessao)).toBe(true);

    atual.set(usuario({ deveTrocarSenha: true }));
    expect(texto(rodar(exigeSessao))).toBe('/trocar-senha');
  });

  it('exigeUsuario: aceita quem tem senha provisória, recusa visitante', () => {
    expect(texto(rodar(exigeUsuario))).toBe('/entrar');
    atual.set(usuario({ deveTrocarSenha: true }));
    expect(rodar(exigeUsuario)).toBe(true);
  });

  it('soVisitante: logado não vê a entrada', () => {
    expect(rodar(soVisitante)).toBe(true);
    atual.set(usuario());
    expect(texto(rodar(soVisitante))).toBe('/');
    atual.set(usuario({ deveTrocarSenha: true }));
    expect(texto(rodar(soVisitante))).toBe('/trocar-senha');
  });

  it('exigePerfil: só os perfis listados', () => {
    const soGestor = exigePerfil('Gestor');
    atual.set(usuario({ perfil: 'Tecnico' }));
    expect(texto(rodar(soGestor))).toBe('/');
    atual.set(usuario({ perfil: 'Gestor' }));
    expect(rodar(soGestor)).toBe(true);
    atual.set(null);
    expect(texto(rodar(soGestor))).toBe('/');
  });

  it('retornoSeguro aceita só caminho interno', () => {
    expect(retornoSeguro('/relatorios?x=1')).toBe('/relatorios?x=1');
    for (const ruim of ['//evil.com', 'https://evil.com', 'evil', '/\\evil.com', '', null, undefined]) expect(retornoSeguro(ruim)).toBe('/');
  });
});
