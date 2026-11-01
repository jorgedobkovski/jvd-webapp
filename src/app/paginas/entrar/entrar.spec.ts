import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Sessao } from '../../core/sessao';
import { proximoTick, usuario } from '../../core/teste-apoio';
import { Entrar } from './entrar';

describe('Entrar', () => {
  const entrarNaSessao = vi.fn();

  function montar(url = '/entrar') {
    entrarNaSessao.mockReset();
    TestBed.configureTestingModule({
      imports: [Entrar],
      providers: [provideRouter([]), { provide: Sessao, useValue: { entrar: entrarNaSessao } }],
    });
    const router = TestBed.inject(Router);
    const navegarUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    void router.navigateByUrl(url);
    const fixture = TestBed.createComponent(Entrar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, navegarUrl, navegar };
  }

  async function preencherEEnviar(fixture: ReturnType<typeof montar>['fixture'], email: string, senha: string) {
    const el = fixture.nativeElement as HTMLElement;
    const campoEmail = el.querySelector<HTMLInputElement>('#email')!;
    const campoSenha = el.querySelector<HTMLInputElement>('#senha')!;
    campoEmail.value = email;
    campoEmail.dispatchEvent(new Event('input'));
    campoSenha.value = senha;
    campoSenha.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('campos obrigatórios: não chama a API e mostra as mensagens', async () => {
    const { fixture, el } = montar();

    await preencherEEnviar(fixture, '', '');

    expect(entrarNaSessao).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Informe o e-mail.');
    expect(el.textContent).toContain('Informe a senha.');
  });

  it('e-mail inválido é recusado antes de chamar a API', async () => {
    const { fixture, el } = montar();

    await preencherEEnviar(fixture, 'sem-arroba', 'Senha12345');

    expect(entrarNaSessao).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Informe um e-mail válido.');
  });

  it('login válido vai para a tela inicial', async () => {
    const { fixture, navegarUrl } = montar();
    entrarNaSessao.mockResolvedValue(usuario());

    await preencherEEnviar(fixture, ' tecnico@exemplo.com ', 'Senha12345');

    expect(entrarNaSessao).toHaveBeenCalledWith('tecnico@exemplo.com', 'Senha12345');
    expect(navegarUrl).toHaveBeenCalledWith('/');
  });

  it('senha provisória leva direto à troca de senha', async () => {
    const { fixture, navegar } = montar();
    entrarNaSessao.mockResolvedValue(usuario({ deveTrocarSenha: true }));

    await preencherEEnviar(fixture, 'tecnico@exemplo.com', 'Provisoria1');

    expect(navegar).toHaveBeenCalledWith(['/trocar-senha']);
  });

  it('credencial recusada mostra a mensagem da API e limpa a senha', async () => {
    const { fixture, el } = montar();
    entrarNaSessao.mockRejectedValue(
      new HttpErrorResponse({ status: 401, error: { detail: 'E-mail ou senha inválidos.' } }),
    );

    await preencherEEnviar(fixture, 'tecnico@exemplo.com', 'errada12345');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('E-mail ou senha inválidos.');
    expect(el.querySelector<HTMLInputElement>('#senha')!.value).toBe('');
  });

  it('limite de tentativas (429) avisa para aguardar', async () => {
    const { fixture, el } = montar();
    entrarNaSessao.mockRejectedValue(new HttpErrorResponse({ status: 429 }));

    await preencherEEnviar(fixture, 'tecnico@exemplo.com', 'Senha12345');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Muitas tentativas');
  });
});
