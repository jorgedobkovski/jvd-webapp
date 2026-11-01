import { Component, inject, input, output, signal } from '@angular/core';
import { form, submit } from '@angular/forms/signals';
import { Janela } from '../../compartilhado/janela';
import { lerErro } from '../../core/erros';
import { CamposDeEquipamento, CamposDoEquipamento, EQUIPAMENTO_VAZIO, regrasDoEquipamento } from './campos-do-equipamento';
import { EquipamentoSalvo, EquipamentosApi } from './equipamentos-api';

/** Cadastro de equipamento (balança) de um cliente já escolhido, numa janela, sem sair da página de quem chamou. */
@Component({
  selector: 'jvd-equipamento-em-janela',
  imports: [Janela, CamposDoEquipamento],
  template: `
    <jvd-janela titulo="Novo equipamento" (fechar)="fechar.emit()">
      <p class="mb-3 text-sm">Cliente: <strong>{{ clienteNome() }}</strong></p>
      <form class="grid gap-4" novalidate (submit)="$event.preventDefault(); salvar()">
        <jvd-campos-do-equipamento [campos]="formulario" prefixo="novo-equipamento-" />

        <div role="alert">
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

        <div class="flex flex-wrap gap-2">
          <button type="submit" class="botao-primario" [disabled]="enviando()">{{ enviando() ? 'Salvando…' : 'Salvar equipamento' }}</button>
          <button type="button" class="botao-secundario" (click)="fechar.emit()">Cancelar</button>
        </div>
      </form>
    </jvd-janela>
  `,
})
export class EquipamentoEmJanela {
  private readonly api = inject(EquipamentosApi);

  readonly clienteId = input.required<string>();
  readonly clienteNome = input.required<string>();
  /** O equipamento foi salvo (com os avisos de duplicidade, se houver). */
  readonly criado = output<EquipamentoSalvo>();
  readonly fechar = output<void>();

  protected readonly modelo = signal<CamposDeEquipamento>({ ...EQUIPAMENTO_VAZIO });
  protected readonly formulario = form(this.modelo, regrasDoEquipamento);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);

  protected salvar(): void {
    if (this.enviando()) return;
    this.erros.set([]);
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        this.criado.emit(await this.api.criar({ clienteId: this.clienteId(), ...this.modelo() }));
      } catch (falha) {
        this.erros.set(lerErro(falha).mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }
}
