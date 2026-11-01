/** Só os dígitos de um texto. */
export function soDigitos(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\D/g, '');
}

/** Exibe CPF (11 dígitos) ou CNPJ (14) com máscara; qualquer outro tamanho volta como veio. */
export function formatarDocumento(documento: string | null | undefined): string {
  const d = soDigitos(documento);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return documento ?? '';
}

/** Exibe CEP com hífen quando tem 8 dígitos. */
export function formatarCep(cep: string | null | undefined): string {
  const d = soDigitos(cep);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (cep ?? '');
}

/** "Rua, 10 — Centro — Porto Velho/RO — CEP 76800-000", pulando o que não foi informado. */
export function formatarEndereco(c: {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}): string {
  const rua = [c.logradouro, c.numero].filter((p) => !!p?.trim()).join(', ');
  const cidade = [c.cidade, c.uf].filter((p) => !!p?.trim()).join('/');
  const cep = c.cep?.trim() ? `CEP ${formatarCep(c.cep)}` : '';
  return [rua, c.bairro?.trim() ?? '', cidade, cep].filter((p) => p.length > 0).join(' — ');
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ',
  'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;
