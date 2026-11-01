import { Component, inject, input, model, output, signal } from '@angular/core';
import { ClientesApi } from '../cadastros/clientes/clientes-api';
import { lerErro } from '../core/erros';
import { formatarDocumento } from './formatadores';

export interface ClienteEscolhido {
  id: string;
  nome: string;
}

interface Opcao {
  id: string;
  nome: string;
  documento: string | null;
  cidade: string | null;
}

/** Escolha de cliente por busca entre os ATIVOS (lista curta de botões; sem combobox). */
@Component({
  selector: 'jvd-seletor-de-cliente',
  template: `
    <fieldset>
      <legend class="rotulo">{{ rotulo() }}</legend>
      @if (cliente(); as escolhido) {
        @if (!trocando()) {
          <p class="mt-1 flex flex-wrap items-center gap-3">
            <span class="font-semibold">{{ escolhido.nome }}</span>
            <button type="button" class="botao-secundario" (click)="trocando.set(true)">Trocar cliente</button>
          </p>
        }
      }
      @if (trocando() || !cliente()) {
        <div class="mt-1 flex gap-2">
          <input
            #campo
            type="search"
            class="campo !mt-0"
            placeholder="Nome, fantasia, cidade ou CPF/CNPJ"
            aria-label="Buscar cliente"
            autocomplete="off"
            [value]="busca()"
            (input)="busca.set(campo.value)"
            (keydown.enter)="$event.preventDefault(); procurar()"
          />
          <button type="button" class="botao-secundario" [disabled]="buscando()" (click)="procurar()">Buscar</button>
        </div>
        @if (cliente()) {
          <p class="mt-2"><button type="button" class="botao-secundario" (click)="cancelar()">Cancelar e manter {{ cliente()!.nome }}</button></p>
        }
        <div aria-live="polite">
          @if (buscou() && opcoes().length === 0) {
            <p class="mt-2 text-sm text-slate-700 dark:text-slate-200">Nenhum cliente ativo encontrado.</p>
          }
          @if (opcoes().length > 0) {
            <ul class="mt-2 grid gap-2">
              @for (o of opcoes(); track o.id) {
                <li>
                  <button type="button" class="botao-secundario w-full !justify-start text-left" (click)="escolher(o)">
                    <span>
                      <span class="block font-semibold">{{ o.nome }}</span>
                      <span class="block text-sm font-normal">{{ o.documento ? documento(o.documento) : 'Sem CPF/CNPJ' }}{{ o.cidade ? ' · ' + o.cidade : '' }}</span>
                    </span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      }
      @if (erro()) {
        <p class="campo-erro" role="alert">{{ erro() }}</p>
      }
    </fieldset>
  `,
})
export class SeletorDeCliente {
  private readonly api = inject(ClientesApi);

  readonly cliente = model<ClienteEscolhido | null>(null);
  readonly rotulo = input('Cliente *');
  /** Avisa que a pessoa escolheu um cliente (diferente de apenas receber um valor de fora). */
  readonly escolhido = output<ClienteEscolhido>();

  protected readonly documento = formatarDocumento;
  protected readonly trocando = signal(false);
  protected readonly busca = signal('');
  protected readonly opcoes = signal<Opcao[]>([]);
  protected readonly buscou = signal(false);
  protected readonly buscando = signal(false);
  protected readonly erro = signal('');

  protected async procurar(): Promise<void> {
    this.buscando.set(true);
    this.erro.set('');
    this.buscou.set(false);
    try {
      const pagina = await this.api.listar({ busca: this.busca(), ativo: true, tamanho: 8 });
      this.opcoes.set(pagina.itens.map((c) => ({ id: c.id, nome: c.nomeRazaoSocial, documento: c.documento, cidade: c.cidade })));
      this.buscou.set(true);
    } catch (falha) {
      this.erro.set(lerErro(falha).mensagem);
    } finally {
      this.buscando.set(false);
    }
  }

  protected escolher(o: Opcao): void {
    const escolhido = { id: o.id, nome: o.nome };
    this.cliente.set(escolhido);
    this.escolhido.emit(escolhido);
    this.cancelar();
  }

  protected cancelar(): void {
    this.trocando.set(false);
    this.opcoes.set([]);
    this.buscou.set(false);
    this.busca.set('');
  }
}
