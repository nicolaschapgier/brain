/** Avant cette année, une date est une faute de frappe (ou une horloge d'appareil mal réglée). */
export const EARLIEST_YEAR = 1990;

export const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

/**
 * `2023-02-11` devient « 11 février 2023 » et `2023-02` « février 2023 » ; une année seule (`2023`) et tout autre texte
 * (« Été 2022 »…) sont affichés tels quels.
 */
export function formatMemoryDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(`${value}-01T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  return value;
}

/** Une date saisie en trois morceaux : l'année suffit, le mois et le jour sont facultatifs. */
export interface DateParts {
  year: number | null;
  month: number | null;
  day: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Le texte enregistré dans le champ `date` d'un souvenir : `2023`, `2023-02` ou `2023-02-11`, selon ce qui est connu.
 * Sans année, pas de date (un mois ou un jour seuls ne veulent rien dire).
 */
export function buildDate({ year, month, day }: DateParts): string | undefined {
  if (year === null) return undefined;
  if (month === null) return String(year);
  return day === null ? `${year}-${pad(month)}` : `${year}-${pad(month)}-${pad(day)}`;
}

/** L'inverse de `buildDate`, pour ce qui a la forme `AAAA`, `AAAA-MM` ou `AAAA-MM-JJ` ; sinon tout est inconnu. */
export function splitDate(value: string | undefined | null): DateParts {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value ?? '');
  if (!match) return { year: null, month: null, day: null };
  return {
    year: Number(match[1]),
    month: match[2] ? Number(match[2]) : null,
    day: match[3] ? Number(match[3]) : null,
  };
}

export type DateProblem = 'day-without-month' | 'impossible' | 'future';

/** Ce qui cloche dans une date saisie (hors année manquante ou absurde, vue par le champ lui-même), ou `null`. */
export function dateProblem({ year, month, day }: DateParts, now = new Date()): DateProblem | null {
  if (year === null) return null;
  if (day !== null && month === null) return 'day-without-month';
  if (month !== null && (month < 1 || month > 12)) return 'impossible';
  if (day !== null && month !== null && (day < 1 || day > new Date(year, month, 0).getDate())) return 'impossible';

  // Comparaison au jour près, sur ce qui est connu : « août 2026 » n'est pas dans le futur en août 2026.
  const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  const known = [year, month ?? 1, day ?? 1] as const;
  const current = [today.year, month === null ? 1 : today.month, day === null ? 1 : today.day] as const;
  for (let i = 0; i < 3; i++) {
    if (known[i] > current[i]) return 'future';
    if (known[i] < current[i]) return null;
  }
  return null;
}
