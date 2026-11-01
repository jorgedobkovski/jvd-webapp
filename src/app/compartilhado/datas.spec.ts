import { formatarData, formatarDataHora, hoje } from './datas';

describe('datas', () => {
  it('formata aaaa-mm-dd como dd/mm/aaaa sem deslocar o dia', () => {
    expect(formatarData('2026-11-01')).toBe('01/11/2026');
    expect(formatarData('2026-01-31T00:00:00')).toBe('31/01/2026');
  });

  it('vazio vira texto vazio e formato desconhecido volta como veio', () => {
    expect(formatarData(null)).toBe('');
    expect(formatarData(undefined)).toBe('');
    expect(formatarData('')).toBe('');
    expect(formatarData('ontem')).toBe('ontem');
  });

  it('data e hora de um instante ISO sai no formato brasileiro; vazio e inválido voltam como vieram', () => {
    expect(formatarDataHora('2026-10-31T15:30:00Z')).toMatch(/^\d{2}\/\d{2}\/\d{2,4},? \d{2}:\d{2}$/);
    expect(formatarDataHora(null)).toBe('');
    expect(formatarDataHora('')).toBe('');
    expect(formatarDataHora('ontem')).toBe('ontem');
  });

  it('hoje devolve aaaa-mm-dd do dia local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1, 23, 59));
    expect(hoje()).toBe('2026-11-01');
    vi.useRealTimers();
  });
});
