import { ImageFocus } from '../../core/memory.model';

/** Forme du cadre de la photo sur une carte (voir `.photo` dans `memory-card.scss`). */
export const FRAME_RATIO = 16 / 10;

interface Size {
  width: number;
  height: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Ce que la photo déborde du cadre, en pixels, quand elle le remplit en étant recadrée (`object-fit: cover`). */
export function coverOverflow(image: Size, frame: Size): { x: number; y: number } {
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  return {
    x: Math.max(0, image.width * scale - frame.width),
    y: Math.max(0, image.height * scale - frame.height),
  };
}

/** Vrai si le cadrage change quelque chose : une photo qui a la forme du cadre ne peut pas être déplacée. */
export function isMovable(image: Size, ratio = FRAME_RATIO): boolean {
  return Math.abs(image.width / image.height - ratio) > 0.01;
}

/**
 * Le point de cadrage après avoir tiré la photo de (dx, dy) pixels depuis `start`. La photo suit le doigt : la fenêtre
 * qui la regarde va donc en sens inverse. Sur un axe où la photo ne déborde pas, rien ne bouge.
 */
export function dragFocus(start: ImageFocus, dx: number, dy: number, overflow: { x: number; y: number }): ImageFocus {
  const move = (from: number, delta: number, over: number) =>
    over < 1 ? from : clamp(from - (delta / over) * 100, 0, 100);
  return [move(start[0], dx, overflow.x), move(start[1], dy, overflow.y)];
}

/** Décale le point de cadrage (flèches du clavier), en pourcentage. */
export function nudgeFocus(focus: ImageFocus, dx: number, dy: number): ImageFocus {
  return [clamp(focus[0] + dx, 0, 100), clamp(focus[1] + dy, 0, 100)];
}
