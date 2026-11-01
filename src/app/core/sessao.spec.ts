import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Sessao } from './sessao';
import { API_URL } from './api-url';
import { API, proximoTick, tokens } from './teste-apoio';

describe('Sessao', () => {
  let sessao: Sessao;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }] });
    sessao = TestBed.inject(Sessao);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('entrar guarda o usuário e o token em memória, e o refresh no sessionStorage', async () => {
    const promessa = sessao.entrar('a@b.com', 'Senha12345');
    const pedido = http.expectOne(`${API}/auth/login`);
    expect(pedido.request.body).toEqual({ email: 'a@b.com', senha: 'Senha12345' });
    pedido.flush(tokens());
    await promessa;

    expect(sessao.autenticado()).toBe(true);
    expect(sessao.usuario()?.nome).toBe('Técnico Teste');
    expect(sessao.tokenDeAcesso()).toBe('acesso-1');
    expect(sessionStorage.getItem('jvd.refresh')).toBe('refresh-1');
    expect(localStorage.getItem('jvd.refresh')).toBeNull();
  });

  it('login recusado não deixa sessão', async () => {
    const promessa = sessao.entrar('a@b.com', 'errada');
    http.expectOne(`${API}/auth/login`).flush({ title: 'x' }, { status: 401, statusText: 'Unauthorized' });
    await expect(promessa).rejects.toBeTruthy();

    expect(sessao.autenticado()).toBe(false);
    expect(sessao.tokenDeAcesso()).toBeNull();
  });

  it('renovar usa fila única: várias chamadas simultâneas geram UM pedido', async () => {
    sessionStorage.setItem('jvd.refresh', 'refresh-0');

    const [a, b, c] = [sessao.renovar(), sessao.renovar(), sessao.renovar()];
    const pedido = http.expectOne(`${API}/auth/refresh`);
    expect(pedido.request.body).toEqual({ refreshToken: 'refresh-0' });
    pedido.flush(tokens('2'));

    expect(await Promise.all([a, b, c])).toEqual([true, true, true]);
    expect(sessao.tokenDeAcesso()).toBe('acesso-2');
    expect(sessionStorage.getItem('jvd.refresh')).toBe('refresh-2');
  });

  it('renovar sem refresh guardado não chama a API', async () => {
    expect(await sessao.renovar()).toBe(false);
    http.expectNone(`${API}/auth/refresh`);
  });

  it('refresh recusado (401) limpa a sessão depois de dar tempo a outra aba', async () => {
    vi.useFakeTimers();
    sessionStorage.setItem('jvd.refresh', 'refresh-0');

    const promessa = sessao.renovar();
    http.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promessa).toBe(false);
    expect(sessao.autenticado()).toBe(false);
    expect(sessionStorage.getItem('jvd.refresh')).toBeNull();
  });

  it('refresh com servidor fora do ar mantém a sessão para tentar de novo', async () => {
    sessionStorage.setItem('jvd.refresh', 'refresh-0');

    const promessa = sessao.renovar();
    http.expectOne(`${API}/auth/refresh`).flush({}, { status: 503, statusText: 'Service Unavailable' });

    expect(await promessa).toBe(false);
    expect(sessionStorage.getItem('jvd.refresh')).toBe('refresh-0');
  });

  it('sair limpa tudo e avisa o servidor com o refresh', async () => {
    const entrada = sessao.entrar('a@b.com', 'Senha12345');
    http.expectOne(`${API}/auth/login`).flush(tokens());
    await entrada;

    const saida = sessao.sair();
    expect(sessao.autenticado()).toBe(false);
    expect(sessionStorage.getItem('jvd.refresh')).toBeNull();
    const pedido = http.expectOne(`${API}/auth/logout`);
    expect(pedido.request.body).toEqual({ refreshToken: 'refresh-1' });
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    await saida;
  });

  it('sair funciona mesmo se o servidor falhar', async () => {
    sessionStorage.setItem('jvd.refresh', 'refresh-0');

    const saida = sessao.sair();
    http.expectOne(`${API}/auth/logout`).flush({}, { status: 500, statusText: 'Server Error' });
    await expect(saida).resolves.toBeUndefined();
    expect(sessionStorage.getItem('jvd.refresh')).toBeNull();
  });

  it('trocarSenha adota os tokens novos e limpa a obrigação de troca', async () => {
    const promessa = sessao.trocarSenha('Atual12345', 'Nova123456');
    const pedido = http.expectOne(`${API}/auth/trocar-senha`);
    expect(pedido.request.body).toEqual({ senhaAtual: 'Atual12345', novaSenha: 'Nova123456' });
    pedido.flush(tokens('9', { deveTrocarSenha: false }));
    await promessa;

    expect(sessao.usuario()?.deveTrocarSenha).toBe(false);
    expect(sessao.tokenDeAcesso()).toBe('acesso-9');
  });

  it('adota o par de tokens enviado por outra aba e sai quando outra aba sai', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const outraAba = new BroadcastChannel('jvd.sessao');

    outraAba.postMessage({ tipo: 'sessao', accessToken: 'acesso-7', refreshToken: 'refresh-7', usuario: tokens('7').usuario });
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(sessao.tokenDeAcesso()).toBe('acesso-7');
    expect(sessionStorage.getItem('jvd.refresh')).toBe('refresh-7');

    outraAba.postMessage({ tipo: 'sair' });
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(sessao.autenticado()).toBe(false);
    expect(sessionStorage.getItem('jvd.refresh')).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/entrar']);
    outraAba.close();
  });

  it('renovação perdida para outra aba: o par novo chega pelo canal durante a espera e a chamada tem sucesso', async () => {
    vi.useFakeTimers();
    sessionStorage.setItem('jvd.refresh', 'refresh-0');
    const outraAba = new BroadcastChannel('jvd.sessao');

    const promessa = sessao.renovar();
    http.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await vi.advanceTimersByTimeAsync(0);
    outraAba.postMessage({ tipo: 'sessao', accessToken: 'acesso-8', refreshToken: 'refresh-8', usuario: tokens('8').usuario });
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promessa).toBe(true);
    expect(sessao.tokenDeAcesso()).toBe('acesso-8');
    expect(sessionStorage.getItem('jvd.refresh')).toBe('refresh-8');
    outraAba.close();
  });

  it('ignora mensagens malformadas do canal', async () => {
    const outraAba = new BroadcastChannel('jvd.sessao');
    outraAba.postMessage('lixo');
    outraAba.postMessage({ tipo: 'sessao', accessToken: 5 });
    outraAba.postMessage({ tipo: 'sessao', accessToken: 'a', refreshToken: 'r', usuario: true });
    outraAba.postMessage({ tipo: 'sessao', accessToken: 'a', refreshToken: 'r', usuario: { id: 'x', nome: 'n', perfil: 'Invalido', deveTrocarSenha: false } });
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(sessao.autenticado()).toBe(false);
    expect(sessionStorage.getItem('jvd.refresh')).toBeNull();
    outraAba.close();
  });

  it('restaurar reabre a sessão quando há refresh guardado', async () => {
    sessionStorage.setItem('jvd.refresh', 'refresh-0');

    const promessa = sessao.restaurar();
    await proximoTick();
    http.expectOne(`${API}/auth/refresh`).flush(tokens('3', { perfil: 'Gestor' }));
    await promessa;

    expect(sessao.ehGestor()).toBe(true);
  });
});
