import { Component, inject, output, signal } from '@angular/core';
import { form, submit } from '@angular/forms/signals';
import { Janela } from '../../compartilhado/janela';
import { lerErro } from '../../core/erros';
import { CamposDoCliente, CLIENTE_VAZIO, regrasDoCliente } from './campos-do-cliente';
import { ClienteSalvo, ClientesApi, DadosDoCliente } from './clientes-api';

/** Cadastro de cliente numa janela, sem sair da página de quem chamou (ex.: o relatório). Mesmas regras da tela de clientes. */
@Component({
  selector: 'jvd-cliente-em-janela',
  imports: [Janela, CamposDoCliente],
  template: `
    <jvd-janela titulo="Novo cliente" (fechar)="fechar.emit()">
      <form class="grid gap-4 sm:grid-cols-2" novalidate (submit)="$event.preventDefault(); salvar()">
        <jvd-campos-do-cliente [campos]="formulario" prefixo="novo-cliente-" />

        <div class="sm:col-span-2" role="alert">
          @if (erros().length > 0) {
            <div class="alerta-erro">
              <ul class="list-inside list-disc">
                @for (mensagem of erros(); track $index) {
                  <li>{{ mensagem }}</li>
                }
              </ul>
            </div>
          }
        </div>

        <div class="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" class="botao-primario" [disabled]="enviando()">{{ enviando() ? 'Salvando…' : 'Salvar cliente' }}</button>
          <button type="button" class="botao-secundario" (click)="fechar.emit()">Cancelar</button>
        </div>
      </form>
    </jvd-janela>
  `,
})
export class ClienteEmJanela {
  private readonly api = inject(ClientesApi);

  /** O cliente foi salvo (com os avisos de duplicidade, se houver). */
  readonly criado = output<ClienteSalvo>();
  readonly fechar = output<void>();

  protected readonly modelo = signal<DadosDoCliente>({ ...CLIENTE_VAZIO });
  protected readonly formulario = form(this.modelo, regrasDoCliente);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);

  protected salvar(): void {
    if (this.enviando()) return; // Enter repetido durante o envio não pode criar cliente duplicado
    this.erros.set([]);
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        this.criado.emit(await this.api.criar(this.modelo()));
      } catch (falha) {
        this.erros.set(lerErro(falha).mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }
}
