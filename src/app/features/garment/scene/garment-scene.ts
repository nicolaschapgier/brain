import {
  AmbientLight,
  CircleGeometry,
  CanvasTexture,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { garmentGeometry } from './garment-geometry';

/**
 * Charge une image et la redessine dans un canvas avant d'en faire une texture : un SVG passé tel quel à WebGL
 * échoue à l'upload (« bad image data »), faute de dimensions en pixels ; le rasteriser d'abord règle le problème
 * pour tous les formats, y compris les vraies photos.
 */
async function loadRasterTexture(url: string): Promise<CanvasTexture> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image illisible : ${url}`));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  canvas.getContext('2d')!.drawImage(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export interface GarmentSceneOptions {
  canvas: HTMLCanvasElement;
  image: string;
  /** Lue à chaque image : l'angle de rotation actuel (radians), piloté par le scroll (voir `ScrollPin`). */
  getRotation: () => number;
}

/** Petite tache radiale sombre, sous le vêtement : suggère un contact au sol sans le coût d'une vraie ombre portée. */
function shadowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/**
 * La scène THREE.JS d'une tenue : le maillot (voir `garmentGeometry`) texturé avec sa photo, qui tourne sur lui-même
 * au rythme du scroll (`getRotation`). Classe TypeScript pure, sans dépendance à Angular (voir `BrainScene`, même
 * principe) : le composant `GarmentViewer` ne fait que la créer et la piloter.
 */
export class GarmentScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 20);
  private readonly garment: Mesh;
  private readonly frontMaterial: MeshStandardMaterial;
  private readonly resizeObserver: ResizeObserver;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private paused = false;
  private disposed = false;

  constructor(private readonly options: GarmentSceneOptions) {
    const { canvas, image } = options;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Assez loin (avec un champ de vision étroit) pour garder de la marge tout autour du maillot : sa moitié de
    // hauteur, après `.center()`, dépasse ~1.18 — trop proche, la caméra le coupait en haut comme en bas.
    this.camera.position.set(0, 0.05, 5.5);
    this.camera.lookAt(0, -0.05, 0);
    this.addLights();

    this.frontMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.04 });
    const edgeMaterial = new MeshStandardMaterial({ color: 0xe7e2f5, roughness: 0.9, metalness: 0.04 });
    this.garment = new Mesh(garmentGeometry(), [this.frontMaterial, edgeMaterial]);
    this.scene.add(this.garment);

    const shadow = new Mesh(
      new CircleGeometry(1.15, 32),
      new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.42;
    this.scene.add(shadow);

    loadRasterTexture(image)
      .then((texture) => {
        if (this.disposed) return;
        this.frontMaterial.map = texture;
        this.frontMaterial.needsUpdate = true;
        if (this.reducedMotion) this.renderer.render(this.scene, this.camera);
      })
      .catch((err) => {
        // Le maillot reste visible dans sa couleur unie : une photo manquante ou illisible ne casse pas la vue 3D.
        console.error(`[garment] photo illisible : ${image}`, err);
      });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    if (this.reducedMotion) this.renderer.render(this.scene, this.camera);
    else this.renderer.setAnimationLoop(this.tick);
  }

  /** En pause hors écran (voir l'`IntersectionObserver` de `GarmentViewer`) : inutile de dessiner ce qui n'est pas vu. */
  setPaused(paused: boolean) {
    if (paused === this.paused || this.reducedMotion) return;
    this.paused = paused;
    this.renderer.setAnimationLoop(paused ? null : this.tick);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.garment.geometry.dispose();
    for (const material of this.garment.material as MeshStandardMaterial[]) {
      material.map?.dispose();
      material.dispose();
    }
    this.renderer.dispose();
  }

  private addLights() {
    const key = new DirectionalLight(0xfff1e0, 2.3);
    key.position.set(3, 4, 5);
    const fill = new DirectionalLight(0x9bb4ff, 1.1);
    fill.position.set(-4, 1, 2);
    // Derrière, pour que le dos du maillot ne tombe pas dans le noir pendant la moitié du tour.
    const rim = new DirectionalLight(0xb388ff, 1.3);
    rim.position.set(0, 2, -4);
    this.scene.add(new AmbientLight(0xffffff, 0.55), key, fill, rim);
  }

  private canvasSize() {
    const { canvas } = this.options;
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  }

  private resize() {
    const { width, height } = this.canvasSize();
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.reducedMotion) this.renderer.render(this.scene, this.camera);
  }

  private readonly tick = () => {
    this.garment.rotation.y = this.options.getRotation();
    this.renderer.render(this.scene, this.camera);
  };
}
