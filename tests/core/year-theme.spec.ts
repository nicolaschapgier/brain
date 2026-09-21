import { FIRST_YEAR, LAST_YEAR, retroOf, themeFor, yearOf } from '@core/year-theme';

describe('yearOf', () => {
  it('lit l’année d’une date ISO', () => {
    expect(yearOf('2023-02-11')).toBe(2023);
  });

  it('lit l’année dans un texte libre', () => {
    expect(yearOf('Été 2022')).toBe(2022);
    expect(yearOf('août 2016, en vacances')).toBe(2016);
  });

  it('rend null sans année, ou pour un nombre qui n’en est pas une', () => {
    expect(yearOf(undefined)).toBeNull();
    expect(yearOf('')).toBeNull();
    expect(yearOf('Un soir d’été')).toBeNull();
    expect(yearOf('rue 12345')).toBeNull();
  });
});

describe('retroOf', () => {
  it('est maximal pour la première année et nul pour la dernière', () => {
    expect(retroOf(FIRST_YEAR)).toBe(1);
    expect(retroOf(LAST_YEAR)).toBe(0);
  });

  it('diminue à chaque année qui passe', () => {
    const values = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => retroOf(FIRST_YEAR + i));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
  });

  it('reste entre 0 et 1 hors de la période', () => {
    expect(retroOf(2005)).toBe(1);
    expect(retroOf(2040)).toBe(0);
  });
});

describe('themeFor', () => {
  it('pose l’intensité rétro de l’année, et rien d’autre : le thème reste celui de Berry', () => {
    const { vars, retro } = themeFor(2019);
    expect(Object.keys(vars)).toEqual(['--retro']);
    expect(vars['--retro']).toBe(String(retro));
    expect(retro).toBeCloseTo((LAST_YEAR - 2019) / (LAST_YEAR - FIRST_YEAR));
  });

  it('vieillit une carte de 2015 plus qu’une carte de 2024', () => {
    expect(themeFor(2015).retro).toBeGreaterThan(themeFor(2024).retro);
  });

  it('laisse neuve une carte sans année', () => {
    expect(themeFor(null)).toEqual({ retro: 0, vars: {} });
  });
});
