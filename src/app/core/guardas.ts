import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Perfil } from './modelos';
import { Sessao } from './sessao';

/** Só aceita caminho interno ("/x"), nunca endereço externo ("//x", "http:…"): evita redirecionamento aberto. */
export function retornoSeguro(retorno: string | null | undefined): string {
  return retorno && retorno.startsWith('/') && !retorno.startsWith('//') && !retorno.includes('\\') ? retorno : '/';
}

/** Área logada: exige sessão e, com senha provisória, leva direto à troca de senha (ADR-006). */
export const exigeSessao: CanActivateFn = (_rota, estado) => {
  const sessao = inject(Sessao);
  const router = inject(Router);
  const usuario = sessao.usuario();

  if (!usuario) return router.createUrlTree(['/entrar'], estado.url === '/' ? {} : { queryParams: { retorno: estado.url } });
  if (usuario.deveTrocarSenha) return router.createUrlTree(['/trocar-senha']);
  return true;
};

/** Qualquer usuário logado, mesmo com senha provisória (a tela de troca de senha). */
export const exigeUsuario: CanActivateFn = () => {
  const sessao = inject(Sessao);
  return sessao.autenticado() ? true : inject(Router).createUrlTree(['/entrar']);
};

/** Só para quem NÃO está logado (tela de entrada). */
export const soVisitante: CanActivateFn = () => {
  const sessao = inject(Sessao);
  const usuario = sessao.usuario();
  if (!usuario) return true;
  return inject(Router).createUrlTree([usuario.deveTrocarSenha ? '/trocar-senha' : '/']);
};

/** Restringe uma rota a certos perfis. A API continua sendo quem de fato barra (aqui é só experiência de uso). */
export function exigePerfil(...perfis: Perfil[]): CanActivateFn {
  return () => {
    const perfil = inject(Sessao).usuario()?.perfil;
    return perfil && perfis.includes(perfil) ? true : inject(Router).createUrlTree(['/']);
  };
}
