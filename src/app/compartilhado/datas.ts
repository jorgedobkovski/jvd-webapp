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
