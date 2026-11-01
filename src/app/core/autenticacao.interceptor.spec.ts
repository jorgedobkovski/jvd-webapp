import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { autenticacaoInterceptor } from './autenticacao.interceptor';
import { Sessao } from './sessao';
import { API_URL } from './api-url';
import { API, proximoTick, tokens } from './teste-apoio';

describe('autenticacaoInterceptor', () => {
  let cliente: HttpClient;
  let http: HttpTestingController;
  let sessao: Sessao;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([autenticacaoInterceptor])), provideHttpClientTesting(), provideRouter([]), { provide: API_URL, useValue: API }],
    });
    cliente = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(Sessao);
    router = TestBed.inject(Router);

    const entrada = sessao.entrar('a@b.com', 'Senha12345');
    http.expectOne(`${API}/auth/login`).flush(tokens('1'));
    await entrada;
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('envia o Bearer nas chamadas à API', () => {
    cliente.get(`${API}/clientes`).subscribe();
    const pedido = http.expectOne(`${API}/clientes`);
    expect(pedido.request.headers.get('Authorization')).toBe('Bearer acesso-1');
    pedido.flush([]);
  });

  it('não envia o token para outro domínio', () => {
    cliente.get('https://outro.example.com/x').subscribe();
    const pedido = http.expectOne('https://outro.example.com/x');
    expect(pedido.request.headers.has('Authorization')).toBe(false);
    pedido.flush({});
  });

  it('não envia o token para endereço que apenas COMEÇA igual ao da API', () => {
    for (const url of [`${API}-publico/x`, `${API}.evil.io/x`, `${API}evil`]) {
      cliente.get(url).subscribe({ error: () => undefined });
      const pedido = http.expectOne(url);
      expect(pedido.request.headers.has('Authorization')).toBe(false);
      pedido.flush({});
    }
  });

  it('login não leva token', () => {
    cliente.post(`${API}/auth/login`, {}).subscribe({ error: () => undefined });
    const pedido = http.expectOne(`${API}/auth/login`);
    expect(pedido.request.headers.has('Authorization')).toBe(false);
    pedido.flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  it('em 401 renova UMA vez e repete a chamada com o token novo', async () => {
    let resposta: unknown;
    cliente.get(`${API}/clientes`).subscribe((r) => (resposta = r));
    http.expectOne(`${API}/clientes`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await proximoTick();

    http.expectOne(`${API}/auth/refresh`).flush(tokens('2'));
    await proximoTick();

    const repetida = http.expectOne(`${API}/clientes`);
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer acesso-2');
    repetida.flush({ ok: true });
    expect(resposta).toEqual({ ok: true });
  });

  it('várias chamadas com 401 ao mesmo tempo geram UMA renovação', async () => {
    cliente.get(`${API}/a`).subscribe();
    cliente.get(`${API}/b`).subscribe();
    http.expectOne(`${API}/a`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API}/b`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await proximoTick();

    http.expectOne(`${API}/auth/refresh`).flush(tokens('2'));
    await proximoTick();

    http.expectOne(`${API}/a`).flush({});
    http.expectOne(`${API}/b`).flush({});
  });

  it('se a renovação falhar, limpa a sessão, leva à entrada e devolve o 401', async () => {
    vi.useFakeTimers();
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let status = 0;
    cliente.get(`${API}/clientes`).subscribe({ error: (e) => (status = e.status) });
    http.expectOne(`${API}/clientes`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await vi.advanceTimersByTimeAsync(0);

    http.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await vi.advanceTimersByTimeAsync(2000);

    expect(status).toBe(401);
    expect(sessao.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/entrar']);
  });

  it('401 do próprio logout não dispara renovação', async () => {
    cliente.post(`${API}/auth/logout`, {}).subscribe({ error: () => undefined });
    http.expectOne(`${API}/auth/logout`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await proximoTick();
    http.expectNone(`${API}/auth/refresh`);
  });

  it('logout com query string ou barra final também não dispara renovação', async () => {
    for (const rota of ['/auth/logout?origem=menu', '/auth/logout/']) {
      cliente.post(`${API}${rota}`, {}).subscribe({ error: () => undefined });
      http.expectOne(`${API}${rota}`).flush({}, { status: 401, statusText: 'Unauthorized' });
      await proximoTick();
    }
    http.expectNone(`${API}/auth/refresh`);
  });

  it('outros erros (403, 500) passam direto, sem renovar', async () => {
    let status = 0;
    cliente.get(`${API}/x`).subscribe({ error: (e) => (status = e.status) });
    http.expectOne(`${API}/x`).flush({}, { status: 403, statusText: 'Forbidden' });
    await proximoTick();

    expect(status).toBe(403);
    http.expectNone(`${API}/auth/refresh`);
  });
});
