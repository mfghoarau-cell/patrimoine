import type { AppData, ClosedRecurring, Entry, Goal, MonthClose, Recurring } from '../types';
import { addMonths, daysInMonth, monthKey } from './format';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const inMonth = (e: Entry, month: string) => e.date.startsWith(month);

export const recurringTotals = (recurring: Recurring[]) => {
  const active = recurring.filter((r) => r.active);
  return {
    income: sum(active.filter((r) => r.kind === 'income').map((r) => r.amount)),
    fixed: sum(active.filter((r) => r.kind === 'fixed').map((r) => r.amount)),
    safety: sum(active.filter((r) => r.kind === 'safety').map((r) => r.amount)),
  };
};

/** Ce qui reste à partager entre loisirs et investissement, d'après la configuration. */
export const plannedAvailable = (data: AppData): number => {
  const t = recurringTotals(data.recurring);
  return t.income - t.fixed - t.safety - data.settings.lifeBudget;
};

/** Nombre de jours écoulés avant de projeter le rythme des loisirs : en dessous, la projection serait trompeuse. */
export const MIN_DAYS_FOR_PROJECTION = 7;

export type Trend = 'ok' | 'warn' | 'bad';

export interface MonthStatus {
  month: string;
  day: number;
  days: number;
  daysLeft: number; // jours restants, aujourd'hui compris
  available: number;
  spent: number; // loisirs du mois
  exception: number;
  extra: number;
  projectedLeisure: number;
  projectedInvest: number;
  /** Loisirs encore possibles par jour pour tenir la cible d'investissement. */
  perDay: number;
  leisureLeft: number;
  expectedToday: number;
  trend: Trend;
  projected: boolean;
}

export const monthStatus = (data: AppData, today: Date): MonthStatus => {
  const month = monthKey(today);
  const day = today.getDate();
  const days = daysInMonth(month);
  const entries = data.entries.filter((e) => inMonth(e, month));
  const spent = sum(entries.filter((e) => e.kind === 'leisure').map((e) => e.amount));
  const exception = sum(entries.filter((e) => e.kind === 'exception').map((e) => e.amount));
  const extra = sum(entries.filter((e) => e.kind === 'extra').map((e) => e.amount));
  const available = plannedAvailable(data) + extra - exception;
  const { targetLeisure, targetInvest } = data.settings;

  const projected = day >= MIN_DAYS_FOR_PROJECTION;
  const projectedLeisure = projected ? (spent / day) * days : Math.max(spent, targetLeisure);
  const projectedInvest = available - projectedLeisure;
  const daysLeft = days - day + 1;
  const roomForTarget = available - targetInvest - spent;
  const perDay = Math.max(0, roomForTarget / daysLeft);

  let trend: Trend = 'ok';
  if (projectedInvest < targetInvest) trend = roomForTarget <= 0 ? 'bad' : 'warn';

  return {
    month,
    day,
    days,
    daysLeft,
    available,
    spent,
    exception,
    extra,
    projectedLeisure,
    projectedInvest,
    perDay,
    leisureLeft: targetLeisure - spent,
    expectedToday: (targetLeisure * day) / days,
    trend,
    projected,
  };
};

/** Mois dont le point reste à faire : le mois précédent, s'il est suivi et pas encore bouclé. */
export const pendingReviewMonth = (data: AppData, today: Date): string | null => {
  const prev = addMonths(monthKey(today), -1);
  if (!data.settings.setupDone || prev < data.settings.startMonth) return null;
  if (data.closes.some((c) => c.month === prev)) return null;
  return prev;
};

export const closedRecurringDraft = (recurring: Recurring[]): ClosedRecurring[] =>
  recurring
    .filter((r) => r.active)
    .sort((a, b) => a.day - b.day)
    .map((r) => ({ id: r.id, label: r.label, kind: r.kind, amount: r.amount, happened: true }));

export interface MonthResult {
  income: number;
  fixed: number;
  safety: number;
  life: number;
  lifeSpent: number;
  leisure: number;
  exception: number;
  extra: number;
  invest: number;
}

