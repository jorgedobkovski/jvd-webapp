import { TestBed } from '@angular/core/testing';
import { BotaoDeTema } from '../compartilhado/botao-de-tema';
import { Tema } from './tema';

describe('Tema', () => {
  let ouvinte: ((e: { matches: boolean }) => void) | null;

  function sistema(escuro: boolean) {
    ouvinte = null;
    vi.stubGlobal('matchMedia', () => ({
      matches: escuro,
      addEventListener: (_: string, f: (e: { matches: boolean }) => void) => (ouvinte = f),
    }));
  }

  const raiz = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    raiz.classList.remove('dark');
    raiz.style.colorScheme = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    raiz.classList.remove('dark');
  });

  it('sem escolha salva, segue o sistema (escuro) e aplica a classe no <html>', () => {
    sistema(true);
    const tema = TestBed.inject(Tema);

    expect(tema.modo()).toBe('escuro');
    expect(raiz.classList.contains('dark')).toBe(true);
    expect(raiz.style.colorScheme).toBe('dark');
  });

  it('sem escolha salva e sistema claro: tema claro, sem a classe', () => {
    sistema(false);
    const tema = TestBed.inject(Tema);

    expect(tema.modo()).toBe('claro');
    expect(raiz.classList.contains('dark')).toBe(false);
    expect(raiz.style.colorScheme).toBe('light');
  });

  it('alternar troca o tema, aplica a classe e guarda a escolha', () => {
    sistema(true);
    const tema = TestBed.inject(Tema);

    tema.alternar();
    expect(tema.modo()).toBe('claro');
    expect(raiz.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('jvd.tema')).toBe('claro');

    tema.alternar();
    expect(tema.modo()).toBe('escuro');
    expect(raiz.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('jvd.tema')).toBe('escuro');
  });

  it('a escolha salva vale mais que o sistema; valor estranho no armazenamento é ignorado', () => {
    sistema(true);
    localStorage.setItem('jvd.tema', 'claro');
    expect(TestBed.inject(Tema).modo()).toBe('claro');

    TestBed.resetTestingModule();
    localStorage.setItem('jvd.tema', 'roxo');
    expect(TestBed.inject(Tema).modo()).toBe('escuro');
  });

  it('sem escolha, acompanha a mudança do sistema; com escolha, ignora', () => {
    sistema(false);
    const tema = TestBed.inject(Tema);

    ouvinte!({ matches: true });
    expect(tema.modo()).toBe('escuro');
    expect(raiz.classList.contains('dark')).toBe(true);

    tema.alternar(); // escolhe "claro"
    ouvinte!({ matches: true });
    expect(tema.modo()).toBe('claro');
    expect(raiz.classList.contains('dark')).toBe(false);
  });

  it('armazenamento indisponível não quebra: o tema troca nesta sessão da página', () => {
    sistema(false);
    const tema = TestBed.inject(Tema);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(() => tema.alternar()).not.toThrow();
    expect(tema.modo()).toBe('escuro');
    vi.restoreAllMocks();
  });

  it('navegador sem matchMedia: começa claro', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(TestBed.inject(Tema).modo()).toBe('claro');
  });

  it('botão: o rótulo diz o que o clique faz e o clique alterna', () => {
    sistema(false);
    const fixture = TestBed.createComponent(BotaoDeTema);
    fixture.detectChanges();
    const botao = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(botao.textContent).toContain('Tema escuro');
    botao.click();
    fixture.detectChanges();
    expect(botao.textContent).toContain('Tema claro');
    expect(raiz.classList.contains('dark')).toBe(true);
  });
});
