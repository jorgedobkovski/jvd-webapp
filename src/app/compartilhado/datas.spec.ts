import { formatarData, hoje } from './datas';

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

  it('hoje devolve aaaa-mm-dd do dia local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1, 23, 59));
    expect(hoje()).toBe('2026-11-01');
    vi.useRealTimers();
  });
});
