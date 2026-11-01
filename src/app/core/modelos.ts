export type Perfil = 'Tecnico' | 'Gestor';

export interface Usuario {
  id: string;
  nome: string;
  perfil: Perfil;
  deveTrocarSenha: boolean;
}

/** Resposta de login, renovação e troca de senha (IA/JvdApi/API_REFERENCE.md). */
export interface TokenResponse {
  accessToken: string;
  accessTokenExpiraEm: string;
  refreshToken: string;
  refreshTokenExpiraEm: string;
  usuario: Usuario;
}
