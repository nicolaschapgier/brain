import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { transparentFraction } from './scratch-coverage';

/** Part de la pellicule à gratter pour que le souvenir se dévoile de lui-même. */
const REVEAL_THRESHOLD = 0.5;
/** Rayon du grattage, en pixels CSS. */
const BRUSH_RADIUS = 17;
/** Le taux gratté est mesuré tous les N mouvements de pointeur (la mesure relit l'image, on ne la fait pas à chaque pixel). */
const MEASURE_EVERY = 6;
/** Durée de la disparition de la pellicule une fois le seuil atteint (voir le style). */
const FADE_MS = 600;
const PROBE_SIZE = 32;

const SYMBOL_FONT = "'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif";
const TITLE_FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";

/**
 * Pellicule argentée à gratter, façon jeu à gratter, qui recouvre le contenu d'une carte. On gratte à la souris ou au
 * doigt ; passé la moitié, le reste disparaît tout seul. Il n'y a volontairement aucun moyen de tout révéler d'un clic.
 */
@Component({
  selector: 'app-scratch-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scratch-cover.html',
  styleUrl: './scratch-cover.scss',
})
export class ScratchCover {
  /** Émis dès que la carte est assez grattée : c'est le moment où le souvenir devient connu. */
  readonly uncovered = output<void>();
  /** Émis quand la pellicule a fini de disparaître : elle peut être retirée du DOM. */
  readonly finished = output<void>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly done = signal(false);

  private ctx!: CanvasRenderingContext2D;
  private probe!: CanvasRenderingContext2D;
  private scale = 1;
  private scratching = false;
  private touched = false;
  private moves = 0;
  private last: { x: number; y: number } | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      this.ctx = canvas.getContext('2d')!;
      this.probe = Object.assign(document.createElement('canvas'), { width: PROBE_SIZE, height: PROBE_SIZE }).getContext('2d', {
        willReadFrequently: true,
      })!;

      // La taille suit celle de l'élément (hors transformations : la carte s'incline et arrive en zoomant).
      const observer = new ResizeObserver(() => this.resize());
      observer.observe(canvas);
      this.resize();

      // La police du titre peut arriver après le premier dessin : on repeint tant que rien n'est gratté.
      document.fonts?.load(`italic 800 40px ${TITLE_FONT}`).then(() => {
        if (!this.touched && !this.done()) this.paintFoil();
      });

