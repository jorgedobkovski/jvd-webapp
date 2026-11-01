import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_URL } from './api-url';
import { Sessao } from './sessao';

/** Rotas que não levam o token (anônimas) e, junto com o logout, nunca disparam renovação. */
const ANONIMAS = ['/auth/login', '/auth/refresh'];
const SEM_RENOVACAO = [...ANONIMAS, '/auth/logout'];

/**
 * Põe o Bearer nas chamadas à API. Em 401 renova o token UMA vez (fila única na `Sessao`) e repete a chamada; se a
 * sessão não puder ser renovada, leva à tela de entrada. O token só vai para a nossa API.
 */
export const autenticacaoInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(API_URL);
  // Com barra no fim: `/api-x` ou `https://api.com.evil.io` não podem passar por "começar igual".
  if (req.url !== apiUrl && !req.url.startsWith(`${apiUrl}/`)) return next(req);

  const sessao = inject(Sessao);
  const router = inject(Router);
  const rota = req.url.slice(apiUrl.length).split(/[?#]/)[0].replace(/\/+$/, '');
  if (ANONIMAS.includes(rota)) return next(req);

  const comToken = (original: HttpRequest<unknown>) => {
    const token = sessao.tokenDeAcesso();
    return token ? original.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : original;
  };

  return next(comToken(req)).pipe(
    catchError((erro: unknown) => {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401 || SEM_RENOVACAO.includes(rota)) return throwError(() => erro);

      return from(sessao.renovar()).pipe(
        switchMap((renovada) => {
          if (renovada) return next(comToken(req));
          if (!sessao.autenticado()) void router.navigate(['/entrar']);
          return throwError(() => erro);
        }),
      );
    }),
  );
};
