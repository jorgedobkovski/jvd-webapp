import { HttpErrorResponse } from '@angular/common/http';
import { lerErro } from './erros';

describe('lerErro', () => {
  it('usa o detail e o código do ProblemDetails', () => {
    const erro = lerErro(new HttpErrorResponse({ status: 400, error: { codigo: 'usuario.senha_invalida', detail: 'Senha fraca.' } }));
    expect(erro).toMatchObject({ status: 400, codigo: 'usuario.senha_invalida', mensagem: 'Senha fraca.', mensagens: ['Senha fraca.'] });
  });

  it('junta todas as mensagens de erros[]', () => {
    const erro = lerErro(
      new HttpErrorResponse({
        status: 400,
        error: { detail: 'Primeira.', erros: [{ codigo: 'a', mensagem: 'Primeira.' }, { codigo: 'b', mensagem: 'Segunda.' }, { codigo: 'c' }, 7] },
      }),
    );
    expect(erro.mensagens).toEqual(['Primeira.', 'Segunda.']);
  });

  it('409 de conflito mantém o código', () => {
    expect(lerErro(new HttpErrorResponse({ status: 409, error: { codigo: 'conflito', detail: 'x' } })).codigo).toBe('conflito');
  });

  it('textos próprios para sem conexão, 403, 429 e 5xx (ignoram o corpo)', () => {
    expect(lerErro(new HttpErrorResponse({ status: 0 })).mensagem).toContain('Sem conexão');
    expect(lerErro(new HttpErrorResponse({ status: 403 })).mensagem).toContain('permissão');
    expect(lerErro(new HttpErrorResponse({ status: 429 })).mensagem).toContain('Muitas tentativas');
    expect(lerErro(new HttpErrorResponse({ status: 500, error: { detail: 'detalhe interno' } })).mensagem).not.toContain('detalhe interno');
  });

  it('corpo inesperado ou erro que não é HTTP cai na mensagem genérica', () => {
    expect(lerErro(new HttpErrorResponse({ status: 400, error: 'texto' })).mensagem).toBe('Não foi possível concluir a operação.');
    expect(lerErro(new Error('x')).mensagens).toEqual(['Não foi possível concluir a operação.']);
  });
});
