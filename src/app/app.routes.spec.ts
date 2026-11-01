import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

@Component({ template: 'editar' })
class Editar {}

describe('rotas', () => {
  it('/equipamentos/:id redireciona para /equipamentos/:id/editar mantendo o id (links dos avisos de duplicidade)', async () => {
    // Só o redirecionamento da rota real; o destino é um componente de teste.
    const redirecionamento = routes.flatMap((r) => r.children ?? []).find((r) => r.path === 'equipamentos/:id');
    expect(redirecionamento?.redirectTo).toBeDefined();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'equipamentos/:id', redirectTo: redirecionamento!.redirectTo as string },
          { path: 'equipamentos/:id/editar', component: Editar },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/equipamentos/abc-123');

    expect(TestBed.inject(Router).url).toBe('/equipamentos/abc-123/editar');
  });
});
