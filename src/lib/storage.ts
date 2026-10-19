import type { AppData, Goal, ImmoSettings, PeaHolding, Recurring } from '../types';
import { monthKey, uid } from './format';

const KEY = 'patrimoine-data-v2';

export const DEFAULT_CATS = [
  { id: 'sorties', name: 'Sorties' },
  { id: 'culture', name: 'Culture' },
  { id: 'sport', name: 'Sport' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'voyages', name: 'Voyages' },
  { id: 'autre', name: 'Autre' },
];

export const DEFAULT_IMMO: ImmoSettings = {
  price: 220000,
  downPayment: 25000,
  notaryRate: 8,
  agencyFees: 6000,
  renovationBudget: 5000,
  loanRate: 3.5,
  loanDurationYears: 25,
  rentMonthly: 950,
  chargesMonthly: 110,
  insuranceMonthly: 25,
  propertyTaxYearly: 1100,
};

export const emptyData = (): AppData => ({
  version: 2,
  settings: { pinHash: '', targetLeisure: 300, targetInvest: 600, lifeBudget: 400, setupDone: false, startMonth: monthKey(new Date()) },
  recurring: [],
  entries: [],
  cats: DEFAULT_CATS,
  rules: [],
  goals: [],
  contributions: [],
  closes: [],
  pea: { openDate: '', holdings: [] },
  immo: DEFAULT_IMMO,
});

const normalize = (raw: Partial<AppData> | null): AppData => {
  const base = emptyData();
  if (!raw || raw.version !== 2) return base;
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...raw.settings },
    pea: { ...base.pea, ...raw.pea },
    immo: { ...base.immo, ...raw.immo },
    cats: raw.cats?.length ? raw.cats : base.cats,
  } as AppData;
};

export const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(KEY);
    return normalize(raw ? (JSON.parse(raw) as AppData) : null);
  } catch {
    return emptyData();
  }
};

export const saveData = (data: AppData): boolean => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

export const clearData = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien à effacer */
  }
};

/** Demande au navigateur de ne pas effacer les données de l'application pour libérer de l'espace. */
export const askPersistence = async (): Promise<void> => {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* non disponible */
  }
};

export const backupFileName = (): string => `patrimoine-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;

export const exportJson = (data: AppData): string => JSON.stringify(data, null, 2);

/** Ancien format (version 1 de l'application) : on reprend ce qui garde du sens dans la nouvelle. */
interface V1 {
  profile?: { monthlySafetyContribution?: number };
  categories?: { id: string; type: string }[];
  recurrences?: { id: string; description: string; amount: number; kind: string; categoryId?: string; dayOfMonth?: number; isActive?: boolean; frequency?: string }[];
  goals?: { id: string; name: string; targetAmount: number; targetDate: string }[];
  peaSettings?: { openDate: string };
  peaHoldings?: PeaHolding[];
  immoSettings?: ImmoSettings;
}

export type ImportOutcome = { ok: true; data: AppData; note: string } | { ok: false; error: string };

export const importJson = (text: string, current: AppData): ImportOutcome => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde lisible (JSON invalide)." };
  }
  const obj = parsed as Partial<AppData>;
  const v1 = parsed as V1;
  if (obj.version === 2 && obj.settings) {
    // Le code d'accès de l'appareil actuel est conservé.
    const data = normalize(obj);
    return { ok: true, data: { ...data, settings: { ...data.settings, pinHash: current.settings.pinHash || data.settings.pinHash } }, note: 'Sauvegarde restaurée.' };
  }
  if (v1.recurrences || v1.peaHoldings || v1.goals) {
    const typeOf = new Map((v1.categories ?? []).map((c) => [c.id, c.type]));
    const recurring: Recurring[] = (v1.recurrences ?? [])
      .filter((r) => r.frequency !== 'weekly' && r.kind !== 'transfer')
      .map((r) => ({
        id: uid(),
        label: r.description,
        amount: Math.abs(r.amount),
        kind: r.kind === 'income' ? 'income' : typeOf.get(r.categoryId ?? '') === 'safety' ? 'safety' : 'fixed',
        day: r.dayOfMonth ?? 1,
        active: r.isActive !== false,
      }));
    const goals: Goal[] = (v1.goals ?? []).map((g) => ({
      id: uid(),
      name: g.name,
      target: g.targetAmount,
      saved: 0,
      deadline: g.targetDate.slice(0, 7),
      plan: 0,
    }));
    return {
      ok: true,
      data: {
        ...current,
        recurring: [...current.recurring, ...recurring],
        goals: [...current.goals, ...goals],
        pea: { openDate: v1.peaSettings?.openDate ?? current.pea.openDate, holdings: v1.peaHoldings ?? current.pea.holdings },
        immo: { ...current.immo, ...(v1.immoSettings ?? {}) },
      },
      note: `Ancienne version importée : ${recurring.length} opérations récurrentes, ${goals.length} objectifs, PEA et simulation immobilière. Vérifie les montants déjà épargnés de tes objectifs.`,
    };
  }
  return { ok: false, error: "Ce fichier ne ressemble pas à une sauvegarde de l'application." };
};
