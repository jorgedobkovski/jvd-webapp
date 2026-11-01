/** Página de resultados de qualquer listagem da API (`{ itens, pagina, tamanho, total }`). */
export interface Pagina<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  total: number;
}

/** Aviso que não bloqueia o salvamento (ex.: `cliente.documento_repetido`). `ids` são de OUTROS cadastros. */
export interface Aviso {
  codigo: string;
  mensagem: string;
  ids: string[];
}

export const TAMANHO_PADRAO = 20;
