import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { autenticacaoInterceptor } from './core/autenticacao.interceptor';
import { Sessao } from './core/sessao';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([autenticacaoInterceptor])),
    // Reabre a sessão (refresh guardado na aba) antes de a primeira rota decidir para onde ir.
    provideAppInitializer(() => inject(Sessao).restaurar()),
  ],
};
