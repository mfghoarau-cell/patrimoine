import type { AppData, Entry, Recurring } from '../types';
import { applyClose, closedRecurringDraft, monthResult } from './budget';
import { addMonths, daysInMonth, monthKey } from './format';
import { emptyData } from './storage';

/** Code d'accès des données d'exemple, affiché sur l'écran de verrouillage en mode démo. */
export const DEMO_PIN = '1234';

const RECURRING: Recurring[] = [
  { id: 'd-salaire', label: 'Salaire', amount: 2700, kind: 'income', day: 28, active: true },
  { id: 'd-transport', label: 'Transport', amount: 50, kind: 'fixed', day: 1, active: true },
  { id: 'd-epargne', label: 'Épargne de sécurité', amount: 300, kind: 'safety', day: 2, active: true },
  { id: 'd-loyer', label: 'Loyer', amount: 900, kind: 'fixed', day: 3, active: true },
  { id: 'd-elec', label: 'Électricité', amount: 65, kind: 'fixed', day: 5, active: true },
  { id: 'd-internet', label: 'Internet', amount: 30, kind: 'fixed', day: 5, active: true },
  { id: 'd-mobile', label: 'Forfait mobile', amount: 15, kind: 'fixed', day: 8, active: true },
  { id: 'd-assurance', label: 'Assurance habitation', amount: 25, kind: 'fixed', day: 10, active: true },
  { id: 'd-streaming', label: 'Streaming', amount: 12, kind: 'fixed', day: 12, active: true },
];

type Item = [day: number, label: string, cat: string, amount: number];

/** Loisirs d'un mois bouclé ; le dernier poste ajuste le total visé. */
const PAST: Item[] = [
  [2, 'Café', 'sorties', 3.2],
  [4, 'Piscine', 'sport', 4.5],
  [6, 'Restaurant', 'sorties', 34],
  [9, 'Cinéma', 'culture', 11.5],
  [11, 'Bar', 'sorties', 16.5],
  [13, 'Escalade', 'sport', 14],
  [16, 'Librairie', 'culture', 21.9],
  [18, 'Café', 'sorties', 3.2],
  [20, 'Restaurant', 'sorties', 41],
  [23, 'Jeu vidéo', 'shopping', 20],
  [25, 'Concert', 'culture', 35],
];

/** Mois en cours : un rythme un peu trop rapide, qui déclenche l'alerte vers le milieu du mois. */
const CURRENT: Item[] = [
  [1, 'Bar', 'sorties', 14.8],
  [3, 'Jeu vidéo', 'shopping', 20],
  [4, 'Piscine', 'sport', 4.5],
  [6, 'Restaurant', 'sorties', 29.4],
  [8, 'Café', 'sorties', 3.2],
  [10, 'Concert', 'culture', 35],
  [12, 'Bar', 'sorties', 17.5],
  [14, 'Librairie', 'culture', 22.9],
  [15, 'Escalade', 'sport', 14],
  [17, 'Restaurant', 'sorties', 38],
  [18, 'Cinéma', 'culture', 11.5],
  [19, 'Café', 'sorties', 3.2],
  [21, 'Bar', 'sorties', 16],
  [23, 'Restaurant', 'sorties', 32],
  [25, 'Cinéma', 'culture', 11.5],
  [27, 'Café', 'sorties', 3.2],
];

/** Loisirs saisis dans le mois à boucler : le relevé d'exemple ajoutera les oublis. */
const PENDING: Item[] = [
  [2, 'Café', 'sorties', 3.2],
  [5, 'Restaurant', 'sorties', 36.5],
  [9, 'Escalade', 'sport', 14],
  [12, 'Cinéma', 'culture', 11.5],
  [15, 'Bar', 'sorties', 18.4],
  [17, 'Concert', 'culture', 42],
  [19, 'Escalade', 'sport', 14],
  [22, 'Restaurant', 'sorties', 39.8],
  [24, 'Piscine', 'sport', 4.5],
  [26, 'Bar', 'sorties', 34.7],
];

const date = (month: string, day: number) => `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`;

const leisure = (month: string, items: Item[], prefix: string): Entry[] =>
  items.map(([day, label, cat, amount], i) => ({ id: `${prefix}-${i}`, date: date(month, day), label, cat, amount, kind: 'leisure', source: 'manual' }));

const withTotal = (month: string, total: number, prefix: string): Entry[] => {
  const entries = leisure(month, PAST, prefix);
  const sum = entries.reduce((a, e) => a + e.amount, 0);
  entries.push({ id: `${prefix}-x`, date: date(month, 27), label: 'Week-end', cat: 'voyages', amount: Math.round((total - sum) * 100) / 100, kind: 'leisure', source: 'manual' });
  return entries;
};

const groceries = (month: string, prefix: string): Entry[] => [
  { id: `${prefix}-c1`, date: date(month, 7), label: 'Carrefour market', amount: 96.1, kind: 'life', source: 'import', raw: 'CB CARREFOUR MARKET' },
  { id: `${prefix}-c2`, date: date(month, 21), label: 'Carrefour market', amount: 82.4, kind: 'life', source: 'import', raw: 'CB CARREFOUR MARKET' },
];

