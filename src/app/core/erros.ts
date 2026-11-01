import { HttpErrorResponse } from '@angular/common/http';

export interface ErroDaApi {
  status: number;
  /** Código estável do ProblemDetails (ex.: `usuario.senha_atual_incorreta`), quando existe. */
  codigo?: string;
  mensagem: string;
}

/**
 * Converte o erro do HttpClient numa mensagem para a tela. A API devolve mensagens fixas, sem eco de valores
 * (IA/JvdApi/API_REFERENCE.md); sem resposta utilizável, cai numa mensagem genérica por faixa de status.
 */
export function lerErro(erro: unknown): ErroDaApi {
  if (!(erro instanceof HttpErrorResponse)) return { status: 0, mensagem: 'Não foi possível concluir a operação.' };

  const corpo: unknown = erro.error;
  const registro = corpo !== null && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
  const codigo = typeof registro['codigo'] === 'string' ? registro['codigo'] : undefined;
  const detalhe = typeof registro['detail'] === 'string' && registro['detail'] ? registro['detail'] : undefined;

  if (erro.status === 0) return { status: 0, codigo, mensagem: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' };
  if (erro.status === 429) return { status: 429, codigo, mensagem: 'Muitas tentativas. Aguarde um minuto e tente de novo.' };
  if (erro.status >= 500) return { status: erro.status, codigo, mensagem: 'O servidor encontrou um problema. Tente de novo em instantes.' };
  return { status: erro.status, codigo, mensagem: detalhe ?? 'Não foi possível concluir a operação.' };
}
