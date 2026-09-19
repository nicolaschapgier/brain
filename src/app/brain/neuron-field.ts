import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { Memory } from '../core/memory.model';
import { BRAIN_SCALE } from './brain-geometry';
import { NEURON_SPAN, placeNeurons } from './neuron-placement';

/**
 * Luminosité relative commune à toutes les couleurs. Sans ça, le vert et le jaune (naturellement très
 * lumineux) brillent bien plus que le violet et le rose, surtout avec l'effet de lueur (bloom).
 * Baisser cette valeur adoucit tous les neurones ; la monter les fait tous rayonner davantage.
 */
const NEURON_LUMINANCE = 0.6;

/** Luminance relative d'une couleur linéaire (coefficients Rec. 709, ceux de sRGB). */
const luminance = (color: Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

// Cyan, violet, ambre, rose, menthe : teintes choisies déjà proches en luminosité (cf. NEURON_LUMINANCE),
// pour que la normalisation ne pousse aucune composante bien au-delà de 1 (sinon la couleur vire au blanc).
const PALETTE = [0x3ec3f5, 0xc4a2ff, 0xf5b83a, 0xff8fe0, 0x4fe0a0].map((hex) => {
  const color = new Color(hex);
  return color.multiplyScalar(NEURON_LUMINANCE / luminance(color));
});
/** Tailles dans le repère du cerveau : elles suivent donc son agrandissement (BRAIN_SCALE). */
const CORE_RADIUS = 0.12;
const HALO_SIZE = 0.5;
const DENDRITE_SIZE = 0.4; // les filaments autours des neurones
/** Taille des impulsions, en unités de la scène (les points ne suivent pas l'échelle des objets). */
const PULSE_SIZE = 0.5;
const DUST_COUNT = 500;
const CORE_INTENSITY = 1;

interface Neuron {
  id: string;
  /** Position dans le repère du cerveau (avant agrandissement). */
  position: Vector3;
  /** Position dans la scène. */
  world: Vector3;
  group: Group;
  core: Mesh<SphereGeometry, MeshBasicMaterial>;
  halo: Sprite;
  dendrites: LineSegments;
  color: Color;
  phase: number;
  scale: number;
}

interface Synapse {
  curve: QuadraticBezierCurve3;
  phase: number;
  speed: number;
}

function createGlowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** Petit générateur déterministe, pour que les dendrites gardent la même forme d'un chargement à l'autre. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/**
 * Tout ce qui vit dans le cerveau : un neurone lumineux par souvenir, les synapses
 * qui les relient (avec des impulsions qui circulent) et une poussière d'étincelles.
 */
export class NeuronField {
  readonly group = new Group();

  private readonly neurons: Neuron[] = [];
  private readonly byId = new Map<string, Neuron>();
  private readonly synapses: Synapse[] = [];
  private readonly glow = createGlowTexture();
  private readonly coreGeometry = new SphereGeometry(CORE_RADIUS, 24, 16);
  private readonly disposables: { dispose(): void }[] = [this.glow, this.coreGeometry];

  private readonly pulses: Points;
  private readonly dust: Points;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;

  constructor(memories: readonly Memory[]) {
    this.group.scale.setScalar(BRAIN_SCALE);
    const positions = placeNeurons(memories);
    memories.forEach((memory, index) => this.addNeuron(memory, positions[index], index));

    this.addSynapses();
    this.pulses = this.createPulses();
    this.dust = this.createDust();
    this.group.add(this.pulses, this.dust);
    this.refreshColors();
  }

  /** Position d'un neurone dans la scène. */
  positionOf(id: string): Vector3 | undefined {
    return this.byId.get(id)?.world.clone();
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    this.refreshColors();
  }

  setHovered(id: string | null) {
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.refreshColors();
  }

  /** Neurone sous le curseur (coordonnées en pixels CSS), avec une zone de clic confortable. */
  pick(camera: PerspectiveCamera, px: number, py: number, width: number, height: number): string | null {
    const tanHalfFov = Math.tan(MathUtils.degToRad(camera.fov) / 2);
    const view = new Vector3();
    const ndc = new Vector3();
    let best: string | null = null;
    let bestScore = Infinity;

    for (const neuron of this.neurons) {
      view.copy(neuron.world).applyMatrix4(camera.matrixWorldInverse);
      if (view.z >= 0) continue;

      ndc.copy(neuron.world).project(camera);
      const dx = (ndc.x * 0.5 + 0.5) * width - px;
      const dy = (-ndc.y * 0.5 + 0.5) * height - py;
      const coreRadiusPx = ((CORE_RADIUS * BRAIN_SCALE * neuron.scale) / (-view.z * tanHalfFov)) * height * 0.5;
      const reach = Math.max(22, coreRadiusPx * 1.4);

      const score = Math.hypot(dx, dy) / reach;
      if (score <= 1 && score < bestScore) {
        best = neuron.id;
        bestScore = score;
      }
    }
    return best;
  }

  update(time: number, delta: number) {
    const ease = Math.min(1, delta * 8);

    for (const neuron of this.neurons) {
      const target = neuron.id === this.selectedId ? 1.35 : neuron.id === this.hoveredId ? 1.4 : 1;
      neuron.scale += (target - neuron.scale) * ease;

      const beat = Math.sin(time * 2.2 + neuron.phase);
      neuron.core.scale.setScalar(neuron.scale * (1 + 0.06 * beat));
      neuron.halo.scale.setScalar(HALO_SIZE * neuron.scale * (1 + 0.12 * beat));
      neuron.dendrites.scale.setScalar(DENDRITE_SIZE * neuron.scale);
      neuron.dendrites.rotation.y = time * 0.08 + neuron.phase;
    }

    const attribute = this.pulses.geometry.getAttribute('position') as BufferAttribute;
    const point = new Vector3();
    this.synapses.forEach((synapse, i) => {
      synapse.curve.getPoint((time * synapse.speed + synapse.phase) % 1, point);
      attribute.setXYZ(i, point.x, point.y, point.z);
    });
    attribute.needsUpdate = true;

    this.dust.rotation.y = time * 0.012;
  }

  dispose() {
    this.group.traverse((object) => {
      const item = object as Mesh;
      item.geometry?.dispose();
      const materials = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
      materials.forEach((material) => material.dispose());
    });
    this.disposables.forEach((item) => item.dispose());
  }

  private addNeuron(memory: Memory, position: Vector3, index: number) {
    const color = PALETTE[index % PALETTE.length];
    const group = new Group();
    group.position.copy(position);

    const core = new Mesh(this.coreGeometry, new MeshBasicMaterial({ toneMapped: false }));
    core.renderOrder = 6;

    const halo = new Sprite(
      new SpriteMaterial({
        map: this.glow,
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    halo.renderOrder = 5;

    const dendrites = this.createDendrites(color, index);
    group.add(core, halo, dendrites);
    this.group.add(group);

    const neuron: Neuron = {
      id: memory.id,
      position,
      world: position.clone().multiplyScalar(BRAIN_SCALE),
      group,
      core,
      halo,
      dendrites,
      color,
      phase: index * 1.7,
      scale: 1,
    };
    this.neurons.push(neuron);
    this.byId.set(memory.id, neuron);
  }

  /** Quelques branches ramifiées autour du corps cellulaire, pour qu'on lise « neurone ». */
  private createDendrites(color: Color, seed: number): LineSegments {
    const rand = seededRandom(seed * 977 + 13);
    const points: number[] = [];
    const branches = 7;

    for (let i = 0; i < branches; i++) {
      const direction = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const middle = direction.clone().multiplyScalar(0.35 + rand() * 0.15);
      const tip = middle.clone().add(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.4));
      const fork = middle.clone().add(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3));
      points.push(0, 0, 0, ...middle.toArray(), ...middle.toArray(), ...tip.toArray(), ...middle.toArray(), ...fork.toArray());
    }

    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
    const lines = new LineSegments(
      geometry,
      new LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    lines.renderOrder = 4;
    return lines;
  }

  /** Relie chaque neurone à ses deux plus proches voisins. */
  private addSynapses() {
    const seen = new Set<string>();
    const rand = seededRandom(4242);
    const vertices: number[] = [];
    const segments = 18;

    this.neurons.forEach((from, i) => {
      const nearest = this.neurons
        .filter((_, j) => j !== i)
        .sort((a, b) => a.position.distanceTo(from.position) - b.position.distanceTo(from.position))
        .slice(0, 2);

      for (const to of nearest) {
        const key = [from.id, to.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);

        const length = from.position.distanceTo(to.position);
        const middle = from.position
          .clone()
          .lerp(to.position, 0.5)
          .add(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(length * 0.5));
        const curve = new QuadraticBezierCurve3(from.position, middle, to.position);
        this.synapses.push({ curve, phase: rand(), speed: 0.06 + rand() * 0.06 });

        const samples = curve.getPoints(segments);
        for (let s = 0; s < segments; s++) {
          vertices.push(...samples[s].toArray(), ...samples[s + 1].toArray());
        }
      }
    });

    if (!vertices.length) return;
    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    const lines = new LineSegments(
      geometry,
      new LineBasicMaterial({
        color: 0x8fa8ff,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    lines.renderOrder = 4;
    this.group.add(lines);
  }

  /** Un point lumineux par synapse, qui voyage le long de sa courbe. */
  private createPulses(): Points {
    const geometry = new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(new Float32Array(Math.max(1, this.synapses.length) * 3), 3),
    );
    const points = new Points(
      geometry,
      new PointsMaterial({
        map: this.glow,
        color: 0xcfe0ff,
        size: PULSE_SIZE,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    points.renderOrder = 5;
    points.frustumCulled = false;
    return points;
  }

  private createDust(): Points {
    const rand = seededRandom(99);
    const count = DUST_COUNT;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; ) {
      const x = rand() * 2 - 1;
      const y = rand() * 2 - 1;
      const z = rand() * 2 - 1;
      if (x * x + y * y + z * z > 1) continue;
      positions.set([x * NEURON_SPAN.x * 1.05, y * NEURON_SPAN.y * 1.1, z * NEURON_SPAN.z * 1.05], i * 3);
      i++;
    }

    const points = new Points(
      new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3)),
      new PointsMaterial({
        map: this.glow,
        color: 0xffc4e4,
        size: 0.14,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    points.renderOrder = 4;
    return points;
  }

  private refreshColors() {
    const white = new Color(0xffffff);
    for (const neuron of this.neurons) {
      const active = neuron.id === this.selectedId;
      const hovered = neuron.id === this.hoveredId;
      const tint = active ? neuron.color.clone().lerp(white, 0.2) : hovered ? neuron.color.clone().lerp(white, 0.5) : neuron.color;
      neuron.core.material.color.copy(tint).multiplyScalar(CORE_INTENSITY);
      neuron.halo.material.color.copy(neuron.color);
    }
  }
}
