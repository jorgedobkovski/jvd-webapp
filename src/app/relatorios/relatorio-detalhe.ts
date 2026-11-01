import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { salvarArquivo } from '../compartilhado/arquivos';
import { formatarData, formatarDataHora } from '../compartilhado/datas';
import { formatarDocumento, formatarEndereco, formatarReais } from '../compartilhado/formatadores';
import { lerErro } from '../core/erros';
import { Sessao } from '../core/sessao';
import { Mudanca, mudancasDaRevisao } from './historico';
import { RelatorioDetalhe, RelatoriosApi, VIAS, ViaDoRelatorio, rotuloDoEstado, rotuloDoTipo } from './relatorios-api';

interface RevisaoNaTela {
  revisao: number;
  quando: string;
  porNome: string;
  motivo: string;
  mudancas: Mudanca[];
}

/**
 * Consulta de um relatório. Rascunho: editar, emitir ou descartar. Emitido: retificar, cancelar (com motivo), baixar o PDF
 * das 3 vias e ver o histórico das retificações. Cancelado: PDF e histórico.
 */
@Component({
  selector: 'jvd-relatorio-detalhe',
  imports: [RouterLink, FormField],
  templateUrl: './relatorio-detalhe.html',
})
export class RelatorioDetalheTela {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(RelatoriosApi);
  private readonly router = inject(Router);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly vias = VIAS;
  protected readonly data = formatarData;
  protected readonly reais = formatarReais;
  protected readonly documento = formatarDocumento;
  protected readonly endereco = formatarEndereco;
  protected readonly tipo = rotuloDoTipo;
  protected readonly estado = rotuloDoEstado;

  protected readonly relatorio = signal<RelatorioDetalhe | null>(null);
  protected readonly carregando = signal(true);
  protected readonly naoEncontrado = signal(false);
  protected readonly trabalhando = signal(false);
  protected readonly erros = signal<string[]>([]);
  protected readonly confirmando = signal<'emitir' | 'descartar' | 'cancelar' | null>(null);

  // Motivo do cancelamento (obrigatório, até 500; o motivo fica no relatório e não vai para o log de auditoria)
  protected readonly motivoModelo = signal({ motivo: '' });
  protected readonly motivoFormulario = form(this.motivoModelo, (f) => {
    required(f.motivo, { message: 'Informe o motivo do cancelamento.' });
    maxLength(f.motivo, 500, { message: 'Use no máximo 500 caracteres.' });
    validate(f.motivo, ({ value }) => (value() !== '' && value().trim() === '' ? { kind: 'vazio', message: 'Informe o motivo do cancelamento.' } : undefined));
  });

  protected readonly revisoes = signal<RevisaoNaTela[]>([]);
  protected readonly erroDoHistorico = signal('');

  protected readonly escolha = signal<{ via: ViaDoRelatorio }>({ via: 'cliente' });
  protected readonly formularioDaVia = form(this.escolha);
  protected readonly baixando = signal(false);

  protected readonly ehRascunho = computed(() => this.relatorio()?.status === 'Rascunho');
  protected readonly ehEmitido = computed(() => this.relatorio()?.status === 'Emitido');
  protected readonly temPdf = computed(() => {
    const status = this.relatorio()?.status;
    return status === 'Emitido' || status === 'Cancelado';
  });

  /** Botão de confirmação aberto no momento (emitir ou descartar): recebe o foco para teclado e leitor de tela. */
  private readonly botaoDeConfirmar = viewChild<ElementRef<HTMLButtonElement>>('confirmar');
  private readonly campoDoMotivo = viewChild<ElementRef<HTMLTextAreaElement>>('campoMotivo');

  constructor() {
    void this.carregar();
    effect(() => {
      const confirmando = this.confirmando();
      if (confirmando === 'cancelar') queueMicrotask(() => this.campoDoMotivo()?.nativeElement.focus());
      else if (confirmando !== null) queueMicrotask(() => this.botaoDeConfirmar()?.nativeElement.focus());
    });
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    try {
      this.relatorio.set(await this.api.obter(this.id));
      this.naoEncontrado.set(false);
      void this.carregarHistorico();
    } catch (falha) {
      const erro = lerErro(falha);
      if (erro.status === 404) this.naoEncontrado.set(true);
      else this.erros.set(erro.mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  /** Histórico das retificações (só existe depois da 1ª revisão). Dados pessoais: mesmo acesso do relatório. */
  private async carregarHistorico(): Promise<void> {
    this.erroDoHistorico.set('');
    const atual = this.relatorio();
    if (!atual || atual.revisao === 0) {
      this.revisoes.set([]);
      return;
    }
    try {
      const lista = await this.api.listarRevisoes(this.id);
      this.revisoes.set(
        lista.map((r) => ({
          revisao: r.revisao,
          quando: formatarDataHora(r.retificadoEm),
          porNome: r.retificadoPorNome,
          motivo: r.motivo,
          mudancas: mudancasDaRevisao(r.dadosAnteriores, r.dadosNovos),
        })),
      );
    } catch (falha) {
      this.erroDoHistorico.set(lerErro(falha).mensagem);
    }
  }

  protected async cancelar(): Promise<void> {
    const atual = this.relatorio();
    if (!atual || this.trabalhando()) return;
    this.motivoFormulario.motivo().markAsTouched();
    if (this.motivoFormulario().invalid()) return;

    this.trabalhando.set(true);
    this.erros.set([]);
    try {
      this.relatorio.set(await this.api.cancelar(this.id, this.motivoModelo().motivo.trim(), atual.versao));
      this.confirmando.set(null);
      this.motivoModelo.set({ motivo: '' });
      void this.carregarHistorico();
    } catch (falha) {
      const erro = lerErro(falha);
      if (erro.status === 409 && erro.codigo === 'conflito') {
        // Versão velha: fecha o painel e traz o relatório atual; a pessoa confere e cancela de novo se ainda fizer sentido.
        this.confirmando.set(null);
        await this.carregar();
        this.erros.set(['Outra pessoa alterou este relatório. A tela foi atualizada: confira os dados e cancele de novo se ainda for o caso.']);
      } else {
        this.erros.set(erro.mensagens);
      }
    } finally {
      this.trabalhando.set(false);
    }
  }

  protected async emitir(): Promise<void> {
    const atual = this.relatorio();
    if (!atual || this.trabalhando()) return;
    this.trabalhando.set(true);
    this.erros.set([]);
    try {
      this.relatorio.set(await this.api.emitir(this.id, atual.versao));
      this.confirmando.set(null);
    } catch (falha) {
      const erro = lerErro(falha);
      this.confirmando.set(null);
      this.erros.set(erro.status === 409 && erro.codigo === 'conflito' ? ['Outra pessoa alterou este rascunho. Recarregue a página e confira antes de emitir.'] : erro.mensagens);
    } finally {
      this.trabalhando.set(false);
    }
  }

  protected async descartar(): Promise<void> {
    if (this.trabalhando()) return;
    this.trabalhando.set(true);
    this.erros.set([]);
    try {
      await this.api.descartar(this.id);
      await this.router.navigate(['/relatorios']);
    } catch (falha) {
      this.confirmando.set(null);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.trabalhando.set(false);
    }
  }

  protected async baixarPdf(): Promise<void> {
    const atual = this.relatorio();
    if (!atual || this.baixando()) return;
    this.baixando.set(true);
    this.erros.set([]);
    try {
      const arquivo = await this.api.baixarPdf(this.id, this.escolha().via);
      salvarArquivo(arquivo, `relatorio-${atual.numeroFormatado ?? atual.id}.pdf`);
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.baixando.set(false);
    }
  }
}
