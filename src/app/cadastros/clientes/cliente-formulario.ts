import { Component, computed, inject, signal } from '@angular/core';
import { form, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { lerErro } from '../../core/erros';
import { CamposDoCliente, CLIENTE_VAZIO, regrasDoCliente } from './campos-do-cliente';
import { Cliente, ClientesApi, DadosDoCliente } from './clientes-api';

/** Cadastro e edição de cliente (a rota com `:id` edita). Limites e regras: IA/Specs/CLIENTES_EQUIPAMENTOS.md. */
@Component({
  selector: 'jvd-cliente-formulario',
  imports: [CamposDoCliente, RouterLink],
  templateUrl: './cliente-formulario.html',
})
export class ClienteFormulario {
  private readonly api = inject(ClientesApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly id = this.rota.snapshot.paramMap.get('id');
  protected readonly edicao = this.id !== null;

  protected readonly modelo = signal<DadosDoCliente>({ ...CLIENTE_VAZIO });
  protected readonly formulario = form(this.modelo, regrasDoCliente);

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
