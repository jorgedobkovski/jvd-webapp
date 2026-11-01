import { Component, computed, inject, signal } from '@angular/core';
import { form, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvisosDoCadastro, avisosRecebidos } from '../../compartilhado/avisos-do-cadastro';
import { formatarDocumento } from '../../compartilhado/formatadores';
import { Aviso } from '../../compartilhado/modelos';
import { lerErro } from '../../core/erros';
import { Sessao } from '../../core/sessao';
import { Cliente, ClientesApi } from '../clientes/clientes-api';
import { CamposDeEquipamento, CamposDoEquipamento, EQUIPAMENTO_VAZIO, regrasDoEquipamento } from './campos-do-equipamento';
import { DadosDoEquipamento, Equipamento, EquipamentosApi } from './equipamentos-api';

interface ClienteEscolhido {
  id: string;
  nome: string;
}

/**
 * Cadastro e edição de equipamento (a rota com `:id` edita). Trocar o cliente TRANSFERE a balança (a API audita).
 * Regras: IA/Specs/CLIENTES_EQUIPAMENTOS.md.
 */
@Component({
  selector: 'jvd-equipamento-formulario',
  imports: [CamposDoEquipamento, RouterLink, AvisosDoCadastro],
  templateUrl: './equipamento-formulario.html',
})
export class EquipamentoFormulario {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(EquipamentosApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly documento = formatarDocumento;
  protected readonly id = this.rota.snapshot.paramMap.get('id');
  protected readonly edicao = this.id !== null;

  protected readonly modelo = signal<CamposDeEquipamento>({ ...EQUIPAMENTO_VAZIO });
  protected readonly formulario = form(this.modelo, regrasDoEquipamento);

  // Cliente (escolhido por busca)
  protected readonly cliente = signal<ClienteEscolhido | null>(null);
  protected readonly clienteOriginal = signal<string | null>(null);
  protected readonly trocandoCliente = signal(false);
  protected readonly buscaCliente = signal('');
  protected readonly clientesEncontrados = signal<Cliente[]>([]);
  protected readonly buscouCliente = signal(false);
  protected readonly buscandoCliente = signal(false);
  protected readonly semCliente = signal(false);

  protected readonly equipamento = signal<Equipamento | null>(null);
  /** Edição cujo cadastro não pôde ser carregado (inexistente, inativo para o técnico, erro): não mostra formulário vazio. */
  protected readonly semCadastro = signal(false);
  private readonly versao = signal('');
  protected readonly carregando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);
  protected readonly conflito = signal(false);
  protected readonly salvo = signal(false);
  protected readonly avisos = signal<Aviso[]>(avisosRecebidos());
  protected readonly confirmando = signal(false);
  protected readonly titulo = computed(() => (this.edicao ? 'Editar equipamento' : 'Novo equipamento'));
  protected readonly vaiTransferir = computed(() => this.edicao && this.cliente() !== null && this.cliente()!.id !== this.clienteOriginal());

  constructor() {
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    this.carregando.set(true);
    try {
      if (this.id) {
        try {
          await this.carregar(this.id);
        } catch (falha) {
          this.semCadastro.set(true);
          throw falha;
        }
      } else {
        const clienteId = this.rota.snapshot.queryParamMap.get('clienteId');
        if (clienteId) {
          const c = await this.clientesApi.obter(clienteId);
          this.cliente.set({ id: c.id, nome: c.nomeRazaoSocial });
        }
        this.trocandoCliente.set(this.cliente() === null);
      }
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  protected async recarregar(): Promise<void> {
    if (!this.id) return;
    this.carregando.set(true);
    this.conflito.set(false);
    this.erros.set([]);
    try {
      await this.carregar(this.id);
      this.semCadastro.set(false);
    } catch (falha) {
      this.semCadastro.set(true);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregar(id: string): Promise<void> {
    const e = await this.api.obter(id);
    this.aplicar(e);
  }

  private aplicar(e: Equipamento): void {
    this.equipamento.set(e);
    this.versao.set(e.versao);
    this.clienteOriginal.set(e.clienteId);
    this.cliente.set({ id: e.clienteId, nome: e.clienteNome });
    this.trocandoCliente.set(false);
    this.modelo.set({
      descricao: e.descricao,
      numeroSerie: e.numeroSerie ?? '',
      numeroInmetro: e.numeroInmetro ?? '',
      observacoes: e.observacoes ?? '',
    });
  }

  protected async procurarCliente(): Promise<void> {
    this.buscandoCliente.set(true);
    this.buscouCliente.set(false);
    try {
      const pagina = await this.clientesApi.listar({ busca: this.buscaCliente(), ativo: true, tamanho: 8 });
      this.clientesEncontrados.set(pagina.itens);
      this.buscouCliente.set(true);
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.buscandoCliente.set(false);
    }
  }

  /** Desiste de escolher outro cliente: volta a exibir o atual, sem repetir a busca. */
  protected cancelarTroca(): void {
    this.trocandoCliente.set(false);
    this.clientesEncontrados.set([]);
    this.buscouCliente.set(false);
    this.buscaCliente.set('');
  }

  protected escolherCliente(c: Cliente): void {
    this.cliente.set({ id: c.id, nome: c.nomeRazaoSocial });
    this.trocandoCliente.set(false);
    this.semCliente.set(false);
    this.clientesEncontrados.set([]);
    this.buscouCliente.set(false);
    this.buscaCliente.set('');
  }

  protected salvar(): void {
    if (this.enviando()) return; // Enter repetido durante o envio não pode criar duplicado nem gerar conflito falso
    this.erros.set([]);
    this.conflito.set(false);
    this.salvo.set(false);
    this.semCliente.set(this.cliente() === null);

    void submit(this.formulario, async () => {
      const escolhido = this.cliente();
      if (!escolhido) return;

      this.enviando.set(true);
      try {
        const dados: DadosDoEquipamento = { clienteId: escolhido.id, ...this.modelo() };
        if (this.id) {
          const resposta = await this.api.atualizar(this.id, dados, this.versao());
          this.aplicar(resposta.equipamento);
          this.avisos.set(resposta.avisos);
          this.salvo.set(true);
        } else {
          const resposta = await this.api.criar(dados);
          await this.router.navigate(['/equipamentos', resposta.equipamento.id, 'editar'], { state: { avisos: resposta.avisos } });
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
      await this.carregar(this.id);
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.enviando.set(false);
    }
  }
}
