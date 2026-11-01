import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api-url';
import { TokenResponse, Usuario } from './modelos';

const CHAVE_REFRESH = 'jvd.refresh';
const CANAL = 'jvd.sessao';
const ESPERA_OUTRA_ABA_MS = 1500;

type Mensagem =
  | { tipo: 'sessao'; accessToken: string; refreshToken: string; usuario: Usuario }
  | { tipo: 'sair' };

function ehUsuario(valor: unknown): valor is Usuario {
  if (valor === null || typeof valor !== 'object') return false;
  const u = valor as Record<string, unknown>;
  return typeof u['id'] === 'string' && typeof u['nome'] === 'string' && (u['perfil'] === 'Tecnico' || u['perfil'] === 'Gestor') && typeof u['deveTrocarSenha'] === 'boolean';
}

/**
 * Sessão do usuário (ADR-003/004). O access token vive só em memória; o refresh token fica no `sessionStorage`
 * (some ao fechar o navegador). A renovação é em FILA ÚNICA: uma chamada por vez, as demais esperam o mesmo resultado.
 * Entre abas, o par novo é compartilhado por `BroadcastChannel`: o refresh é de uso único, e a aba "perdedora" de uma
 * disputa precisa reutilizar o token que a vencedora obteve (IA/JvdApi/HANDOFF.md).
 */
@Service()
export class Sessao {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = inject(API_URL);
  private readonly canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CANAL);

  private accessToken: string | null = null;
  private renovacao: Promise<boolean> | null = null;
  private readonly usuarioAtual = signal<Usuario | null>(null);

  readonly usuario = this.usuarioAtual.asReadonly();
  readonly autenticado = computed(() => this.usuarioAtual() !== null);
  readonly ehGestor = computed(() => this.usuarioAtual()?.perfil === 'Gestor');

  constructor() {
    if (this.canal) {
      this.canal.onmessage = (evento: MessageEvent<unknown>) => this.aoReceber(evento.data);
      inject(DestroyRef).onDestroy(() => this.canal?.close());
    }
  }

  tokenDeAcesso(): string | null {
    return this.accessToken;
  }

  /** Na abertura do app: se há refresh guardado, tenta reabrir a sessão. */
  async restaurar(): Promise<void> {
    if (this.lerRefresh()) await this.renovar();
  }

  async entrar(email: string, senha: string): Promise<Usuario> {
    const resposta = await firstValueFrom(this.http.post<TokenResponse>(`${this.apiUrl}/auth/login`, { email, senha }));
    this.aplicar(resposta);
    return resposta.usuario;
  }

  async trocarSenha(senhaAtual: string, novaSenha: string): Promise<Usuario> {
    const resposta = await firstValueFrom(
      this.http.post<TokenResponse>(`${this.apiUrl}/auth/trocar-senha`, { senhaAtual, novaSenha }),
    );
    this.aplicar(resposta);
    return resposta.usuario;
  }

  /** Revoga o refresh no servidor (falha de rede não impede sair) e limpa tudo aqui e nas outras abas. */
  async sair(): Promise<void> {
    const refresh = this.lerRefresh();
    this.limpar();
    this.canal?.postMessage({ tipo: 'sair' } satisfies Mensagem);
    if (refresh) {
      try {
        await firstValueFrom(this.http.post(`${this.apiUrl}/auth/logout`, { refreshToken: refresh }));
      } catch {
        // o servidor expira o refresh sozinho; sair localmente já está feito
      }
    }
  }

  /**
   * Renova o par de tokens, em fila única. `true` = há access token válido para repetir a chamada; `false` = não
   * deu (sessão inválida, e então a sessão local já foi limpa, ou servidor indisponível, e então foi mantida).
   */
  renovar(): Promise<boolean> {
    this.renovacao ??= this.executarRenovacao().finally(() => (this.renovacao = null));
    return this.renovacao;
  }

  private async executarRenovacao(): Promise<boolean> {
    const usado = this.lerRefresh();
    if (!usado) return false;

    try {
      const resposta = await firstValueFrom(this.http.post<TokenResponse>(`${this.apiUrl}/auth/refresh`, { refreshToken: usado }));
      this.aplicar(resposta);
      return true;
    } catch (erro) {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401) return false;

      // Pode ter perdido uma disputa com outra aba: dá um instante para o par novo chegar pelo canal.
      await new Promise((resolver) => setTimeout(resolver, ESPERA_OUTRA_ABA_MS));
      if (this.accessToken && this.lerRefresh() !== usado) return true;

      this.limpar();
      return false;
    }
  }

  private aplicar(resposta: TokenResponse): void {
    this.adotar(resposta.accessToken, resposta.refreshToken, resposta.usuario);
    this.canal?.postMessage({
      tipo: 'sessao',
      accessToken: resposta.accessToken,
      refreshToken: resposta.refreshToken,
      usuario: resposta.usuario,
    } satisfies Mensagem);
  }

  private adotar(accessToken: string, refreshToken: string, usuario: Usuario): void {
    this.accessToken = accessToken;
    this.usuarioAtual.set(usuario);
    this.gravarRefresh(refreshToken);
  }

  private limpar(): void {
    this.accessToken = null;
    this.usuarioAtual.set(null);
    this.gravarRefresh(null);
  }

  private aoReceber(dado: unknown): void {
    if (!dado || typeof dado !== 'object') return;
    const mensagem = dado as Partial<Mensagem>;

    if (mensagem.tipo === 'sair') {
      this.limpar();
      void this.router.navigate(['/entrar']);
    } else if (mensagem.tipo === 'sessao' && typeof mensagem.accessToken === 'string' && typeof mensagem.refreshToken === 'string' && ehUsuario(mensagem.usuario)) {
      this.adotar(mensagem.accessToken, mensagem.refreshToken, mensagem.usuario);
    }
  }

  private lerRefresh(): string | null {
    try {
      return sessionStorage.getItem(CHAVE_REFRESH);
    } catch {
      return null;
    }
  }

  private gravarRefresh(valor: string | null): void {
    try {
      if (valor === null) sessionStorage.removeItem(CHAVE_REFRESH);
      else sessionStorage.setItem(CHAVE_REFRESH, valor);
    } catch {
      // armazenamento bloqueado: a sessão vale só enquanto a aba estiver aberta
    }
  }
}
