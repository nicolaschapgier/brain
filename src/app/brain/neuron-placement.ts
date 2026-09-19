import { Vector3 } from 'three';
import { Memory } from '../core/memory.model';

/** Demi-dimensions (en unités de scène) de la zone où vivent les neurones : 1 = bord de cette zone. */
export const NEURON_SPAN = new Vector3(3.5, 2.6, 4.5);

/** Pseudo-aléatoire déterministe : un même souvenir retrouve toujours le même emplacement. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function minDistance(point: Vector3, others: readonly Vector3[]): number {
  let min = Infinity;
  for (const other of others) min = Math.min(min, point.distanceTo(other));
  return min;
}

function pickFreeSpot(index: number, placed: readonly Vector3[], spacing: number): Vector3 {
  const rand = mulberry32(0x9e3779b1 ^ (index * 7919 + 17));
  let best = new Vector3();
  let bestGap = -1;

  for (let attempt = 0; attempt < 300; attempt++) {
    const v = new Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (v.lengthSq() > 0.85) continue;
    const candidate = v.multiply(NEURON_SPAN);
    if (candidate.y < -1.6) continue;

    const gap = minDistance(candidate, placed);
    if (gap >= spacing) return candidate;
    if (gap > bestGap) {
      best = candidate;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Donne une position 3D à chaque souvenir : celle du JSON si elle est fournie
 * (coordonnées normalisées -1..1), sinon un emplacement libre choisi automatiquement.
 */
export function placeNeurons(memories: readonly Memory[], minSpacing = 1.2): Vector3[] {
  const positions = memories.map((m) =>
    m.position ? new Vector3(...m.position).multiply(NEURON_SPAN) : undefined,
  );
  const placed = positions.filter((p): p is Vector3 => !!p);

  return positions.map((position, index) => {
    if (position) return position;
    const spot = pickFreeSpot(index, placed, minSpacing);
    placed.push(spot);
    return spot;
  });
}
