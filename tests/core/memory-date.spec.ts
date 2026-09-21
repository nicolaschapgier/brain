import { buildDate, dateProblem, formatMemoryDate, splitDate } from '@core/memory-date';

describe('formatMemoryDate', () => {
  it('met une date ISO en toutes lettres', () => {
    expect(formatMemoryDate('2023-02-11')).toBe('11 février 2023');
  });

  it('met un mois et une année en toutes lettres', () => {
    expect(formatMemoryDate('2019-08')).toBe('août 2019');
  });

  it('laisse tel quel une année seule', () => {
    expect(formatMemoryDate('2019')).toBe('2019');
  });

  it('laisse tel quel un texte libre', () => {
    expect(formatMemoryDate('Été 2022')).toBe('Été 2022');
  });

  it('laisse tel quel une date impossible', () => {
    expect(formatMemoryDate('2023-13-45')).toBe('2023-13-45');
    expect(formatMemoryDate('2023-13')).toBe('2023-13');
  });
});

describe('buildDate', () => {
  it('donne seulement l’année quand rien d’autre n’est connu', () => {
    expect(buildDate({ year: 2019, month: null, day: null })).toBe('2019');
  });

  it('ajoute le mois, puis le jour, sur deux chiffres', () => {
    expect(buildDate({ year: 2019, month: 8, day: null })).toBe('2019-08');
    expect(buildDate({ year: 2019, month: 8, day: 5 })).toBe('2019-08-05');
  });

  it('n’enregistre aucune date sans année', () => {
    expect(buildDate({ year: null, month: 8, day: 5 })).toBeUndefined();
  });

  it('ignore un jour donné sans mois', () => {
    expect(buildDate({ year: 2019, month: null, day: 5 })).toBe('2019');
  });
});

describe('splitDate', () => {
  it('découpe une année, un mois et une date complète', () => {
    expect(splitDate('2019')).toEqual({ year: 2019, month: null, day: null });
    expect(splitDate('2019-08')).toEqual({ year: 2019, month: 8, day: null });
    expect(splitDate('2019-08-05')).toEqual({ year: 2019, month: 8, day: 5 });
  });

  it('ne connaît rien d’un texte libre ou d’une absence de date', () => {
    const unknown = { year: null, month: null, day: null };
    expect(splitDate('Été 2022')).toEqual(unknown);
    expect(splitDate(undefined)).toEqual(unknown);
    expect(splitDate('')).toEqual(unknown);
  });

  it('est l’inverse de buildDate', () => {
    for (const parts of [
      { year: 2015, month: null, day: null },
      { year: 2020, month: 2, day: null },
      { year: 2024, month: 2, day: 29 },
    ]) {
      expect(splitDate(buildDate(parts))).toEqual(parts);
    }
  });
});

describe('dateProblem', () => {
  const now = new Date(2026, 8, 21, 12);

  it('accepte une année seule, un mois, une date complète', () => {
    expect(dateProblem({ year: 2019, month: null, day: null }, now)).toBeNull();
    expect(dateProblem({ year: 2019, month: 8, day: null }, now)).toBeNull();
    expect(dateProblem({ year: 2019, month: 8, day: 5 }, now)).toBeNull();
  });

  it('ne dit rien tant que l’année manque : c’est le champ année qui se plaint', () => {
    expect(dateProblem({ year: null, month: 2, day: 30 }, now)).toBeNull();
  });

  it('refuse un jour sans mois', () => {
    expect(dateProblem({ year: 2019, month: null, day: 5 }, now)).toBe('day-without-month');
  });

  it('refuse un jour qui n’existe pas ce mois-là, en tenant compte des années bissextiles', () => {
    expect(dateProblem({ year: 2019, month: 2, day: 30 }, now)).toBe('impossible');
    expect(dateProblem({ year: 2019, month: 4, day: 31 }, now)).toBe('impossible');
    expect(dateProblem({ year: 2019, month: 2, day: 29 }, now)).toBe('impossible');
    expect(dateProblem({ year: 2024, month: 2, day: 29 }, now)).toBeNull();
  });

  it('refuse un mois hors de 1 à 12', () => {
    expect(dateProblem({ year: 2019, month: 13, day: null }, now)).toBe('impossible');
  });

  it('refuse le futur, mais pas le mois ou l’année en cours', () => {
    expect(dateProblem({ year: 2027, month: null, day: null }, now)).toBe('future');
    expect(dateProblem({ year: 2026, month: 10, day: null }, now)).toBe('future');
    expect(dateProblem({ year: 2026, month: 9, day: 22 }, now)).toBe('future');
    expect(dateProblem({ year: 2026, month: null, day: null }, now)).toBeNull();
    expect(dateProblem({ year: 2026, month: 9, day: null }, now)).toBeNull();
    expect(dateProblem({ year: 2026, month: 9, day: 21 }, now)).toBeNull();
  });
});
