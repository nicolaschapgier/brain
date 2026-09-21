/** Position normalisée dans le cerveau : chaque axe va de -1 à 1. */
export type BrainPosition = readonly [x: number, y: number, z: number];

/** Point de la photo à garder au centre quand elle est recadrée : x, y en pourcentage (0 : gauche / haut, 100 : droite / bas). */
export type ImageFocus = readonly [x: number, y: number];

/** Sans point de cadrage, un peu au-dessus du milieu : c'est là que sont les visages d'une photo en portrait. */
export const DEFAULT_FOCUS: ImageFocus = [50, 35];

export interface Memory {
  id: string;
  title: string;
  description: string;
  /** URL ou chemin relatif (ex: `memories/ski.svg`, résolu depuis `public/`). */
  image: string;
  /** Date libre, affichée telle quelle (ex: `2023-02-11` ou `Été 2022`). */
  date?: string;
  /**
   * Emplacement forcé du neurone. x : gauche(-)/droite(+), y : bas(-)/haut(+),
   * z : arrière(-)/avant(+). Sans ce champ, le neurone est placé automatiquement.
   */
  position?: BrainPosition;
  /**
   * Cadrage de la photo là où elle est recadrée (carte, autocollant de l'album) : le point à garder au centre,
   * `[x, y]` en pourcentage. La photo elle-même n'est jamais modifiée. Défaut : `DEFAULT_FOCUS`.
   */
  focus?: ImageFocus;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const clamp1 = (n: number) => clamp(n, -1, 1);

function parsePosition(raw: unknown): BrainPosition | undefined {
  if (!Array.isArray(raw) || raw.length !== 3) return undefined;
  const [x, y, z] = raw.map(Number);
  if (![x, y, z].every(Number.isFinite)) return undefined;
  return [clamp1(x), clamp1(y), clamp1(z)];
}

function parseFocus(raw: unknown): ImageFocus | undefined {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const [x, y] = raw.map(Number);
  if (![x, y].every(Number.isFinite)) return undefined;
  return [clamp(x, 0, 100), clamp(y, 0, 100)];
}

/** Valeur CSS `object-position` du cadrage d'un souvenir. */
export function objectPositionOf(memory: Pick<Memory, 'focus'>): string {
  const [x, y] = memory.focus ?? DEFAULT_FOCUS;
  return `${x}% ${y}%`;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Transforme le JSON brut en souvenirs valides. Accepte un tableau ou un objet
 * `{ "memories": [...] }`. Les entrées sans titre sont ignorées (avec un warning),
 * les identifiants manquants ou en double sont générés.
 */
export function parseMemories(raw: unknown): Memory[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { memories?: unknown } | null)?.memories)
      ? (raw as { memories: unknown[] }).memories
      : [];

  const usedIds = new Set<string>();
  const memories: Memory[] = [];

  list.forEach((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const title = text(item['title']);
    if (!title) {
      console.warn(`[memories] entrée n°${index + 1} ignorée : "title" manquant`, entry);
      return;
    }

    let id = text(item['id']) || `memory-${index + 1}`;
    if (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);

    memories.push({
      id,
      title,
      description: text(item['description']),
      image: text(item['image']),
      date: text(item['date']) || undefined,
      position: parsePosition(item['position']),
      focus: parseFocus(item['focus']),
    });
  });

  return memories;
}
