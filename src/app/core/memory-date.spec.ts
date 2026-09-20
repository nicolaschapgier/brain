import { formatMemoryDate } from './memory-date';

describe('formatMemoryDate', () => {
  it('met une date ISO en toutes lettres', () => {
    expect(formatMemoryDate('2023-02-11')).toBe('11 février 2023');
  });

  it('laisse tel quel un texte libre', () => {
    expect(formatMemoryDate('Été 2022')).toBe('Été 2022');
  });

  it('laisse tel quel une date impossible', () => {
    expect(formatMemoryDate('2023-13-45')).toBe('2023-13-45');
  });
});
