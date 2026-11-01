import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Usuario } from '../../core/modelos';
import { Sessao } from '../../core/sessao';
import { proximoTick, usuario } from '../../core/teste-apoio';
import { TrocarSenha } from './trocar-senha';

describe('TrocarSenha', () => {
  const trocarNaSessao = vi.fn();
  const sairDaSessao = vi.fn();
  const atual = signal<Usuario | null>(null);

  function montar(deveTrocar = true) {
    trocarNaSessao.mockReset();
    sairDaSessao.mockReset().mockResolvedValue(undefined);
    atual.set(usuario({ deveTrocarSenha: deveTrocar }));
    TestBed.configureTestingModule({
      imports: [TrocarSenha],
      providers: [provideRouter([]), { provide: Sessao, useValue: { trocarSenha: trocarNaSessao, sair: sairDaSessao, usuario: atual.asReadonly() } }],
    });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TrocarSenha);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, navegar };
  }

  async function enviar(fixture: ReturnType<typeof montar>['fixture'], atualSenha: string, nova: string, confirmacao: string) {
    const el = fixture.nativeElement as HTMLElement;
    for (const [id, valor] of [['#senha-atual', atualSenha], ['#nova-senha', nova], ['#confirmacao', confirmacao]] as const) {
      const campo = el.querySelector<HTMLInputElement>(id)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('com senha provisória explica que a troca é obrigatória', () => {
    const { el } = montar(true);
    expect(el.textContent).toContain('Sua senha é provisória');
  });

  it('troca voluntária não mostra o aviso de senha provisória', () => {
    const { el } = montar(false);
    expect(el.textContent).not.toContain('Sua senha é provisória');
  });

  it('recusa nova senha curta, sem maiúscula/minúscula/número, igual à atual ou sem confirmação', async () => {
    const { fixture, el } = montar();

    await enviar(fixture, 'Atual12345', 'curta1A', 'curta1A');
    expect(el.textContent).toContain('pelo menos 10 caracteres');

    await enviar(fixture, 'Atual12345', 'somenteminusculas', 'somenteminusculas');
    expect(el.textContent).toContain('Use maiúscula, minúscula e número.');

    await enviar(fixture, 'Atual12345', 'Atual12345', 'Atual12345');
    expect(el.textContent).toContain('diferente da atual');

    await enviar(fixture, 'Atual12345', 'Nova1234567', 'Outra1234567');
    expect(el.textContent).toContain('As senhas não conferem.');

    expect(trocarNaSessao).not.toHaveBeenCalled();
  });

  it('campo vazio mostra só a mensagem de obrigatório, sem empilhar as outras regras', async () => {
    const { fixture, el } = montar();

    await enviar(fixture, '', '', '');

    const erros = el.querySelector('#nova-senha-erro')!.textContent!;
    expect(erros).toContain('Informe a nova senha.');
    expect(erros).not.toContain('Use maiúscula');
  });

  it('troca válida chama a API e volta para a tela inicial', async () => {
    const { fixture, navegar } = montar();
    trocarNaSessao.mockResolvedValue(usuario());

    await enviar(fixture, 'Atual12345', 'Nova1234567', 'Nova1234567');

    expect(trocarNaSessao).toHaveBeenCalledWith('Atual12345', 'Nova1234567');
    expect(navegar).toHaveBeenCalledWith(['/']);
  });

  it('senha atual incorreta mostra a mensagem da API e não navega', async () => {
    const { fixture, el, navegar } = montar();
    trocarNaSessao.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { codigo: 'usuario.senha_atual_incorreta', detail: 'A senha atual está incorreta.' } }),
    );

    await enviar(fixture, 'Errada12345', 'Nova1234567', 'Nova1234567');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('A senha atual está incorreta.');
    expect(navegar).not.toHaveBeenCalled();
    for (const id of ['#senha-atual', '#nova-senha', '#confirmacao']) expect(el.querySelector<HTMLInputElement>(id)!.value).toBe('');
  });

  it('Sair encerra a sessão e leva à entrada', async () => {
    const { el, navegar } = montar();

    el.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    await proximoTick();

    expect(sairDaSessao).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/entrar']);
  });
});
