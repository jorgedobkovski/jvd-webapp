/** Data de hoje no fuso do aparelho, como `aaaa-mm-dd` (o formato de `<input type="date">` e da API). */
export function hoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Instante ISO (UTC) → "dd/mm/aaaa hh:mm" no fuso do aparelho. Vazio ou inválido volta como veio. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const instante = new Date(iso);
  return Number.isNaN(instante.getTime()) ? iso : DATA_HORA.format(instante);
}

/** `aaaa-mm-dd` → `dd/mm/aaaa` sem passar por `Date` (que deslocaria o dia pelo fuso). Vazio ou fora do formato volta como veio. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '';
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : iso;
}

export interface Periodo {
  de: string;
  ate: string;
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Do primeiro ao último dia do mês de `hoje` (`aaaa-mm-dd`). */
export function esteMes(hojeIso: string): Periodo {
  const [ano, mes] = hojeIso.split('-').map(Number);
  return { de: `${ano}-${doisDigitos(mes)}-01`, ate: `${ano}-${doisDigitos(mes)}-${doisDigitos(ultimoDiaDoMes(ano, mes))}` };
}

/** O mês anterior ao de `hoje`, inclusive virando o ano (janeiro → dezembro do ano anterior). */
export function mesPassado(hojeIso: string): Periodo {
  const [ano, mes] = hojeIso.split('-').map(Number);
  const anoDoMes = mes === 1 ? ano - 1 : ano;
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  return { de: `${anoDoMes}-${doisDigitos(mesAnterior)}-01`, ate: `${anoDoMes}-${doisDigitos(mesAnterior)}-${doisDigitos(ultimoDiaDoMes(anoDoMes, mesAnterior))}` };
}

/** De 1º de janeiro a 31 de dezembro do ano de `hoje`. */
export function esteAno(hojeIso: string): Periodo {
  const ano = Number(hojeIso.split('-')[0]);
  return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
}
