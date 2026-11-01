import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvisosDoCadastro, avisosRecebidos } from '../../compartilhado/avisos-do-cadastro';
import { lerPreco } from '../../compartilhado/formatadores';
import { Aviso } from '../../compartilhado/modelos';
import { lerErro } from '../../core/erros';
import { CatalogoApi, Servico } from './catalogo-api';

/** Cadastro e edição de serviço do catálogo (a rota com `:id` edita). Regras: IA/Specs/EMISSOR_CATALOGO.md. */
@Component({
  selector: 'jvd-servico-formulario',
  imports: [FormField, RouterLink, AvisosDoCadastro],
  templateUrl: './servico-formulario.html',
})
export class ServicoFormulario {
  private readonly api = inject(CatalogoApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly id = this.rota.snapshot.paramMap.get('id');
  protected readonly edicao = this.id !== null;

  // O preço é digitado como texto ("150,50") e convertido ao enviar.
  protected readonly modelo = signal({ descricao: '', codigoOrigem: '', preco: '' });
  protected readonly formulario = form(this.modelo, (s) => {
    required(s.descricao, { message: 'Informe a descrição do serviço.' });
    maxLength(s.descricao, 200, { message: 'Use no máximo 200 caracteres.' });
    maxLength(s.codigoOrigem, 40, { message: 'Use no máximo 40 caracteres.' });
    validate(s.preco, ({ value }) =>
      lerPreco(value()) === undefined ? { kind: 'preco', message: 'Use um valor como 150 ou 150,50 (até 2 casas decimais).' } : undefined,
    );
  });

  protected readonly servico = signal<Servico | null>(null);
  private readonly versao = signal('');
  protected readonly carregando = signal(this.edicao);
  /** Edição cujo cadastro não pôde ser carregado: não mostra formulário vazio. */
  protected readonly semCadastro = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);
  protected readonly conflito = signal(false);
  protected readonly salvo = signal(false);
  protected readonly avisos = signal<Aviso[]>(avisosRecebidos());
  protected readonly confirmando = signal(false);
  protected readonly titulo = computed(() => (this.edicao ? 'Editar serviço' : 'Novo serviço'));

  constructor() {
    if (this.id) void this.carregar(this.id);
  }

  protected async carregar(id: string): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    this.conflito.set(false);
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

  private aplicar(s: Servico): void {
    this.servico.set(s);
    this.versao.set(s.versao);
    this.modelo.set({
      descricao: s.descricao,
      codigoOrigem: s.codigoOrigem ?? '',
      preco: s.precoSugerido === null ? '' : String(s.precoSugerido).replace('.', ','),
    });
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.erros.set([]);
    this.conflito.set(false);
    this.salvo.set(false);
    void submit(this.formulario, async () => {
      const { descricao, codigoOrigem, preco } = this.modelo();
      const precoSugerido = lerPreco(preco);
      if (precoSugerido === undefined) return;

      this.enviando.set(true);
      try {
        const dados = { descricao, codigoOrigem, precoSugerido };
        if (this.id) {
          const resposta = await this.api.atualizar(this.id, dados, this.versao());
          this.aplicar(resposta.servico);
          this.avisos.set(resposta.avisos);
          this.salvo.set(true);
        } else {
          const resposta = await this.api.criar(dados);
          await this.router.navigate(['/catalogo', resposta.servico.id, 'editar'], { state: { avisos: resposta.avisos } });
        }
      } catch (falha) {
        const erro = lerErro(falha);
        if (erro.status === 409 && erro.codigo === 'conflito') this.conflito.set(true);
        else this.erros.set(erro.mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }

  protected async alternarSituacao(ativar: boolean): Promise<void> {
    if (!this.id) return;
    this.enviando.set(true);
    this.erros.set([]);
    try {
      if (ativar) await this.api.reativar(this.id);
      else await this.api.desativar(this.id);
      this.confirmando.set(false);
      this.aplicar(await this.api.obter(this.id));
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.enviando.set(false);
    }
  }
}
