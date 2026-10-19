/** Nature d'une opération, du point de vue du budget. */
export type Kind =
  | 'income' // revenu récurrent (salaire)
  | 'fixed' // charge fixe récurrente
  | 'safety' // épargne de sécurité programmée
  | 'life' // vie courante (couverte par le forfait mensuel)
  | 'leisure' // loisirs : la seule dépense saisie au quotidien
  | 'exception' // dépense exceptionnelle, déduite de l'investissement
  | 'extra' // revenu exceptionnel, ajouté à l'investissement
  | 'ignore'; // virement interne, sans effet sur le budget

export type RecurringKind = 'income' | 'fixed' | 'safety';

export interface Recurring {
  id: string;
  label: string;
  amount: number;
  kind: RecurringKind;
  /** Jour du mois où l'opération tombe habituellement. */
  day: number;
  active: boolean;
}

export interface Entry {
  id: string;
  /** Date locale au format AAAA-MM-JJ. */
  date: string;
  label: string;
  amount: number;
  kind: Kind;
  /** Sous-catégorie de loisirs. */
  cat?: string;
  source: 'manual' | 'import';
  /** Libellé brut du relevé bancaire, pour les opérations importées. */
  raw?: string;
}

export interface LeisureCat {
  id: string;
  name: string;
}

/** Règle de rangement apprise lors du point du mois. */
export interface Rule {
  id: string;
  pattern: string;
  kind: Kind;
  cat?: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** Échéance au format AAAA-MM. */
  deadline: string;
  /** Montant prévu chaque mois. */
  plan: number;
  /** Alimenté automatiquement par l'épargne de sécurité. */
  fromSafety?: boolean;
}

export interface Contribution {
  goalId: string; // 'pea' pour le PEA
  month: string; // AAAA-MM
  amount: number;
}

export interface ClosedRecurring {
  id: string;
  label: string;
  kind: RecurringKind;
  amount: number;
  happened: boolean;
}

export interface MonthClose {
  month: string;
  income: number;
  fixed: number;
  safety: number;
  life: number;
  leisure: number;
  exception: number;
  extra: number;
  invest: number;
  recurring: ClosedRecurring[];
  allocations: { target: string; label: string; amount: number }[];
  closedAt: string;
}

export interface Settings {
  pinHash: string;
  targetLeisure: number;
  targetInvest: number;
  /** Forfait mensuel de vie courante (courses, carburant…), non suivi au quotidien. */
  lifeBudget: number;
  setupDone: boolean;
  /** Premier mois suivi, AAAA-MM. Aucun point du mois n'est demandé avant. */
  startMonth: string;
  /** Données d'exemple pour une démonstration. */
  demo?: boolean;
}

export interface PeaHolding {
  id: string;
  name: string;
  isin: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
}

export interface ImmoSettings {
  price: number;
  downPayment: number;
  notaryRate: number;
  agencyFees: number;
  renovationBudget: number;
  loanRate: number;
  loanDurationYears: number;
  rentMonthly: number;
  chargesMonthly: number;
  insuranceMonthly: number;
  propertyTaxYearly: number;
}

export interface AppData {
  version: 2;
  settings: Settings;
  recurring: Recurring[];
  entries: Entry[];
  cats: LeisureCat[];
  rules: Rule[];
  goals: Goal[];
  contributions: Contribution[];
  closes: MonthClose[];
  pea: { openDate: string; holdings: PeaHolding[] };
  immo: ImmoSettings;
}
