const money2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const eur = (n: number): string => money2.format(n);
export const eur0 = (n: number): string => money0.format(Math.round(n));

const pad = (n: number) => String(n).padStart(2, '0');

/** Date locale au format AAAA-MM-JJ (sans passer par l'UTC). */
export const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const parseMonth = (key: string): { y: number; m: number } => {
  const [y, m] = key.split('-').map(Number);
  return { y, m: m - 1 };
};

export const addMonths = (key: string, delta: number): string => {
  const { y, m } = parseMonth(key);
  return monthKey(new Date(y, m + delta, 1));
};

export const daysInMonth = (key: string): number => {
  const { y, m } = parseMonth(key);
  return new Date(y, m + 1, 0).getDate();
};

export const monthName = (key: string): string => {
  const { y, m } = parseMonth(key);
  return new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long' });
};

export const monthYear = (key: string): string => {
  const { y, m } = parseMonth(key);
  return new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const dayHeading = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return cap(new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
};

export const shortDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Lit un montant saisi à la française (« 12,50 », « 1 200 »). */
export const parseAmount = (value: string): number | null => {
  const compact = value.trim().replace(/[\s  €]/g, '');
  if (!compact) return null;
  let normalized = compact;
  if (compact.includes(',') && compact.includes('.')) {
    normalized = compact.lastIndexOf(',') > compact.lastIndexOf('.')
      ? compact.replace(/\./g, '').replace(',', '.')
      : compact.replace(/,/g, '');
  } else if (compact.includes(',')) {
    normalized = compact.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Texte normalisé pour comparer des libellés bancaires. */
export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
