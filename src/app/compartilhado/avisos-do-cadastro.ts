import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Aviso } from './modelos';

/**
 * Avisos de duplicidade repassados pelo `state` da navegação (formulário → tela seguinte). O `history.state` é dado de
 * fora do código: só aceita o formato esperado e descarta o resto.
 */
export function avisosRecebidos(): Aviso[] {
  const estado: unknown = history.state;
  const bruto = estado !== null && typeof estado === 'object' ? (estado as Record<string, unknown>)['avisos'] : undefined;
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (a): a is Aviso =>
      a !== null && typeof a === 'object' && typeof (a as Aviso).codigo === 'string' && typeof (a as Aviso).mensagem === 'string' && Array.isArray((a as Aviso).ids),
  );
}

/**
 * Avisos que não bloqueiam o salvamento (CPF/CNPJ, série ou INMETRO repetidos). Cada aviso traz os ids dos OUTROS
 * cadastros (nunca dados pessoais); `rotaBase` monta o link para cada um.
 */
@Component({
  selector: 'jvd-avisos-do-cadastro',
  imports: [RouterLink],
  template: `
    @for (aviso of avisos(); track aviso.codigo) {
      <div class="aviso mt-3" role="status">
        <p class="font-medium">{{ aviso.mensagem }}</p>
        @if (aviso.ids.length > 0) {
          <ul class="mt-1 list-inside list-disc">
            @for (id of aviso.ids; track id; let i = $index) {
              <li><a class="underline" [routerLink]="[rotaBase(), id]">Ver cadastro {{ i + 1 }}</a></li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class AvisosDoCadastro {
  readonly avisos = input.required<Aviso[]>();
  /** Início da rota de consulta de cada id (ex.: `/clientes`). */
  readonly rotaBase = input.required<string>();
}
