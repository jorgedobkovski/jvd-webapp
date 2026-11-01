import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../core/api-url';
import { API, proximoTick } from '../core/teste-apoio';
import { ImportacaoDetalheTela } from './importacao-detalhe';

describe('ImportacaoDetalheTela', () => {
  let http: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({
      imports: [ImportacaoDetalheTela],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: API },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'imp-1' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ImportacaoDetalheTela);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const depois = async (fixture: ReturnType<typeof montar>['fixture']) => {
    await proximoTick();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('mostra o resumo e as ocorrências de uma importação do histórico', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/importacoes/imp-1`).flush({
      importacao: { id: 'imp-1', tipo: 'Servicos', nomeArquivo: 'mercadorias.xlsx', usuarioId: 'u', executadaEm: '2026-11-01T12:00:00Z', totalLidos: 30, totalImportados: 7, totalRejeitados: 1, totalAvisos: 2, totalIgnoradas: 20 },
      ocorrencias: [{ linha: 12, gravidade: 'Erro', motivo: 'Código de serviço já cadastrado.' }],
    });
    await depois(fixture);

    expect(el.querySelector('h1')!.textContent).toContain('Importação de serviços');
    expect(el.textContent).toContain('mercadorias.xlsx');
    expect(el.textContent).toContain('Importadas');
    expect(el.textContent).not.toContain('Seriam importadas');
    expect(el.textContent).toContain('Código de serviço já cadastrado.');
  });

  it('o tipo é reconhecido sem depender de maiúsculas e minúsculas', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/importacoes/imp-1`).flush({
      importacao: { id: 'imp-1', tipo: 'clientes', nomeArquivo: 'c.xlsx', usuarioId: 'u', executadaEm: '2026-11-01T12:00:00Z', totalLidos: 1, totalImportados: 1, totalRejeitados: 0, totalAvisos: 0, totalIgnoradas: 0 },
      ocorrencias: [],
    });
    await depois(fixture);

    expect(el.querySelector('h1')!.textContent).toContain('Importação de clientes');
  });

  it('importação inexistente mostra "não encontrada", sem tentar de novo', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/importacoes/imp-1`).flush({}, { status: 404, statusText: 'Not Found' });
    await depois(fixture);

    expect(el.textContent).toContain('Importação não encontrada.');
    expect(el.textContent).not.toContain('Tentar de novo');
  });

  it('falha ao carregar permite tentar de novo', async () => {
    const { fixture, el } = montar();
    http.expectOne(`${API}/importacoes/imp-1`).flush({}, { status: 500, statusText: 'Server Error' });
    await depois(fixture);
    expect(el.textContent).toContain('O servidor encontrou um problema');

    el.querySelector<HTMLButtonElement>('.alerta-erro button')!.click();
    http.expectOne(`${API}/importacoes/imp-1`).flush({
      importacao: { id: 'imp-1', tipo: 'Clientes', nomeArquivo: 'c.xlsx', usuarioId: 'u', executadaEm: '2026-11-01T12:00:00Z', totalLidos: 1, totalImportados: 1, totalRejeitados: 0, totalAvisos: 0, totalIgnoradas: 0 },
      ocorrencias: [],
    });
    await depois(fixture);
    expect(el.querySelector('h1')!.textContent).toContain('Importação de clientes');
    expect(el.textContent).toContain('Nenhuma ocorrência a revisar.');
  });
});
