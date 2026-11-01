import { TokenResponse, Usuario } from './modelos';

export const API = 'http://api.teste/api';

export function usuario(sobrescrever: Partial<Usuario> = {}): Usuario {
  return { id: 'u-1', nome: 'Técnico Teste', perfil: 'Tecnico', deveTrocarSenha: false, ...sobrescrever };
}

export function tokens(sufixo = '1', sobrescrever: Partial<Usuario> = {}): TokenResponse {
  return {
    accessToken: `acesso-${sufixo}`,
    accessTokenExpiraEm: '2030-01-01T00:00:00Z',
    refreshToken: `refresh-${sufixo}`,
    refreshTokenExpiraEm: '2030-01-08T00:00:00Z',
    usuario: usuario(sobrescrever),
  };
}

/** Deixa as promessas pendentes andarem (o HttpClient responde de forma assíncrona). */
export const proximoTick = () => new Promise<void>((resolver) => setTimeout(resolver, 0));
