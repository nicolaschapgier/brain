/**
 * Prépare une photo (le plus souvent prise avec un iPhone) avant de l'enregistrer : décodage (HEIC compris), redressement
 * d'après l'orientation EXIF, réduction et ré-encodage en JPEG. Le ré-encodage retire aussi les métadonnées, position GPS
 * comprise : les photos de tes amis ne partent pas avec le lieu où elles ont été prises.
 */

import { EARLIEST_YEAR } from '@core/memory-date';

export interface PreparedPhoto {
  /** La photo réduite, en JPEG, sous forme d'URL de données (utilisable telle quelle dans un `<img>`). */
  dataUrl: string;
  width: number;
  height: number;
}

export type PhotoErrorReason = 'not-an-image' | 'too-large' | 'unsupported' | 'failed';

/** Une photo refusée, avec un message prêt à être montré à la personne. */
export class PhotoError extends Error {
  constructor(
    readonly reason: PhotoErrorReason,
    message: string,
  ) {
    super(message);
  }
}

/** Plus grand côté de la photo enregistrée : assez pour une carte plein écran, assez léger pour l'album. */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
/** Une photo d'iPhone pèse 3 à 10 Mo ; au-delà, c'est presque sûrement autre chose. */
export const MAX_FILE_BYTES = 60 * 1024 * 1024;

/** Dimensions d'une image réduite pour que son plus grand côté ne dépasse pas `maxSide` (jamais agrandie). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Format HEIC / HEIF de l'iPhone. Certains navigateurs ne donnent pas de type pour ces fichiers : on regarde aussi le nom. */
export function isHeic(file: Pick<File, 'name' | 'type'>): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** `AAAA-MM-JJ` d'après le jour local de la date. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** La date lue dans une photo, si elle est plausible (ni avant 1990, ni dans le futur). */
export function plausibleDate(date: unknown, now = new Date()): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() < EARLIEST_YEAR || date.getTime() > now.getTime() + 24 * 3600 * 1000) return null;
  return toIsoDate(date);
}

/** La date de prise de vue inscrite dans la photo (JPEG comme HEIC), ou `null` si elle n'en a pas. */
export async function photoDateOf(file: File): Promise<string | null> {
  try {
    const { parse } = await import('exifr');
    const tags = await parse(file, ['DateTimeOriginal', 'CreateDate']);
    return plausibleDate(tags?.DateTimeOriginal ?? tags?.CreateDate);
  } catch {
    return null;
  }
}

/** Décode la photo, dans le bon sens. Chrome et Firefox ne lisent pas le HEIC : on le convertit alors en JPEG au préalable. */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (!isHeic(file)) {
      throw new PhotoError('unsupported', 'Ce format d’image n’est pas pris en charge. Essaie avec une photo JPEG ou PNG.');
    }
  }

  try {
    const module = await import('heic2any');
    const heic2any = module.default ?? module;
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    return await createImageBitmap(Array.isArray(converted) ? converted[0] : converted);
  } catch {
    throw new PhotoError('unsupported', 'Impossible de lire cette photo HEIC. Essaie de l’exporter en JPEG.');
  }
}

/** Réduit la photo et la ré-encode en JPEG (sans métadonnées). Lève une `PhotoError` avec un message lisible. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/') && !isHeic(file)) {
    throw new PhotoError('not-an-image', 'Ce fichier n’est pas une image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new PhotoError('too-large', 'Cette photo est trop lourde (60 Mo maximum).');
  }

  const bitmap = await decode(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError('failed', 'Impossible de préparer la photo sur cet appareil.');

    // Fond blanc : un PNG transparent deviendrait noir en JPEG.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    return { dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width, height };
  } finally {
    bitmap.close();
  }
}
