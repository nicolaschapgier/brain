/** `2023-02-11` devient « 11 février 2023 » ; tout autre texte (« Été 2022 »…) est affiché tel quel. */
export function formatMemoryDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