/**
 * Données fictives sur quatre mois, calées sur la date du jour :
 * trois mois bouclés (dont un où la cible d'investissement a été manquée),
 * le mois précédent à boucler en direct avec le relevé d'exemple, et le mois en cours en alerte.
 */
export const buildDemo = (today: Date, pinHash: string): AppData => {
  const current = monthKey(today);
  const m = (k: number) => addMonths(current, -k);
  let d: AppData = {
    ...emptyData(),
    settings: { pinHash, targetLeisure: 300, targetInvest: 600, lifeBudget: 400, setupDone: true, startMonth: m(4), demo: true },
    recurring: RECURRING,
    rules: [
      { id: 'd-r1', pattern: 'carrefour market', kind: 'life' },
      { id: 'd-r2', pattern: 'pathe', kind: 'leisure', cat: 'culture' },
    ],
    goals: [
      { id: 'japon', name: 'Voyage au Japon', target: 3000, saved: 400, deadline: addMonths(current, 8), plan: 250 },
      { id: 'apport', name: 'Apport immobilier', target: 25000, saved: 6200, deadline: addMonths(current, 50), plan: 200 },
      { id: 'matelas', name: 'Matelas de sécurité', target: 6000, saved: 3300, deadline: addMonths(current, 14), plan: 0, fromSafety: true },
    ],
    pea: {
      openDate: `${today.getFullYear() - 2}-01-15`,
      holdings: [
        { id: 'd-h1', name: 'ETF Monde', isin: '', quantity: 142, avgBuyPrice: 36.2, currentPrice: 43.1 },
        { id: 'd-h2', name: 'ETF Europe', isin: '', quantity: 58, avgBuyPrice: 35.4, currentPrice: 39.65 },
      ],
    },
  };

  // Trois mois bouclés : loisirs dépassés, puis deux mois tenus.
  const history: [number, number, number][] = [
    [4, 305, 68],
    [3, 262, 63],
    [2, 297, 66],
  ];
  history.forEach(([k, total, elec]) => {
    const month = m(k);
    d = { ...d, entries: [...d.entries, ...withTotal(month, total, `d${k}`), ...groceries(month, `d${k}`)] };
    const recurring = closedRecurringDraft(d.recurring).map((r) => (r.id === 'd-elec' ? { ...r, amount: elec } : r));
    const result = monthResult(d, month, recurring);
    const invest = Math.round(result.invest);
    const allocations = [
      { target: 'japon', label: 'Voyage au Japon', amount: 250 },
      { target: 'apport', label: 'Apport immobilier', amount: 200 },
      { target: 'pea', label: 'PEA', amount: Math.max(0, invest - 450) },
    ];
    d = applyClose(d, { month, ...result, recurring, allocations, closedAt: `${month}-28T20:00:00.000Z` });
  });

  // Mois à boucler, puis mois en cours jusqu'à aujourd'hui.
  const todayIso = date(current, today.getDate());
  d = {
    ...d,
    entries: [...d.entries, ...leisure(m(1), PENDING, 'd1'), ...leisure(current, CURRENT, 'd0').filter((e) => e.date <= todayIso)],
  };
  return d;
};

/** Relevé CSV d'exemple, au format d'un export bancaire, pour le mois à boucler. */
export const demoCsv = (month: string): string => {
  const [y, mo] = month.split('-');
  const dt = (day: number) => `${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}/${mo}/${y}`;
  return [
    'Compte courant;FR76 0000 0000 0000',
    `Relevé de ${month};`,
    'Date;Libellé;Débit euros;Crédit euros;',
    `${dt(1)};PRLV SEPA NAVIGO;50,00;;`,
    `${dt(2)};VIR EPARGNE LIVRET A;300,00;;`,
    `${dt(3)};PRLV SEPA LOYER AGENCE;900,00;;`,
    `${dt(5)};PRLV EDF;61,00;;`,
    `${dt(5)};PRLV BOX INTERNET;30,00;;`,
    `${dt(6)};CB CARREFOUR MARKET;88,30;;`,
    `${dt(8)};PRLV MOBILE;15,00;;`,
    `${dt(10)};PRLV ASSURANCE HABITATION;25,00;;`,
    `${dt(12)};PRLV STREAMING;12,00;;`,
    `${dt(13)};CB PATHE MONTPELLIER;11,50;;`,
    `${dt(14)};CB FNAC MONTPELLIER ${dt(13).slice(0, 5)};34,90;;`,
    `${dt(20)};CB CARREFOUR MARKET;91,70;;`,
    `${dt(21)};CB LE COMPTOIR ${dt(20).slice(0, 5)};27,50;;`,
    `${dt(26)};PRLV SEPA DECATHLON;59,99;;`,
    `${dt(28)};VIR SALAIRE ENTREPRISE;;2 700,00;`,
  ].join('\n');
};
