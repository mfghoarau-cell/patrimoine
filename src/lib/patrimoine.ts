import type { ImmoSettings, PeaHolding } from '../types';

export const peaSummary = (holdings: PeaHolding[]) => {
  const invested = holdings.reduce((s, h) => s + h.quantity * h.avgBuyPrice, 0);
  const value = holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const gain = value - invested;
  return { invested, value, gain, gainPct: invested > 0 ? (gain / invested) * 100 : 0 };
};

/** Date à laquelle le PEA atteint 5 ans (fiscalité allégée). */
export const peaFiveYears = (openDate: string): Date | null => {
  if (!openDate) return null;
  const [y, m, d] = openDate.split('-').map(Number);
  return new Date(y + 5, m - 1, d);
};

export const immoResult = (f: ImmoSettings) => {
  const projectCost = f.price + f.agencyFees + f.renovationBudget + (f.price * Math.max(0, f.notaryRate)) / 100;
  const loan = Math.max(0, projectCost - Math.max(0, f.downPayment));
  const rate = Math.max(0, f.loanRate) / 12 / 100;
  const months = Math.max(1, Math.round(f.loanDurationYears * 12));
  const payment = loan <= 0 ? 0 : rate === 0 ? loan / months : (loan * rate) / (1 - Math.pow(1 + rate, -months));
  const charges = f.chargesMonthly + f.insuranceMonthly + f.propertyTaxYearly / 12;
  const cashflow = f.rentMonthly - payment - charges;
  const grossYield = f.price > 0 ? ((f.rentMonthly * 12) / f.price) * 100 : 0;
  const netYield = projectCost > 0 ? ((f.rentMonthly * 12 - charges * 12) / projectCost) * 100 : 0;
  return { projectCost, loan, payment, charges, cashflow, grossYield, netYield };
};
