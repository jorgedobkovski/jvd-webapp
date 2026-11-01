import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { salvarArquivo } from '../compartilhado/arquivos';
import { formatarData } from '../compartilhado/datas';
import { formatarDocumento, formatarEndereco, formatarReais } from '../compartilhado/formatadores';
import { lerErro } from '../core/erros';
import { Sessao } from '../core/sessao';
import { RelatorioDetalhe, RelatoriosApi, VIAS, ViaDoRelatorio, rotuloDoEstado, rotuloDoTipo } from './relatorios-api';

/** Consulta de um relatório. Rascunho: editar, emitir ou descartar. Emitido ou cancelado: baixar o PDF das 3 vias. */
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
  protected readonly confirmando = signal<'emitir' | 'descartar' | null>(null);

  protected readonly escolha = signal<{ via: ViaDoRelatorio }>({ via: 'cliente' });
  protected readonly formularioDaVia = form(this.escolha);
  protected readonly baixando = signal(false);

  protected readonly ehRascunho = computed(() => this.relatorio()?.status === 'Rascunho');
  protected readonly temPdf = computed(() => {
    const status = this.relatorio()?.status;
    return status === 'Emitido' || status === 'Cancelado';
  });

  /** Botão de confirmação aberto no momento (emitir ou descartar): recebe o foco para teclado e leitor de tela. */
  private readonly botaoDeConfirmar = viewChild<ElementRef<HTMLButtonElement>>('confirmar');

  constructor() {
    void this.carregar();
    effect(() => {
      if (this.confirmando() !== null) queueMicrotask(() => this.botaoDeConfirmar()?.nativeElement.focus());
    });
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    try {
      this.relatorio.set(await this.api.obter(this.id));
      this.naoEncontrado.set(false);
    } catch (falha) {
      const erro = lerErro(falha);
      if (erro.status === 404) this.naoEncontrado.set(true);
      else this.erros.set(erro.mensagens);
    } finally {
      this.carregando.set(false);
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
