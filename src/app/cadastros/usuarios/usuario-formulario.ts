import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormField, email, form, maxLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { gerarSenhaProvisoria } from '../../compartilhado/senha-provisoria';
import { lerErro } from '../../core/erros';
import { Perfil } from '../../core/modelos';
import { Sessao } from '../../core/sessao';
import { UsuarioDoSistema, UsuariosApi } from './usuarios-api';

/**
 * Cadastro e edição de usuário (só gestor). A senha provisória é GERADA aqui, enviada uma vez e mostrada uma única
 * vez na tela para o gestor entregá-la; nada a guarda (some ao concluir ou sair da tela). O usuário é obrigado a
 * trocá-la no primeiro acesso (ADR-006).
 */
@Component({
  selector: 'jvd-usuario-formulario',
  imports: [FormField, RouterLink],
  templateUrl: './usuario-formulario.html',
})
export class UsuarioFormulario {
  private readonly api = inject(UsuariosApi);
  private readonly sessao = inject(Sessao);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly id = this.rota.snapshot.paramMap.get('id');
  protected readonly edicao = this.id !== null;

  protected readonly modelo = signal({ nome: '', email: '', perfil: 'Tecnico' as Perfil, cpf: '' });
  protected readonly formulario = form(this.modelo, (u) => {
    required(u.nome, { message: 'Informe o nome.' });
    maxLength(u.nome, 150, { message: 'Use no máximo 150 caracteres.' });
    required(u.email, { message: 'Informe o e-mail.' });
    email(u.email, { message: 'Informe um e-mail válido.' });
    maxLength(u.email, 254, { message: 'E-mail longo demais.' });
    maxLength(u.cpf, 20, { message: 'CPF longo demais.' });
  });

  protected readonly usuario = signal<UsuarioDoSistema | null>(null);
  protected readonly perfilOriginal = signal<Perfil | null>(null);
  protected readonly carregando = signal(this.edicao);
  /** Edição cujo cadastro não pôde ser carregado: não mostra formulário vazio. */
  protected readonly semCadastro = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);
  protected readonly salvo = signal(false);
  protected readonly confirmando = signal<'situacao' | 'senha' | null>(null);

  /** Senha provisória recém-gerada: aparece uma vez, até a pessoa concluir ou sair da tela. */
  protected readonly senhaEntregue = signal<{ senha: string; paraNome: string } | null>(null);
  protected readonly copiado = signal(false);
  protected readonly falhaAoCopiar = signal(false);

  protected readonly titulo = computed(() => (this.edicao ? 'Editar usuário' : 'Novo usuário'));
  /** O gestor não desativa nem redefine a própria senha por aqui (a API também recusa). */
  protected readonly souEu = computed(() => this.id !== null && this.id === this.sessao.usuario()?.id);
  protected readonly mudouPerfil = computed(() => this.edicao && this.perfilOriginal() !== null && this.modelo().perfil !== this.perfilOriginal());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.senhaEntregue.set(null));
    if (this.id) void this.carregar(this.id);
  }

  protected async carregar(id: string): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    try {
      this.aplicar(await this.api.obter(id));
      this.semCadastro.set(false);
    } catch (falha) {
      this.semCadastro.set(true);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  private aplicar(u: UsuarioDoSistema): void {
    this.usuario.set(u);
    this.perfilOriginal.set(u.perfil);
    this.modelo.set({ nome: u.nome, email: u.email, perfil: u.perfil, cpf: u.cpf ?? '' });
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.erros.set([]);
    this.salvo.set(false);
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        const { nome, email: login, perfil, cpf } = this.modelo();
        if (this.id) {
          this.aplicar(await this.api.atualizar(this.id, { nome, perfil, cpf }));
          this.salvo.set(true);
        } else {
          const senha = gerarSenhaProvisoria();
          const criado = await this.api.criar({ nome, email: login, perfil, cpf, senhaProvisoria: senha });
          this.senhaEntregue.set({ senha, paraNome: criado.nome });
        }
      } catch (falha) {
        this.erros.set(lerErro(falha).mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }

  protected async alternarSituacao(ativar: boolean): Promise<void> {
    if (!this.id || this.enviando()) return;
    this.enviando.set(true);
    this.erros.set([]);
    try {
      if (ativar) await this.api.reativar(this.id);
      else await this.api.desativar(this.id);
      this.confirmando.set(null);
      this.aplicar(await this.api.obter(this.id));
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.enviando.set(false);
    }
  }

  protected async redefinirSenha(): Promise<void> {
    const atual = this.usuario();
    if (!this.id || !atual || this.enviando()) return;
    this.enviando.set(true);
    this.erros.set([]);
    try {
      const senha = gerarSenhaProvisoria();
      await this.api.redefinirSenha(this.id, senha);
      this.confirmando.set(null);
      this.senhaEntregue.set({ senha, paraNome: atual.nome });
      this.aplicar(await this.api.obter(this.id));
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.enviando.set(false);
    }
  }

  protected async copiar(): Promise<void> {
    const entregue = this.senhaEntregue();
    if (!entregue) return;
    this.falhaAoCopiar.set(false);
    try {
      await navigator.clipboard.writeText(entregue.senha);
      this.copiado.set(true);
    } catch {
      this.copiado.set(false);
      this.falhaAoCopiar.set(true);
    }
  }

  /** Esconde a senha. Depois de criar, volta para a lista; depois de redefinir, continua na tela do usuário. */
  protected async concluir(): Promise<void> {
    this.senhaEntregue.set(null);
    this.copiado.set(false);
    this.falhaAoCopiar.set(false);
    if (!this.edicao) await this.router.navigate(['/usuarios']);
  }
}
