import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Memory } from '../core/memory.model';
import { BRAIN_SCALE } from './brain-geometry';
import { BrainModel } from './brain-model';
import { NeuronField } from './neuron-field';
import { SpaceBackdrop } from './space-backdrop';

export interface HoverInfo {
  id: string;
  x: number;
  y: number;
}

export interface BrainSceneOptions {
  canvas: HTMLCanvasElement;
  onSelect: (id: string) => void;
  onHover: (hover: HoverInfo | null) => void;
  autoRotate: boolean;
}

interface Flight {
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
  start: number;
  duration: number;
}

// Les poses sont réglées pour un cerveau à l'échelle 1, puis multipliées par BRAIN_SCALE.
const OVERVIEW_POSITION = new Vector3(12.5, 3.8, 6.5).multiplyScalar(BRAIN_SCALE);
const OVERVIEW_TARGET = new Vector3(0, -0.4, 0).multiplyScalar(BRAIN_SCALE);
/** Format (largeur / hauteur) pour lequel la vue d'ensemble a été réglée ; en dessous, on recule. */
const OVERVIEW_ASPECT = 1.33;

const MOVE_SPEED = 4.5 * BRAIN_SCALE;
/** Distance entre la caméra et sa cible en vue « première personne » : plus elle est petite, plus la souris pivote sur place. */
const FIRST_PERSON_DISTANCE = 2;
/** Déplacement de la caméra par pixel de molette (un cran vaut environ 100 px) dans le cerveau, en avançant comme en reculant. */
const WHEEL_STEP = 0.014 * BRAIN_SCALE;
/** Seuils (avec hystérésis) pour considérer que la caméra est entrée dans / sortie du cerveau. */
const ENTER_THRESHOLD = 0.6;
const LEAVE_THRESHOLD = 0.3;
const CLICK_MAX_DRAG = 6;
const CLICK_MAX_MS = 600;

const MOVE_KEYS: Record<string, 'forward' | 'back' | 'left' | 'right' | 'up' | 'down'> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'up',
  ShiftLeft: 'down',
  ShiftRight: 'down',
};

const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * La scène THREE.JS : cerveau, neurones, décor spatial, caméra et interactions.
 * Classe TypeScript pure, sans dépendance à Angular : le composant ne fait que la piloter.
 */
