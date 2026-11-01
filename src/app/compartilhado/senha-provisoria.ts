const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS;

/** Inteiro uniforme em [0, limite) pelo gerador criptográfico do navegador (sem viés de módulo). */
function sorteio(limite: number): number {
  const faixa = Math.floor(0x100000000 / limite) * limite;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= faixa);
  return buffer[0] % limite;
}

function escolher(alfabeto: string): string {
  return alfabeto[sorteio(alfabeto.length)];
}

/**
 * Senha provisória aleatória que cumpre a política da API (10+ caracteres, maiúscula, minúscula e número). Sem
 * caracteres ambíguos (0/O, 1/l/I) para ser ditada ou copiada sem erro. Nunca é guardada: aparece uma vez na tela.
 */
export function gerarSenhaProvisoria(tamanho = 12): string {
  const comprimento = Math.max(10, tamanho);
  const caracteres = [escolher(MAIUSCULAS), escolher(MINUSCULAS), escolher(DIGITOS)];
  while (caracteres.length < comprimento) caracteres.push(escolher(TODOS));

  // Embaralha (Fisher-Yates) para a posição dos três obrigatórios não ser previsível.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = sorteio(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
