import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Tema } from './core/tema';

@Component({
  imports: [RouterOutlet],
  selector: 'jvd-root',
  template: '<router-outlet />',
})
export class App {
  /** Só instanciar já aplica o tema (escolha salva ou do sistema) e passa a acompanhar o sistema. */
  private readonly tema = inject(Tema);
}
