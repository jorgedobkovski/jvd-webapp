import { Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, maxLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UFS } from '../../compartilhado/formatadores';
import { lerErro } from '../../core/erros';
import { Cliente, ClientesApi, DadosDoCliente } from './clientes-api';

const VAZIO: DadosDoCliente = {
  nomeRazaoSocial: '',
  nomeFantasia: '',
  documento: '',
  inscricaoEstadualRg: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cep: '',
  cidade: '',
  uf: '',
  telefone: '',
  email: '',
};

/** Cadastro e edição de cliente (a rota com `:id` edita). Limites e regras: IA/Specs/CLIENTES_EQUIPAMENTOS.md. */
@Component({
  selector: 'jvd-cliente-formulario',
  imports: [FormField, RouterLink],
  templateUrl: './cliente-formulario.html',
})
export class ClienteFormulario {
  private readonly api = inject(ClientesApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly ufs = UFS;
  protected readonly id = this.rota.snapshot.paramMap.get('id');
  protected readonly edicao = this.id !== null;

  protected readonly modelo = signal<DadosDoCliente>({ ...VAZIO });
  protected readonly formulario = form(this.modelo, (c) => {
    required(c.nomeRazaoSocial, { message: 'Informe o nome ou a razão social.' });
    maxLength(c.nomeRazaoSocial, 200, { message: 'Use no máximo 200 caracteres.' });
    maxLength(c.nomeFantasia, 200, { message: 'Use no máximo 200 caracteres.' });
    maxLength(c.documento, 40, { message: 'Documento longo demais.' });
    maxLength(c.inscricaoEstadualRg, 30, { message: 'Use no máximo 30 caracteres.' });
    maxLength(c.logradouro, 150, { message: 'Use no máximo 150 caracteres.' });
    maxLength(c.numero, 20, { message: 'Use no máximo 20 caracteres.' });
    maxLength(c.bairro, 80, { message: 'Use no máximo 80 caracteres.' });
    maxLength(c.cep, 20, { message: 'CEP longo demais.' });
    maxLength(c.cidade, 80, { message: 'Use no máximo 80 caracteres.' });
    maxLength(c.telefone, 30, { message: 'Use no máximo 30 caracteres.' });
    maxLength(c.email, 254, { message: 'E-mail longo demais.' });
    email(c.email, { message: 'Informe um e-mail válido.', when: ({ value }) => value() !== '' });
  });

  private readonly versao = signal('');
  protected readonly carregando = signal(this.edicao);
  /** Edição cujo cadastro não pôde ser carregado (inexistente, inativo para o técnico, erro): não mostra formulário vazio. */
  protected readonly semCadastro = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);
  /** Conflito de versão: outra pessoa salvou antes. */
  protected readonly conflito = signal(false);
  protected readonly titulo = computed(() => (this.edicao ? 'Editar cliente' : 'Novo cliente'));

  constructor() {
    if (this.id) void this.carregar(this.id);
  }

  protected async carregar(id: string): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    this.conflito.set(false);
    try {
      const cliente = await this.api.obter(id);
      this.preencher(cliente);
      this.semCadastro.set(false);
    } catch (falha) {
      this.semCadastro.set(true);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  protected salvar(): void {
    if (this.enviando()) return; // Enter repetido durante o envio não pode criar duplicado nem gerar conflito falso
    this.erros.set([]);
    this.conflito.set(false);
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        const salvo = this.id
          ? await this.api.atualizar(this.id, this.modelo(), this.versao())
          : await this.api.criar(this.modelo());
        await this.router.navigate(['/clientes', salvo.cliente.id], { state: { avisos: salvo.avisos } });
      } catch (falha) {
        const erro = lerErro(falha);
        if (erro.status === 409 && erro.codigo === 'conflito') this.conflito.set(true);
        else this.erros.set(erro.mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }

  private preencher(c: Cliente): void {
    this.versao.set(c.versao);
    this.modelo.set({
      nomeRazaoSocial: c.nomeRazaoSocial,
      nomeFantasia: c.nomeFantasia ?? '',
      documento: c.documento ?? '',
      inscricaoEstadualRg: c.inscricaoEstadualRg ?? '',
      logradouro: c.logradouro ?? '',
      numero: c.numero ?? '',
      bairro: c.bairro ?? '',
      cep: c.cep ?? '',
      cidade: c.cidade ?? '',
      uf: c.uf ?? '',
      telefone: c.telefone ?? '',
      email: c.email ?? '',
    });
  }
}
