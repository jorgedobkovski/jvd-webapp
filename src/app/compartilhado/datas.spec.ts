import { esteAno, esteMes, formatarData, formatarDataHora, hoje, mesPassado } from './datas';

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

  it('períodos rápidos: este mês, mês passado (inclusive virada de ano e bissexto) e este ano', () => {
    expect(esteMes('2026-11-15')).toEqual({ de: '2026-11-01', ate: '2026-11-30' });
    expect(esteMes('2026-02-10')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(esteMes('2028-02-10')).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
    expect(mesPassado('2026-11-15')).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(mesPassado('2026-01-05')).toEqual({ de: '2025-12-01', ate: '2025-12-31' });
    expect(mesPassado('2026-03-31')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(esteAno('2026-11-15')).toEqual({ de: '2026-01-01', ate: '2026-12-31' });
  });
});
