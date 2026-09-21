import {
  MAX_FILE_BYTES,
  PhotoError,
  fitWithin,
  isHeic,
  plausibleDate,
  preparePhoto,
  toIsoDate,
} from './photo-import';

describe('fitWithin', () => {
  it('réduit une photo d’iPhone en paysage en gardant ses proportions', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('réduit une photo en portrait selon son grand côté, la hauteur', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('n’agrandit jamais une photo déjà petite', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('garde au moins un pixel de chaque côté', () => {
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('isHeic', () => {
  it('reconnaît le HEIC d’après son type', () => {
    expect(isHeic({ name: 'a', type: 'image/heic' })).toBe(true);
    expect(isHeic({ name: 'a', type: 'image/heif' })).toBe(true);
  });

  it('le reconnaît aussi d’après le nom quand le navigateur ne donne pas de type', () => {
    expect(isHeic({ name: 'IMG_1234.HEIC', type: '' })).toBe(true);
    expect(isHeic({ name: 'photo.heif', type: '' })).toBe(true);
  });

  it('ne prend pas les autres images pour du HEIC', () => {
    expect(isHeic({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isHeic({ name: 'a.png', type: 'image/png' })).toBe(false);
  });
});

describe('toIsoDate', () => {
  it('donne le jour local, au format d’un champ date', () => {
    expect(toIsoDate(new Date(2019, 7, 5, 23, 59))).toBe('2019-08-05');
    expect(toIsoDate(new Date(2024, 0, 3, 0, 5))).toBe('2024-01-03');
  });
});

describe('plausibleDate', () => {
  const now = new Date(2026, 8, 21, 12);

  it('garde une date de prise de vue crédible', () => {
    expect(plausibleDate(new Date(2019, 7, 5, 14, 30), now)).toBe('2019-08-05');
  });

  it('écarte une horloge d’appareil mal réglée (avant 1990) et une date dans le futur', () => {
    expect(plausibleDate(new Date(1970, 0, 1), now)).toBeNull();
    expect(plausibleDate(new Date(2030, 0, 1), now)).toBeNull();
  });

  it('écarte ce qui n’est pas une date valide', () => {
    expect(plausibleDate(undefined, now)).toBeNull();
    expect(plausibleDate('2019-08-05', now)).toBeNull();
    expect(plausibleDate(new Date('pas une date'), now)).toBeNull();
  });
});

describe('preparePhoto : fichiers refusés', () => {
  it('refuse un fichier qui n’est pas une image', async () => {
    const file = new File(['bonjour'], 'notes.txt', { type: 'text/plain' });
    await expect(preparePhoto(file)).rejects.toMatchObject({ reason: 'not-an-image' });
    await expect(preparePhoto(file)).rejects.toBeInstanceOf(PhotoError);
  });

  it('refuse une photo trop lourde', async () => {
    const file = new File(['x'], 'grosse.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES + 1 });
    await expect(preparePhoto(file)).rejects.toMatchObject({ reason: 'too-large' });
  });
});
