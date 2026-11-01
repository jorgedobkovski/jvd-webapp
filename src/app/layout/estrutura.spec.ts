import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Sessao } from '../core/sessao';
import { Estrutura } from './estrutura';

describe('Estrutura (menu)', () => {
  function montar(gestor: boolean) {
    TestBed.configureTestingModule({
      imports: [Estrutura],
      providers: [
        provideRouter([]),
        {
          provide: Sessao,
          useValue: {
            usuario: signal({ id: 'u', nome: 'Pessoa Teste', perfil: gestor ? 'Gestor' : 'Tecnico', deveTrocarSenha: false }).asReadonly(),
            ehGestor: signal(gestor).asReadonly(),
            sair: () => Promise.resolve(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Estrutura);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { el, menu: Array.from(el.querySelectorAll('nav a')).map((a) => a.textContent?.trim()) };
  }

  it('técnico vê só Clientes e Equipamentos', () => {
    const { menu } = montar(false);
    expect(menu).toEqual(['Clientes', 'Equipamentos']);
  });

  it('gestor também vê Catálogo, Empresa e Usuários', () => {
    const { menu } = montar(true);
    expect(menu).toEqual(['Clientes', 'Equipamentos', 'Catálogo', 'Empresa', 'Usuários']);
  });

  it('mostra o nome e o perfil de quem está logado', () => {
    expect(montar(true).el.textContent).toContain('Pessoa Teste · Gestor');
    TestBed.resetTestingModule();
    expect(montar(false).el.textContent).toContain('Pessoa Teste · Técnico');
  });
});