export class BrainScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.05, 2000);
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly brain = new BrainModel();
  private readonly backdrop: SpaceBackdrop;
  private readonly resizeObserver: ResizeObserver;
  private readonly held = new Set<string>();

  private field?: NeuronField;
  private flight?: Flight;
  private autoRotate: boolean;
  private focused = false;
  private inside = 0;
  private interior = false;
  private glide = 0;
  private lastTime = 0;
  private paused = false;

  private pointer: { x: number; y: number } | null = null;
  private pointerDown?: { x: number; y: number; time: number };
  private hoverDirty = false;
  private hoveredId: string | null = null;

  constructor(private readonly options: BrainSceneOptions) {
    const { canvas } = options;
    this.autoRotate = options.autoRotate;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.backdrop = new SpaceBackdrop(this.renderer.getPixelRatio());
    this.scene.add(this.backdrop.group, this.brain.group);
    this.addLights();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 1.2;
    this.controls.minDistance = 0.05;
    this.controls.maxDistance = 120;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = 0.35;
    this.applyAutoRotate();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.6, 0.5, 0.7);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // En phase de capture pour passer avant OrbitControls et prendre la molette quand on est dans le cerveau.
    (canvas.parentElement ?? canvas).addEventListener('wheel', this.onWheel, { capture: true, passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    const overview = this.overviewPose();
    this.camera.position.copy(overview.position);
    this.controls.target.copy(overview.target);
    this.renderer.setAnimationLoop(this.tick);
  }

  setMemories(memories: readonly Memory[]) {
    if (this.field) {
      this.scene.remove(this.field.group);
      this.field.dispose();
    }
    this.field = new NeuronField(memories);
    this.scene.add(this.field.group);
    this.setHovered(null);
  }

  /** En pause (l'album est ouvert par-dessus), la scène ne dessine plus rien et ignore le clavier. */
  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    this.held.clear();
    this.glide = 0;
    this.renderer.setAnimationLoop(paused ? null : this.tick);
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotate = enabled;
    this.applyAutoRotate();
  }

  /** Met un neurone en avant et y emmène la caméra ; `null` retire la mise en avant sans bouger. */
  focus(id: string | null) {
    this.field?.setSelected(id);
    this.focused = id !== null;
    this.applyAutoRotate();

    const position = id ? this.field?.positionOf(id) : undefined;
    if (!position) return;

    const distance = 3.4;
    const away = this.camera.position.clone().sub(position);
    if (away.lengthSq() < 1e-4) away.set(0.3, 0.2, 1);
    away.normalize();

    const toPosition = position.clone().addScaledVector(away, distance);
    const toTarget = position.clone();

    // Décale la vue pour que le neurone reste visible à côté de la carte (à droite, ou en bas sur mobile).
    const forward = away.clone().negate();
    const right = new Vector3().crossVectors(forward, this.camera.up).normalize();
    const up = new Vector3().crossVectors(right, forward).normalize();
    const shift = this.canvasSize().width >= 900 ? right.multiplyScalar(distance * 0.25) : up.multiplyScalar(-distance * 0.28);
    toPosition.add(shift);
    toTarget.add(shift);

    this.flyTo(toPosition, toTarget);
  }

  resetView() {
    const { position, target } = this.overviewPose();
    this.flyTo(position, target, 2.2);
  }

  dispose() {
    const { canvas } = this.options;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    (canvas.parentElement ?? canvas).removeEventListener('wheel', this.onWheel, { capture: true });
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);

    this.field?.dispose();
    this.brain.dispose();
    this.backdrop.dispose();
    this.controls.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private addLights() {
    const key = new DirectionalLight(0xffd6e0, 2.4);
    key.position.set(8, 10, 6);
    const rim = new DirectionalLight(0x6a8cff, 1.4);
    rim.position.set(-8, -4, -6);
    this.scene.add(new AmbientLight(0x8a6bd6, 0.55), key, rim);
  }

  /** Vue d'ensemble : plus éloignée sur un écran étroit (portrait) pour que le cerveau tienne en largeur. */
  private overviewPose() {
    const { width, height } = this.canvasSize();
    const aspect = width && height ? width / height : OVERVIEW_ASPECT;
    const zoomOut = MathUtils.clamp((OVERVIEW_ASPECT * 0.6) / aspect, 1, 2);
    const position = OVERVIEW_POSITION.clone().sub(OVERVIEW_TARGET).multiplyScalar(zoomOut).add(OVERVIEW_TARGET);
    return { position, target: OVERVIEW_TARGET.clone() };
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
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.backdrop.setPixelRatio(ratio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private applyAutoRotate() {
    // À l'intérieur, la rotation automatique ferait tourner la vue sur elle-même.
    this.controls.autoRotate = this.autoRotate && !this.focused && !this.interior;
  }

  private flyTo(position: Vector3, target: Vector3, seconds = 1.6) {
    this.flight = {
      fromPosition: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPosition: position.clone(),
      toTarget: target.clone(),
      start: performance.now(),
      duration: seconds * 1000,
    };
    this.controls.enabled = false;
  }

  private readonly tick = (now: number) => {
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const time = now / 1000;

    this.updateFlight(now);
    this.updateMovement(delta);
    this.controls.update(delta);

    const insideTarget = this.brain.insideFactor(this.camera.position);
    this.inside += (insideTarget - this.inside) * Math.min(1, delta * 6);
    this.brain.setInside(this.inside);
    this.updateInterior();

    this.field?.update(time, delta);
    this.backdrop.update(time);
    this.updateHover();
    this.composer.render(delta);
  };

  private updateFlight(now: number) {
    const flight = this.flight;
    if (!flight) return;

    const progress = MathUtils.clamp((now - flight.start) / flight.duration, 0, 1);
    const eased = easeInOutCubic(progress);
    this.camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
    this.controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);

    if (progress >= 1) {
      this.flight = undefined;
      this.controls.enabled = true;
    }
  }

  /**
   * Dans le cerveau, la caméra passe en « première personne » : sa cible est juste devant elle, donc la souris
   * fait pivoter la vue sur place. Dehors, la cible revient vers le cerveau pour orbiter autour de lui.
   * Pendant un vol, on ne change rien : la cible est celle du neurone visé.
   */
  private updateInterior() {
    const wasInterior = this.interior;
    if (!this.interior && this.inside > ENTER_THRESHOLD) this.interior = true;
    else if (this.interior && this.inside < LEAVE_THRESHOLD) this.interior = false;
    if (this.interior === wasInterior) return;

    this.applyAutoRotate();
    if (this.flight) return;
    if (this.interior) this.aimTargetAhead();
    else this.aimTargetAtBrain();
  }

  /** Place la cible juste devant la caméra, sans changer ce qu'elle regarde. */
  private aimTargetAhead() {
    const forward = this.camera.getWorldDirection(new Vector3());
    this.controls.target.copy(this.camera.position).addScaledVector(forward, FIRST_PERSON_DISTANCE);
  }

  /** Replace la cible sur la ligne de visée, à la hauteur du cerveau, sans changer ce qu'elle regarde. */
  private aimTargetAtBrain() {
    const forward = this.camera.getWorldDirection(new Vector3());
    const distance = Math.max(OVERVIEW_TARGET.clone().sub(this.camera.position).dot(forward), 4 * BRAIN_SCALE);
    this.controls.target.copy(this.camera.position).addScaledVector(forward, distance);
  }

  /** Molette dans le cerveau : on avance / recule dans la direction du regard, avec un léger amorti. */
  private readonly onWheel = (event: WheelEvent) => {
    if (!this.interior || this.flight) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 20 : event.deltaY;
    this.glide -= MathUtils.clamp(pixels, -200, 200) * WHEEL_STEP;
  };

  /** Déplacements : clavier et molette (dans le cerveau). La caméra et sa cible avancent ensemble. */
  private updateMovement(delta: number) {
    if (this.flight) return;

    const forward = this.camera.getWorldDirection(new Vector3());

    if (this.glide) {
      const step = Math.abs(this.glide) < 0.001 ? this.glide : this.glide * Math.min(1, delta * 8);
      this.glide -= step;
      this.camera.position.addScaledVector(forward, step);
      this.controls.target.addScaledVector(forward, step);
    }
    if (!this.held.size) return;

    const right = new Vector3().crossVectors(forward, this.camera.up).normalize();
    const move = new Vector3();

    for (const action of this.held) {
      switch (action) {
        case 'forward': move.add(forward); break;
        case 'back': move.sub(forward); break;
        case 'right': move.add(right); break;
        case 'left': move.sub(right); break;
        case 'up': move.y += 1; break;
        case 'down': move.y -= 1; break;
      }
    }
    if (!move.lengthSq()) return;

    move.normalize().multiplyScalar(MOVE_SPEED * delta);
    this.camera.position.add(move);
    this.controls.target.add(move);
  }

  private updateHover() {
    if (!this.hoverDirty || this.flight) return;
    this.hoverDirty = false;

    const pointer = this.pointer;
    const id = pointer && !this.pointerDown ? this.pick(pointer.x, pointer.y) : null;
    this.setHovered(id, pointer);
  }

  private pick(x: number, y: number): string | null {
    const { width, height } = this.canvasSize();
    this.camera.updateMatrixWorld();
    return this.field?.pick(this.camera, x, y, width, height) ?? null;
  }

  private setHovered(id: string | null, pointer: { x: number; y: number } | null = null) {
    this.field?.setHovered(id);
    this.options.canvas.style.cursor = id ? 'pointer' : '';
    if (id !== this.hoveredId || id) {
      this.options.onHover(id && pointer ? { id, x: pointer.x, y: pointer.y } : null);
    }
    this.hoveredId = id;
  }

  private localPoint(event: PointerEvent) {
    const rect = this.options.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.pointerDown = { ...this.localPoint(event), time: performance.now() };
    this.hoverDirty = true;
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    this.pointer = this.localPoint(event);
    this.hoverDirty = true;
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const down = this.pointerDown;
    this.pointerDown = undefined;
    if (!down || event.button !== 0) return;

    const up = this.localPoint(event);
    const moved = Math.hypot(up.x - down.x, up.y - down.y);
    if (moved > CLICK_MAX_DRAG || performance.now() - down.time > CLICK_MAX_MS) return;

    const id = this.pick(up.x, up.y);
    if (id) this.options.onSelect(id);
  };

  private readonly onPointerLeave = () => {
    this.pointer = null;
    this.pointerDown = undefined;
    this.hoverDirty = true;
  };

  private isKeyboardTarget(event: KeyboardEvent) {
    return event.target === document.body || event.target === this.options.canvas;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const action = MOVE_KEYS[event.code];
    if (this.paused || !action || event.ctrlKey || event.metaKey || event.altKey || !this.isKeyboardTarget(event)) return;
    event.preventDefault();
    this.held.add(action);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    const action = MOVE_KEYS[event.code];
    if (action) this.held.delete(action);
  };

  private readonly onBlur = () => this.held.clear();
}
