import { HttpErrorResponse } from '@angular/common/http';

export interface ErroDaApi {
  status: number;
  /** Código estável do ProblemDetails (ex.: `usuario.senha_atual_incorreta`, `conflito`), quando existe. */
  codigo?: string;
  mensagem: string;
  /** Todas as mensagens de validação devolvidas (a primeira é `mensagem`). Textos fixos da API, sem eco de valores. */
  mensagens: string[];
}

/**
 * Converte o erro do HttpClient numa mensagem para a tela. A API devolve mensagens fixas, sem eco de valores
 * (IA/JvdApi/API_REFERENCE.md); sem resposta utilizável, cai numa mensagem genérica por faixa de status.
 */
export function lerErro(erro: unknown): ErroDaApi {
  if (!(erro instanceof HttpErrorResponse)) return montar(0, undefined, 'Não foi possível concluir a operação.', []);

  const corpo: unknown = erro.error;
  const registro = corpo !== null && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
  const codigo = typeof registro['codigo'] === 'string' ? registro['codigo'] : undefined;
  const detalhe = typeof registro['detail'] === 'string' && registro['detail'] ? registro['detail'] : undefined;
  const lista = Array.isArray(registro['erros'])
    ? (registro['erros'] as unknown[])
        .map((e) => (e !== null && typeof e === 'object' ? (e as Record<string, unknown>)['mensagem'] : undefined))
        .filter((m): m is string => typeof m === 'string' && m.length > 0)
    : [];

  if (erro.status === 0) return montar(0, codigo, 'Sem conexão com o servidor. Verifique a internet e tente de novo.', []);
  if (erro.status === 429) return montar(429, codigo, 'Muitas tentativas. Aguarde um minuto e tente de novo.', []);
  if (erro.status === 403) return montar(403, codigo, detalhe ?? 'Você não tem permissão para esta operação.', []);
  if (erro.status >= 500) return montar(erro.status, codigo, 'O servidor encontrou um problema. Tente de novo em instantes.', []);
  return montar(erro.status, codigo, detalhe ?? 'Não foi possível concluir a operação.', lista);
}

function montar(status: number, codigo: string | undefined, mensagem: string, lista: string[]): ErroDaApi {
  return { status, codigo, mensagem, mensagens: lista.length > 0 ? lista : [mensagem] };
}
