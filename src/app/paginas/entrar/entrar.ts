import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, maxLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { lerErro } from '../../core/erros';
import { BotaoDeTema } from '../../compartilhado/botao-de-tema';
import { retornoSeguro } from '../../core/guardas';
import { Sessao } from '../../core/sessao';

@Component({
  selector: 'jvd-entrar',
  imports: [FormField, BotaoDeTema],
  templateUrl: './entrar.html',
})
export class Entrar {
  private readonly sessao = inject(Sessao);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly modelo = signal({ email: '', senha: '' });
  protected readonly formulario = form(this.modelo, (campos) => {
    required(campos.email, { message: 'Informe o e-mail.' });
    email(campos.email, { message: 'Informe um e-mail válido.' });
    maxLength(campos.email, 254, { message: 'E-mail longo demais.' });
    required(campos.senha, { message: 'Informe a senha.' });
    maxLength(campos.senha, 128, { message: 'Senha longa demais.' });
  });

  protected readonly erro = signal('');
  protected readonly enviando = signal(false);

  protected entrar(): void {
    this.erro.set('');
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        const { email: usuarioEmail, senha } = this.modelo();
        const usuario = await this.sessao.entrar(usuarioEmail.trim(), senha);
        this.modelo.update((atual) => ({ ...atual, senha: '' }));
        if (usuario.deveTrocarSenha) await this.router.navigate(['/trocar-senha']);
        else await this.router.navigateByUrl(retornoSeguro(this.rota.snapshot.queryParamMap.get('retorno')));
      } catch (falha) {
        this.modelo.update((atual) => ({ ...atual, senha: '' }));
        this.erro.set(lerErro(falha).mensagem);
      } finally {
        this.enviando.set(false);
      }
    });
  }
}
