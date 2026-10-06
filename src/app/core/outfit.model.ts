/** Une tenue du vestiaire : une photo, un titre, et éventuellement une date et un mot dessus. */
export interface Outfit {
  id: string;
  title: string;
  description: string;
  /** URL ou chemin relatif (ex: `outfits/maillot-orange.svg`, résolu depuis `public/`). */
  image: string;
  /** Date libre, affichée telle quelle (ex: `2023-02-11` ou `Été 2022`). */
  date?: string;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Transforme le JSON brut en tenues valides (même logique que `parseMemories`). Accepte un tableau ou un objet
 * `{ "outfits": [...] }`. Les entrées sans titre sont ignorées (avec un warning), les identifiants manquants ou en
 * double sont générés.
 */
export function parseOutfits(raw: unknown): Outfit[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { outfits?: unknown } | null)?.outfits)
      ? (raw as { outfits: unknown[] }).outfits
      : [];

  const usedIds = new Set<string>();
  const outfits: Outfit[] = [];

  list.forEach((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const title = text(item['title']);
    if (!title) {
      console.warn(`[outfits] entrée n°${index + 1} ignorée : "title" manquant`, entry);
      return;
    }

    let id = text(item['id']) || `outfit-${index + 1}`;
    if (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);

    outfits.push({
      id,
      title,
      description: text(item['description']),
      image: text(item['image']),
      date: text(item['date']) || undefined,
    });
  });

  return outfits;
}
