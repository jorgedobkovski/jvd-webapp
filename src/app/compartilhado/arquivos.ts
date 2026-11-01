/** Entrega um arquivo recebido em memória (ex.: PDF que exige token) como download, sem deixar o link para trás. */
export function salvarArquivo(conteudo: Blob, nome: string): void {
  const endereco = URL.createObjectURL(conteudo);
  const ancora = document.createElement('a');
  ancora.href = endereco;
  ancora.download = nome;
  ancora.rel = 'noopener';
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 10_000);
}
