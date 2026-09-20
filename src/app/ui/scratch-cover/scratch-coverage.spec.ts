import { transparentFraction } from './scratch-coverage';

/** Fabrique des données RGBA à partir des seules valeurs d'alpha, une par pixel. */
const pixels = (...alphas: number[]) => alphas.flatMap((alpha) => [200, 200, 200, alpha]);

describe('transparentFraction', () => {
  it('vaut 0 pour une pellicule intacte (tout opaque)', () => {
    expect(transparentFraction(pixels(255, 255, 255, 255))).toBe(0);
  });

  it('vaut 1 pour une pellicule entièrement grattée (tout transparent)', () => {
    expect(transparentFraction(pixels(0, 0, 0, 0))).toBe(1);
  });

  it('donne la proportion de pixels transparents', () => {
    expect(transparentFraction(pixels(0, 255, 0, 255))).toBe(0.5);
    expect(transparentFraction(pixels(0, 255, 255, 255))).toBe(0.25);
  });

  it('compte aussi les pixels à moitié transparents (bords doux du grattage)', () => {
    expect(transparentFraction(pixels(128, 128))).toBeCloseTo(0.498, 2);
  });

  it('ignore les canaux rouge, vert et bleu', () => {
    expect(transparentFraction([255, 0, 0, 0, 0, 255, 0, 255])).toBe(0.5);
  });

  it('ne plante pas sur des données vides', () => {
    expect(transparentFraction([])).toBe(0);
  });
});
