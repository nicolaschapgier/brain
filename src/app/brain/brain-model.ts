import {
  BackSide,
  FrontSide,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
} from 'three';
import {
  BRAIN_SCALE,
  CEREBRUM_RADII,
  createBrainStemGeometry,
  createCerebellumGeometry,
  createCerebrumGeometry,
} from './brain-geometry';

interface Fade {
  material: MeshStandardMaterial;
  outside: number;
  inside: number;
}

/**
 * Le cerveau rose de l'image, en 3D. Depuis l'extérieur, il est translucide pour
 * laisser voir les neurones ; quand la caméra entre, la coque s'efface et sa face
 * interne est éclairée par une lumière placée au centre.
 */
export class BrainModel {
  readonly group = new Group();

  private readonly fades: Fade[] = [];
  private readonly meshes: Mesh[] = [];

  constructor() {
    const cerebrum = createCerebrumGeometry();
    this.addShell(cerebrum, { vertexColors: true, roughness: 0.55, emissive: 0x3a0f2e, emissiveIntensity: 0.35 }, {
      back: { outside: 0.22, inside: 0.5 },
      front: { outside: 0.55, inside: 0.0 },
    });

    this.addOpaque(
      createCerebellumGeometry(),
      { vertexColors: true, roughness: 0.6, emissive: 0x3a0f2e, emissiveIntensity: 0.3 },
      { outside: 0.92, inside: 0.45 },
    );
    this.addOpaque(
      createBrainStemGeometry(),
      { color: 0xd98a9c, roughness: 0.6, emissive: 0x3a0f2e, emissiveIntensity: 0.3 },
      { outside: 0.92, inside: 0.45 },
    );

    // L'intensité suit l'agrandissement : la lumière s'atténue avec la distance (exposant 1.6).
    const core = new PointLight(0xc98cff, 18 * BRAIN_SCALE ** 1.6, 0, 1.6);
    core.position.set(0, 0.3, 0);
    this.group.add(core);

    this.group.scale.setScalar(BRAIN_SCALE);
    this.setInside(0);
  }

  /** 1 quand la caméra est à l'intérieur du cerveau, 0 dehors, avec une zone de transition. */
  insideFactor(point: Vector3): number {
    const x = point.x / BRAIN_SCALE;
    const y = point.y / BRAIN_SCALE;
    const z = point.z / BRAIN_SCALE;
    const q =
      (x / (CEREBRUM_RADII.x * 0.92)) ** 2 + (y / (CEREBRUM_RADII.y * 0.85)) ** 2 + (z / (CEREBRUM_RADII.z * 0.92)) ** 2;
    return 1 - MathUtils.smoothstep(q, 0.85, 1.1);
  }

  setInside(factor: number) {
    for (const { material, outside, inside } of this.fades) {
      material.opacity = MathUtils.lerp(outside, inside, factor);
    }
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
  }

  /** Coque en deux passes (faces arrière puis avant) pour limiter les artefacts de transparence. */
  private addShell(
    geometry: ReturnType<typeof createCerebrumGeometry>,
    params: ConstructorParameters<typeof MeshStandardMaterial>[0],
    opacity: { back: Omit<Fade, 'material'>; front: Omit<Fade, 'material'> },
  ) {
    const parts = [
      { side: BackSide, fade: opacity.back, order: 1 },
      { side: FrontSide, fade: opacity.front, order: 2 },
    ];
    for (const { side, fade, order } of parts) {
      const material = new MeshStandardMaterial({ ...params, side, transparent: true, depthWrite: false });
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = order;
      this.fades.push({ material, ...fade });
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  private addOpaque(
    geometry: ReturnType<typeof createCerebrumGeometry>,
    params: ConstructorParameters<typeof MeshStandardMaterial>[0],
    opacity: Omit<Fade, 'material'>,
  ) {
    const material = new MeshStandardMaterial({ ...params, transparent: true });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 3;
    this.fades.push({ material, ...opacity });
    this.meshes.push(mesh);
    this.group.add(mesh);
  }
}
