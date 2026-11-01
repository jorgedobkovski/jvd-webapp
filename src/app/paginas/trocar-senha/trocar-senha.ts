import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { lerErro } from '../../core/erros';
import { Sessao } from '../../core/sessao';

/** Política de senha da API: 10+ caracteres, maiúscula, minúscula e dígito (IA/JvdApi/API_REFERENCE.md). */
const TEM_MAIUSCULA = /\p{Lu}/u;
const TEM_MINUSCULA = /\p{Ll}/u;
const TEM_DIGITO = /\d/;

@Component({
  selector: 'jvd-trocar-senha',
  imports: [FormField],
  templateUrl: './trocar-senha.html',
})
export class TrocarSenha {
  private readonly sessao = inject(Sessao);
  private readonly router = inject(Router);

  protected readonly obrigatoria = computed(() => this.sessao.usuario()?.deveTrocarSenha === true);
  protected readonly modelo = signal({ senhaAtual: '', novaSenha: '', confirmacao: '' });
  protected readonly formulario = form(this.modelo, (campos) => {
    required(campos.senhaAtual, { message: 'Informe a senha atual.' });
    maxLength(campos.senhaAtual, 128, { message: 'Senha longa demais.' });

    required(campos.novaSenha, { message: 'Informe a nova senha.' });
    minLength(campos.novaSenha, 10, { message: 'A nova senha precisa ter pelo menos 10 caracteres.' });
    maxLength(campos.novaSenha, 128, { message: 'Senha longa demais.' });
    validate(campos.novaSenha, ({ value }) =>
      value() === '' || (TEM_MAIUSCULA.test(value()) && TEM_MINUSCULA.test(value()) && TEM_DIGITO.test(value()))
        ? undefined
        : { kind: 'politica', message: 'Use maiúscula, minúscula e número.' },
    );
    validate(campos.novaSenha, ({ value, valueOf }) =>
      value() !== '' && value() === valueOf(campos.senhaAtual) ? { kind: 'igual', message: 'A nova senha precisa ser diferente da atual.' } : undefined,
    );

    required(campos.confirmacao, { message: 'Repita a nova senha.' });
    validate(campos.confirmacao, ({ value, valueOf }) =>
      value() !== '' && value() !== valueOf(campos.novaSenha) ? { kind: 'confere', message: 'As senhas não conferem.' } : undefined,
    );
  });

  protected readonly erro = signal('');
  protected readonly enviando = signal(false);

  protected trocar(): void {
    this.erro.set('');
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        const { senhaAtual, novaSenha } = this.modelo();
        await this.sessao.trocarSenha(senhaAtual, novaSenha);
        this.modelo.set({ senhaAtual: '', novaSenha: '', confirmacao: '' });
        await this.router.navigate(['/']);
      } catch (falha) {
        this.modelo.set({ senhaAtual: '', novaSenha: '', confirmacao: '' });
        this.erro.set(lerErro(falha).mensagem);
      } finally {
        this.enviando.set(false);
      }
    });
  }

  protected async sair(): Promise<void> {
    await this.sessao.sair();
    await this.router.navigate(['/entrar']);
  }
}
