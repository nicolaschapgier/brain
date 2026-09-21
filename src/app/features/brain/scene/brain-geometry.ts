import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  IcosahedronGeometry,
  MathUtils,
  TubeGeometry,
  Vector3,
} from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Repère : +z = avant du cerveau (à gauche de l'image de référence quand on le
 * regarde depuis +x), +y = haut, x = gauche/droite.
 */
/**
 * Agrandissement appliqué au cerveau et à ses neurones : plus il est grand, plus on a de place
 * pour se déplacer à l'intérieur. La géométrie reste modélisée à l'échelle 1.
 */
export const BRAIN_SCALE = 1.9;

export const CEREBRUM_RADII = new Vector3(4.1, 3.3, 5.2);
export const CEREBELLUM_CENTER = new Vector3(0, -2.5, -3.3);

const smoothstep = MathUtils.smoothstep;

/** Icosphère à sommets soudés, pour que les normales soient continues après déformation. */
function icoSphere(detail: number): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, detail);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  return mergeVertices(geometry, 1e-4);
}

/** Vaut 1 sur les lignes où le bruit s'annule : ce sont les sillons du cortex. */
function creaseAt(noise: ImprovedNoise, p: Vector3): number {
  const warpFreq = 0.4;
  const wx = noise.noise(p.x * warpFreq + 11.3, p.y * warpFreq + 0.5, p.z * warpFreq + 0.5) * 0.9;
  const wy = noise.noise(p.x * warpFreq + 0.5, p.y * warpFreq + 5.1, p.z * warpFreq + 0.5) * 0.9;
  const wz = noise.noise(p.x * warpFreq + 0.5, p.y * warpFreq + 0.5, p.z * warpFreq + 9.7) * 0.9;

  const f = 0.85;
  const n =
    noise.noise(p.x * f + wx + 0.5, p.y * f + wy + 0.5, p.z * f + wz + 0.5) +
    0.3 * noise.noise(p.x * f * 2.1 + 3.7, p.y * f * 2.1 + 0.5, p.z * f * 2.1 + 0.5);

  const width = 0.17;
  return Math.exp(-(n * n) / (width * width));
}

/** Forme de base d'un hémisphère fusionné : ellipsoïde, avant plus étroit, dessous aplati, lobe temporal. */
function cerebrumShape(d: Vector3, out: Vector3): Vector3 {
  const front = smoothstep(d.z, -0.1, 1);
  const back = smoothstep(-d.z, 0.1, 1);
  const underside = d.y < 0 ? 1 - 0.4 * smoothstep(-d.y, 0, 0.8) : 1 - 0.08 * back;

  out.set(
    d.x * CEREBRUM_RADII.x * (1 - 0.2 * front - 0.03 * back),
    d.y * CEREBRUM_RADII.y * underside,
    d.z * CEREBRUM_RADII.z,
  );

  // Lobe temporal : renflement bas, sur les côtés, vers l'avant.
  const dx = Math.abs(d.x) - 0.72;
  const dy = d.y + 0.6;
  const dz = d.z - 0.28;
  out.multiplyScalar(1 + 0.32 * Math.exp(-(dx * dx + dy * dy + dz * dz) / 0.1));
  return out;
}

/** Scissure inter-hémisphérique : rainure verticale au milieu du dessus. */
function fissureDepth(d: Vector3): number {
  const across = d.x / 0.045;
  return Math.exp(-across * across) * smoothstep(d.y, -0.45, 0.1);
}

/** Scissure de Sylvius : rainure qui sépare le lobe temporal du reste. */
function sylvianDepth(d: Vector3): number {
  const across = (d.y - (-0.2 + 0.28 * d.z)) / 0.05;
  const alongZ = smoothstep(d.z, -0.55, -0.2) * smoothstep(-d.z, -0.75, -0.3);
  return Math.exp(-across * across) * smoothstep(Math.abs(d.x), 0.35, 0.7) * alongZ;
}

export function createCerebrumGeometry(detail = 64): BufferGeometry {
  const geometry = icoSphere(detail);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const noise = new ImprovedNoise();

  const pink = new Color(0xf29aa8);
  const deep = new Color(0x8c2f52);
  const color = new Color();
  const d = new Vector3();
  const p = new Vector3();

  for (let i = 0; i < position.count; i++) {
    d.fromBufferAttribute(position, i).normalize();
    cerebrumShape(d, p);

    const crease = creaseAt(noise, p);
    const fissure = fissureDepth(d);
    const sylvian = sylvianDepth(d);
    p.addScaledVector(d, -(0.3 * crease + 0.85 * fissure + 0.35 * sylvian));
    position.setXYZ(i, p.x, p.y, p.z);

    const shade = Math.max(Math.pow(crease, 0.7) * 0.95, fissure, sylvian * 0.8);
    color.copy(pink).lerp(deep, Math.min(1, shade));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Cervelet : ellipsoïde strié de rainures en éventail, posé sous l'arrière du cerveau. */
export function createCerebellumGeometry(detail = 40): BufferGeometry {
  const geometry = icoSphere(detail);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const noise = new ImprovedNoise();

  const base = new Color(0xc9668a);
  const groove = new Color(0x5b1d3d);
  const color = new Color();
  const p = new Vector3();

  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).normalize();
    const d = p.clone();
    p.set(d.x * 2.1, d.y * (d.y > 0 ? 1.2 : 1.5), d.z * 1.9);

    // Stries en éventail autour du point d'attache du tronc (devant, en bas), comme sur l'image de référence.
    const wobble = noise.noise(p.x * 0.6 + 0.5, p.y * 0.6 + 0.5, p.z * 0.6 + 0.5);
    const fan = Math.atan2(p.y + 0.9, p.z - 1.4);
    const ridge = Math.pow(0.5 + 0.5 * Math.cos(fan * 11 + wobble * 2.5), 5);

    p.addScaledVector(d, -0.05 * ridge).add(CEREBELLUM_CENTER);
    position.setXYZ(i, p.x, p.y, p.z);

    color.copy(base).lerp(groove, ridge * 0.9);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Tronc cérébral : tube qui s'affine vers le bas et se referme en bout arrondi. */
export function createBrainStemGeometry(): BufferGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(0.1, -2.2, -0.7),
    new Vector3(0.2, -3.6, -1.0),
    new Vector3(0.05, -5.0, -1.6),
  ]);
  const tubular = 28;
  const radial = 22;
  const geometry = new TubeGeometry(curve, tubular, 0.72, radial, false);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const point = new Vector3();
  const vertex = new Vector3();

  for (let i = 0; i < position.count; i++) {
    const t = Math.floor(i / (radial + 1)) / tubular;
    curve.getPointAt(t, point);
    const taper = MathUtils.lerp(1, 0.68, t) * (1 - 0.92 * MathUtils.smoothstep(t, 0.9, 1));
    vertex.fromBufferAttribute(position, i).sub(point).multiplyScalar(taper).add(point);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}
