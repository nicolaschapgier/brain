import { FRAME_RATIO, coverOverflow, dragFocus, isMovable, nudgeFocus } from './framing';

describe('coverOverflow', () => {
  it('une photo en portrait déborde en hauteur seulement', () => {
    const overflow = coverOverflow({ width: 300, height: 400 }, { width: 400, height: 250 });
    expect(overflow.x).toBe(0);
    expect(overflow.y).toBeCloseTo(283.33, 1);
  });

  it('une photo en panorama déborde en largeur seulement', () => {
    expect(coverOverflow({ width: 800, height: 400 }, { width: 400, height: 250 })).toEqual({ x: 100, y: 0 });
  });

  it('une photo de la forme du cadre ne déborde pas', () => {
    expect(coverOverflow({ width: 1600, height: 1000 }, { width: 400, height: 250 })).toEqual({ x: 0, y: 0 });
  });
});

describe('isMovable', () => {
  it('le cadrage ne change rien pour une photo de la forme du cadre', () => {
    expect(isMovable({ width: 1600, height: 1000 })).toBe(false);
    expect(isMovable({ width: 1600 * FRAME_RATIO, height: 1600 })).toBe(false);
  });

  it('il compte pour une photo en portrait ou en paysage large', () => {
    expect(isMovable({ width: 1200, height: 1600 })).toBe(true);
    expect(isMovable({ width: 4000, height: 1000 })).toBe(true);
  });
});

describe('dragFocus', () => {
  const overflow = { x: 0, y: 200 };

  it('tirer la photo vers le bas montre une partie plus haute : le point remonte', () => {
    expect(dragFocus([50, 50], 0, 100, overflow)).toEqual([50, 0]);
    expect(dragFocus([50, 50], 0, -50, overflow)).toEqual([50, 75]);
  });

  it('reste entre 0 et 100, même en tirant très loin', () => {
    expect(dragFocus([50, 50], 0, 5000, overflow)[1]).toBe(0);
    expect(dragFocus([50, 50], 0, -5000, overflow)[1]).toBe(100);
  });

  it('ne bouge pas sur un axe où la photo ne déborde pas', () => {
    expect(dragFocus([30, 50], 400, 0, overflow)).toEqual([30, 50]);
  });
});

describe('nudgeFocus', () => {
  it('décale le point de cadrage sans sortir de la photo', () => {
    expect(nudgeFocus([50, 50], 5, -5)).toEqual([55, 45]);
    expect(nudgeFocus([98, 2], 5, -5)).toEqual([100, 0]);
  });
});
