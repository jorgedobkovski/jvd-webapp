import { httpResource } from '@angular/common/http';
import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { formatarDataHora } from '../compartilhado/datas';
import { Pagina } from '../compartilhado/modelos';
import { Paginacao } from '../compartilhado/paginacao';
import { lerErro } from '../core/erros';
import {
  ImportacaoApi,
  ImportacaoResumo,
  RelatorioDeImportacao,
  TAMANHO_MAXIMO_DA_PLANILHA,
  TIPOS_DE_IMPORTACAO,
  TipoDeImportacao,
} from './importacao-api';
import { ResultadoDaImportacao } from './resultado-da-importacao';

interface Simulado {
  arquivo: File;
  tipo: TipoDeImportacao;
}

/**
 * Importação das planilhas do ERP (só gestor). Dois passos: SIMULAR (não grava nada) e, só depois de simular o MESMO
 * arquivo, IMPORTAR DE VERDADE (com confirmação). A mesma planilha não entra duas vezes (a API recusa).
 */
@Component({
  selector: 'jvd-importacao',
  imports: [FormField, RouterLink, Paginacao, ResultadoDaImportacao],
  templateUrl: './importacao.html',
})
export class ImportacaoTela {
  private readonly api = inject(ImportacaoApi);

  protected readonly tipos = TIPOS_DE_IMPORTACAO;
  protected readonly dataHora = formatarDataHora;

  protected readonly modelo = signal({ tipo: 'clientes' as TipoDeImportacao });
  protected readonly formulario = form(this.modelo);
  private readonly tipoEscolhido = computed(() => this.modelo().tipo);

  protected readonly arquivo = signal<File | null>(null);
  protected readonly erroDoArquivo = signal('');
  protected readonly relatorio = signal<RelatorioDeImportacao | null>(null);
  private readonly simulado = signal<Simulado | null>(null);
  protected readonly trabalhando = signal<'simulando' | 'importando' | null>(null);
  protected readonly erros = signal<string[]>([]);
  protected readonly confirmando = signal(false);
  protected readonly concluida = signal(false);

  /** Só importa o arquivo e o tipo EXATOS que acabaram de ser simulados, e se há algo a importar. */
  protected readonly podeImportar = computed(() => {
    const simulado = this.simulado();
    const relatorio = this.relatorio();
    return !!simulado && simulado.arquivo === this.arquivo() && simulado.tipo === this.tipoEscolhido() && relatorio?.simulacao === true && relatorio.totalImportados > 0;
  });

  protected readonly pagina = signal(1);
  protected readonly historico = httpResource<Pagina<ImportacaoResumo>>(() => ({
    url: this.api.url,
    params: { pagina: this.pagina(), tamanho: 10 },
  }));
  protected readonly itensDoHistorico = computed(() => (this.historico.hasValue() ? this.historico.value().itens : []));
  protected readonly totalDoHistorico = computed(() => (this.historico.hasValue() ? this.historico.value().total : 0));

  /** Botão "Sim, importar": recebe o foco ao abrir a confirmação (o botão que a abriu sai da tela). */
  private readonly botaoDeConfirmar = viewChild<ElementRef<HTMLButtonElement>>('confirmar');

  constructor() {
    effect(() => {
      if (this.confirmando()) queueMicrotask(() => this.botaoDeConfirmar()?.nativeElement.focus());
    });

    // Trocar o tipo invalida a simulação anterior (ela era de outra planilha).
    effect(() => {
      this.tipoEscolhido();
      untracked(() => this.limparResultado());
    });
  }

  protected escolherArquivo(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0] ?? null;
    this.limparResultado();
    this.erroDoArquivo.set('');
    if (!arquivo) {
      this.arquivo.set(null);
      return;
    }
    if (!arquivo.name.toLowerCase().endsWith('.xlsx')) {
      this.arquivo.set(null);
      this.erroDoArquivo.set('Escolha um arquivo .xlsx (planilha do Excel).');
      campo.value = '';
      return;
    }
    if (arquivo.size === 0) {
      this.arquivo.set(null);
      this.erroDoArquivo.set('O arquivo está vazio.');
      campo.value = '';
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_DA_PLANILHA) {
      this.arquivo.set(null);
      this.erroDoArquivo.set('O arquivo passa de 10 MB.');
      campo.value = '';
      return;
    }
    this.arquivo.set(arquivo);
  }

  protected async simular(): Promise<void> {
    const arquivo = this.arquivo();
    if (this.trabalhando()) return;
    if (!arquivo) {
      this.erroDoArquivo.set('Escolha a planilha antes de simular.');
      return;
    }
    this.limparResultado();
    this.trabalhando.set('simulando');
    try {
      const tipo = this.tipoEscolhido();
      this.relatorio.set(await this.api.enviar(tipo, arquivo, true));
      this.simulado.set({ arquivo, tipo });
    } catch (falha) {
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.trabalhando.set(null);
    }
  }

  protected async importar(): Promise<void> {
    const simulado = this.simulado();
    if (!this.podeImportar() || !simulado || this.trabalhando()) return;
    this.trabalhando.set('importando');
    this.erros.set([]);
    try {
      this.relatorio.set(await this.api.enviar(simulado.tipo, simulado.arquivo, false));
      this.simulado.set(null);
      this.confirmando.set(false);
      this.concluida.set(true);
      this.pagina.set(1);
      this.historico.reload();
    } catch (falha) {
      const erro = lerErro(falha);
      if (erro.status === 409) {
        // Planilha já importada (ex.: por outra pessoa ao mesmo tempo): reenviar só repetiria a recusa.
        this.limparResultado();
      } else {
        this.confirmando.set(false);
      }
      this.erros.set(erro.mensagens);
    } finally {
      this.trabalhando.set(null);
    }
  }

  private limparResultado(): void {
    this.relatorio.set(null);
    this.simulado.set(null);
    this.erros.set([]);
    this.confirmando.set(false);
    this.concluida.set(false);
  }
}