/** Bilan réel d'un mois, à partir des opérations récurrentes confirmées et des opérations saisies ou importées. */
export const monthResult = (data: AppData, month: string, recurring: ClosedRecurring[]): MonthResult => {
  const happened = recurring.filter((r) => r.happened);
  const entries = data.entries.filter((e) => inMonth(e, month));
  const byKind = (k: Entry['kind']) => sum(entries.filter((e) => e.kind === k).map((e) => e.amount));
  const income = sum(happened.filter((r) => r.kind === 'income').map((r) => r.amount));
  const fixed = sum(happened.filter((r) => r.kind === 'fixed').map((r) => r.amount));
  const safety = sum(happened.filter((r) => r.kind === 'safety').map((r) => r.amount));
  const lifeSpent = byKind('life');
  // Le forfait de vie courante est réservé quoi qu'il arrive ; seul un dépassement réduit l'investissement.
  const life = Math.max(data.settings.lifeBudget, lifeSpent);
  const leisure = byKind('leisure');
  const exception = byKind('exception');
  const extra = byKind('extra');
  const invest = income + extra - fixed - safety - life - leisure - exception;
  return { income, fixed, safety, life, lifeSpent, leisure, exception, extra, invest };
};

export const monthsUntil = (deadline: string, from: Date): number => {
  const [y, m] = deadline.split('-').map(Number);
  return Math.max(1, (y - from.getFullYear()) * 12 + (m - 1 - from.getMonth()) + 1);
};

export type GoalState = { tone: 'ok' | 'warn' | 'neutral'; label: string; needed: number };

export const goalState = (goal: Goal, from: Date, plan = goal.plan): GoalState => {
  const left = Math.max(0, goal.target - goal.saved);
  const needed = left / monthsUntil(goal.deadline, from);
  if (left === 0) return { tone: 'ok', label: 'Atteint', needed: 0 };
  if (goal.fromSafety) return { tone: 'neutral', label: 'Automatique', needed };
  if (plan >= needed * 1.2) return { tone: 'ok', label: 'En avance', needed };
  if (plan >= needed) return { tone: 'ok', label: 'À portée', needed };
  return { tone: 'warn', label: 'À ajuster', needed };
};

/** Applique la clôture d'un mois : objectifs alimentés, versements tracés. */
export const applyClose = (data: AppData, close: MonthClose): AppData => {
  const safetyDone = sum(close.recurring.filter((r) => r.kind === 'safety' && r.happened).map((r) => r.amount));
  const goals = data.goals.map((g) => {
    const alloc = close.allocations.find((a) => a.target === g.id)?.amount ?? 0;
    const fromSafety = g.fromSafety ? safetyDone : 0;
    return { ...g, saved: Math.round((g.saved + alloc + fromSafety) * 100) / 100 };
  });
  const contributions = [
    ...data.contributions.filter((c) => c.month !== close.month),
    ...close.allocations.filter((a) => a.amount > 0).map((a) => ({ goalId: a.target, month: close.month, amount: a.amount })),
    ...data.goals.filter((g) => g.fromSafety && safetyDone > 0).map((g) => ({ goalId: g.id, month: close.month, amount: safetyDone })),
  ];
  return { ...data, goals, contributions, closes: [...data.closes.filter((c) => c.month !== close.month), close] };
};

/** Dépenses de loisirs fréquentes, proposées en favoris dans la saisie express. */
export const learnedFavorites = (entries: Entry[], today: Date, max = 4) => {
  const since = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90);
  const counts = new Map<string, { label: string; cat?: string; amount: number; n: number }>();
  entries
    .filter((e) => e.kind === 'leisure' && e.source === 'manual' && new Date(e.date) >= since)
    .forEach((e) => {
      const key = `${e.label}|${e.amount.toFixed(2)}|${e.cat ?? ''}`;
      const cur = counts.get(key);
      if (cur) cur.n += 1;
      else counts.set(key, { label: e.label, cat: e.cat, amount: e.amount, n: 1 });
    });
  return [...counts.values()].filter((f) => f.n >= 2).sort((a, b) => b.n - a.n).slice(0, max);
};
