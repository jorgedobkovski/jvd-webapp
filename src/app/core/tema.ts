import { DOCUMENT } from '@angular/common';
import { Service, computed, inject, signal } from '@angular/core';

export type ModoDeTema = 'claro' | 'escuro';

const CHAVE = 'jvd.tema';

/**
 * Tema claro/escuro. Sem escolha da pessoa, segue o do sistema (`prefers-color-scheme`); depois que ela troca, a escolha
 * fica no `localStorage` deste navegador. O `index.html` aplica a classe antes da primeira pintura (sem piscar).
 */
@Service()
export class Tema {
  private readonly documento = inject(DOCUMENT);
  private readonly consulta = this.documento.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  private readonly escolhido = signal<ModoDeTema | null>(this.lerEscolha());
  private readonly sistemaEscuro = signal(this.consulta?.matches ?? false);

  readonly modo = computed<ModoDeTema>(() => this.escolhido() ?? (this.sistemaEscuro() ? 'escuro' : 'claro'));
  readonly escuro = computed(() => this.modo() === 'escuro');

  constructor() {
    this.consulta?.addEventListener?.('change', (e) => {
      this.sistemaEscuro.set(e.matches);
      this.aplicar();
    });
    this.aplicar();
  }

  alternar(): void {
    const novo: ModoDeTema = this.escuro() ? 'claro' : 'escuro';
    this.escolhido.set(novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // sem armazenamento (janela privada, bloqueio): vale só nesta sessão da página
    }
    this.aplicar();
  }

  private aplicar(): void {
    const raiz = this.documento.documentElement;
    raiz.classList.toggle('dark', this.escuro());
    raiz.style.colorScheme = this.escuro() ? 'dark' : 'light';
  }

  private lerEscolha(): ModoDeTema | null {
    try {
      const valor = localStorage.getItem(CHAVE);
      return valor === 'claro' || valor === 'escuro' ? valor : null;
    } catch {
      return null;
    }
  }
}
