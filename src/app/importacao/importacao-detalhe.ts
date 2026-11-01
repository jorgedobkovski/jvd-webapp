import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatarDataHora } from '../compartilhado/datas';
import { lerErro } from '../core/erros';
import { ImportacaoApi, ImportacaoDetalhe } from './importacao-api';
import { ResultadoDaImportacao } from './resultado-da-importacao';

/** Uma importação do histórico: resumo e todas as ocorrências (textos fixos, nunca o conteúdo da planilha). */
@Component({
  selector: 'jvd-importacao-detalhe',
  imports: [RouterLink, ResultadoDaImportacao],
  template: `
    <p class="mb-3"><a routerLink="/importacao" class="underline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">← Importação</a></p>

    @if (carregando()) {
      <p class="text-slate-700 dark:text-slate-200">Carregando…</p>
    } @else if (detalhe(); as d) {
      <h1 class="text-2xl font-semibold">Importação de {{ d.importacao.tipo.toLowerCase() === 'clientes' ? 'clientes' : 'serviços' }}</h1>
      <p class="mt-1 text-slate-700 dark:text-slate-200">{{ dataHora(d.importacao.executadaEm) }} · {{ d.importacao.nomeArquivo }}</p>
      <div class="mt-4">
        <jvd-resultado-da-importacao [totais]="d.importacao" [ocorrencias]="d.ocorrencias" />
      </div>
    } @else {
      <div class="alerta-erro" role="alert">
        <ul class="list-inside list-disc">
          @for (mensagem of erros(); track $index) {
            <li>{{ mensagem }}</li>
          }
        </ul>
        @if (!naoEncontrada()) {
          <button type="button" class="botao-secundario mt-2" (click)="carregar()">Tentar de novo</button>
        }
      </div>
    }
  `,
})
export class ImportacaoDetalheTela {
  private readonly api = inject(ImportacaoApi);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly dataHora = formatarDataHora;
  protected readonly detalhe = signal<ImportacaoDetalhe | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erros = signal<string[]>([]);
  protected readonly naoEncontrada = signal(false);

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    try {
      this.detalhe.set(await this.api.obter(this.id));
      this.naoEncontrada.set(false);
    } catch (falha) {
      const erro = lerErro(falha);
      this.naoEncontrada.set(erro.status === 404);
      this.erros.set(erro.status === 404 ? ['Importação não encontrada.'] : erro.mensagens);
    } finally {
      this.carregando.set(false);
    }
  }
}