      destroyRef.onDestroy(() => {
        observer.disconnect();
        clearTimeout(this.timer);
      });
    });
  }

  protected start(event: PointerEvent) {
    if (this.done() || event.button > 0) return;
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    this.scratching = true;
    this.last = null;
    this.scratch(event);
  }

  protected move(event: PointerEvent) {
    if (!this.scratching) return;
    this.scratch(event);
  }

  protected stop() {
    if (!this.scratching) return;
    this.scratching = false;
    this.last = null;
    this.measure();
  }

  /** Dévoile le souvenir : appelé une fois la part de pellicule grattée suffisante. */
  private uncover() {
    if (this.done()) return;
    this.done.set(true);
    this.uncovered.emit();
    this.timer = setTimeout(() => this.finished.emit(), FADE_MS);
  }

  private scratch(event: PointerEvent) {
    const canvas = this.canvas().nativeElement;
    // `offsetX/Y` est exprimé dans le repère de l'élément, donc juste même si la carte est inclinée ou en train d'arriver.
    const factor = canvas.width / (canvas.offsetWidth || 1);
    const point = { x: event.offsetX * factor, y: event.offsetY * factor };

    const ctx = this.ctx;
    // « destination-out » efface en proportion de l'opacité du trait : il doit être totalement opaque pour tout enlever.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#000';
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = BRUSH_RADIUS * 2 * this.scale;
    ctx.beginPath();
    ctx.moveTo(this.last?.x ?? point.x, this.last?.y ?? point.y);
    ctx.lineTo(point.x + 0.01, point.y);
    ctx.stroke();

    this.last = point;
    this.touched = true;
    if (++this.moves % MEASURE_EVERY === 0) this.measure();
  }

  /** Mesure la part grattée sur une copie réduite de l'image, bien plus rapide qu'une lecture pixel par pixel. */
  private measure() {
    if (this.done()) return;
    const canvas = this.canvas().nativeElement;
    this.probe.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE);
    this.probe.drawImage(canvas, 0, 0, PROBE_SIZE, PROBE_SIZE);
    const { data } = this.probe.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE);
    if (transparentFraction(data) >= REVEAL_THRESHOLD) this.uncover();
  }

  private resize() {
    const canvas = this.canvas().nativeElement;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (!width || !height) return;

    this.scale = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * this.scale);
    const h = Math.round(height * this.scale);
    if (canvas.width === w && canvas.height === h) return;

    if (!this.touched) {
      canvas.width = w;
      canvas.height = h;
      this.paintFoil();
      return;
    }

    // Déjà gratté : on garde le grattage, redimensionné (approximatif, mais on ne perd pas la progression).
    const copy = Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height });
    copy.getContext('2d')!.drawImage(canvas, 0, 0);
    canvas.width = w;
    canvas.height = h;
    this.ctx.drawImage(copy, 0, 0, w, h);
  }

  /** La feuille argentée : dégradé métallique, reflets en biais, grain fin, fleurs de lys en filigrane, et « GRATTEZ ». */
  private paintFoil() {
    const ctx = this.ctx;
    const { width: w, height: h } = ctx.canvas;
    const s = this.scale;
    const rand = mulberry32(42);

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);

    const metal = ctx.createLinearGradient(0, 0, w, h);
    for (const [stop, color] of [
      [0, '#aab0bb'],
      [0.22, '#eceef2'],
      [0.48, '#9ca2ae'],
      [0.74, '#e6e8ec'],
      [1, '#a4a9b4'],
    ] as const) {
      metal.addColorStop(stop, color);
    }
    ctx.fillStyle = metal;
    ctx.fillRect(0, 0, w, h);

    // Reflets en biais, comme sur du métal brossé.
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.55);
    for (let x = -w; x < w; x += 92 * s) {
      const band = ctx.createLinearGradient(x, 0, x + 46 * s, 0);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.5, 'rgba(255,255,255,0.34)');
      band.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = band;
      ctx.fillRect(x, -h, 46 * s, h * 2);
    }
    ctx.restore();

    // Grain fin.
    for (let i = 0; i < (w * h) / 55; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(20,24,40,0.11)';
      ctx.fillRect(rand() * w, rand() * h, s, s);
    }

    // Filigrane : fleurs de lys du Berry, en quinconce.
    ctx.fillStyle = 'rgba(26, 63, 150, 0.2)';
    ctx.font = `${30 * s}px ${SYMBOL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = 58 * s;
    for (let row = 0, y = step / 2; y < h + step; row++, y += step) {
      for (let x = (row % 2) * (step / 2); x < w + step; x += step) ctx.fillText('⚜', x, y);
    }

    // Cartouche central pour le texte, puis « GRATTEZ ! », gravé (reflet clair décalé sous le texte sombre).
    const bandHeight = 92 * s;
    ctx.fillStyle = 'rgba(236, 238, 242, 0.86)';
    ctx.fillRect(0, h / 2 - bandHeight / 2, w, bandHeight);
    ctx.fillStyle = 'rgba(12, 31, 85, 0.5)';
    ctx.fillRect(0, h / 2 - bandHeight / 2, w, 3 * s);
    ctx.fillRect(0, h / 2 + bandHeight / 2 - 3 * s, w, 3 * s);

    ctx.font = `italic 800 ${56 * s}px ${TITLE_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('GRATTEZ !', w / 2 + s, h / 2 - 8 * s + s);
    ctx.fillStyle = '#c8202f';
    ctx.fillText('GRATTEZ !', w / 2, h / 2 - 8 * s);
    ctx.font = `italic 700 ${20 * s}px ${TITLE_FONT}`;
    ctx.fillStyle = '#0c1f55';
    ctx.fillText('POUR DÉCOUVRIR LE SOUVENIR', w / 2, h / 2 + 26 * s);

    // Biseau autour de la pellicule.
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeRect(2 * s, 2 * s, w - 4 * s, h - 4 * s);
    ctx.strokeStyle = 'rgba(12, 31, 85, 0.3)';
    ctx.strokeRect(5 * s, 5 * s, w - 10 * s, h - 10 * s);
  }
}

/** Générateur pseudo-aléatoire déterministe : le grain de la pellicule est identique à chaque ouverture. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
