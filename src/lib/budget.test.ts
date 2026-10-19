import { describe, expect, it } from 'vitest';
import type { AppData } from '../types';
import { emptyData } from './storage';
import { applyClose, closedRecurringDraft, goalState, monthResult, monthStatus, pendingReviewMonth } from './budget';
import { classifyImport, merchantKey, parseBankCsv } from './csv';

const base = (): AppData => {
  const d = emptyData();
  d.settings = { ...d.settings, setupDone: true, startMonth: '2026-09', targetLeisure: 300, targetInvest: 600, lifeBudget: 400 };
  d.recurring = [
    { id: 'sal', label: 'Salaire', amount: 2700, kind: 'income', day: 28, active: true },
    { id: 'loyer', label: 'Loyer', amount: 900, kind: 'fixed', day: 3, active: true },
    { id: 'autres', label: 'Autres charges', amount: 197, kind: 'fixed', day: 5, active: true },
    { id: 'sec', label: 'Épargne de sécurité', amount: 300, kind: 'safety', day: 2, active: true },
  ];
  return d;
};

describe('monthStatus', () => {
  it('prévient quand le rythme des loisirs menace la cible', () => {
    const d = base();
    d.entries = [{ id: 'a', date: '2026-10-10', label: 'Concert', amount: 214, kind: 'leisure', source: 'manual' }];
    const st = monthStatus(d, new Date(2026, 9, 19));
    expect(st.available).toBe(903);
    expect(Math.round(st.projectedInvest)).toBe(554);
    expect(st.trend).toBe('warn');
    expect(st.perDay).toBeCloseTo((903 - 600 - 214) / 13, 5);
  });

  it('ne projette pas avant le 7 du mois', () => {
    const d = base();
    d.entries = [{ id: 'a', date: '2026-10-02', label: 'Bar', amount: 60, kind: 'leisure', source: 'manual' }];
    const st = monthStatus(d, new Date(2026, 9, 2));
    expect(st.projected).toBe(false);
    expect(st.projectedLeisure).toBe(300);
    expect(st.trend).toBe('ok');
  });

  it('signale une cible perdue quand les loisirs dépassent la marge', () => {
    const d = base();
    d.entries = [{ id: 'a', date: '2026-10-05', label: 'Week-end', amount: 320, kind: 'leisure', source: 'manual' }];
    expect(monthStatus(d, new Date(2026, 9, 19)).trend).toBe('bad');
  });
});

describe('point du mois', () => {
  it('demande le point du mois précédent seulement après le premier mois suivi', () => {
    const d = base();
    expect(pendingReviewMonth(d, new Date(2026, 9, 19))).toBe('2026-09');
    d.settings.startMonth = '2026-10';
    expect(pendingReviewMonth(d, new Date(2026, 9, 19))).toBeNull();
  });

  it('calcule le bilan et ne pénalise la vie courante qu’en cas de dépassement', () => {
    const d = base();
    d.entries = [
      { id: 'l', date: '2026-09-12', label: 'Restaurant', amount: 281, kind: 'leisure', source: 'manual' },
      { id: 'v', date: '2026-09-14', label: 'Courses', amount: 350, kind: 'life', source: 'import' },
    ];
    const rec = closedRecurringDraft(d.recurring);
    const r = monthResult(d, '2026-09', rec);
    expect(r.invest).toBe(622);
    d.entries.push({ id: 'v2', date: '2026-09-20', label: 'Courses', amount: 100, kind: 'life', source: 'import' });
    expect(monthResult(d, '2026-09', rec).invest).toBe(572);
  });

  it('alimente les objectifs à la clôture', () => {
    const d = base();
    d.goals = [
      { id: 'japon', name: 'Japon', target: 3000, saved: 1150, deadline: '2027-06', plan: 250 },
      { id: 'matelas', name: 'Matelas', target: 6000, saved: 4200, deadline: '2027-12', plan: 0, fromSafety: true },
    ];
    const rec = closedRecurringDraft(d.recurring);
    const out = applyClose(d, {
      month: '2026-09', income: 2700, fixed: 1097, safety: 300, life: 400, leisure: 281, exception: 0, extra: 0, invest: 622, recurring: rec,
      allocations: [{ target: 'japon', label: 'Japon', amount: 250 }, { target: 'pea', label: 'PEA', amount: 372 }], closedAt: '',
    });
    expect(out.goals.find((g) => g.id === 'japon')!.saved).toBe(1400);
    expect(out.goals.find((g) => g.id === 'matelas')!.saved).toBe(4500);
    expect(out.contributions.find((c) => c.goalId === 'pea')!.amount).toBe(372);
  });

  it('évalue un objectif', () => {
    const g = { id: 'j', name: 'Japon', target: 3000, saved: 1150, deadline: '2027-06', plan: 250 };
    const s = goalState(g, new Date(2026, 9, 19));
    expect(Math.round(s.needed)).toBe(206);
    expect(s.label).toBe('En avance');
  });
});

describe('import CSV', () => {
  it('lit un export avec lignes de compte, débit et crédit séparés', () => {
    const csv = [
      'Compte courant;12345',
      'Solde au 30/09/2026;1 234,56',
      '',
      'Date;Libellé;Débit euros;Crédit euros;',
      '03/09/2026;"PRLV SEPA LOYER AGENCE";900,00;;',
      '14/09/2026;CB FNAC MONTPELLIER 13/09;34,90;;',
      '28/09/2026;VIR SALAIRE ENTREPRISE;;2 700,00;',
      '02/10/2026;CB BOULANGERIE;3,20;;',
    ].join('\n');
    const { rows, errors } = parseBankCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ date: '2026-09-03', raw: 'PRLV SEPA LOYER AGENCE', amount: -900 });
    expect(rows[2].amount).toBe(2700);
  });

  it('lit une colonne de montant signé', () => {
    const { rows } = parseBankCsv('date,description,montant\n2026-09-14,CB FNAC,-34.90\n');
    expect(rows[0].amount).toBe(-34.9);
  });

  it('classe récurrentes, doublons, règles et opérations à ranger', () => {
    const d = base();
    d.entries = [{ id: 'm', date: '2026-09-12', label: 'Cinéma', amount: 11.5, kind: 'leisure', source: 'manual' }];
    d.rules = [{ id: 'r', pattern: 'carrefour', kind: 'life' }];
    const rows = [
      { date: '2026-09-03', raw: 'PRLV LOYER', amount: -900 },
      { date: '2026-09-13', raw: 'CB PATHE 12/09', amount: -11.5 },
      { date: '2026-09-15', raw: 'CB CARREFOUR MARKET', amount: -82.4 },
      { date: '2026-09-14', raw: 'CB FNAC MONTPELLIER', amount: -34.9 },
      { date: '2026-10-01', raw: 'CB AUTRE MOIS', amount: -5 },
    ];
    const out = classifyImport(rows, '2026-09', closedRecurringDraft(d.recurring), d.entries, d.rules);
    expect(out.map((l) => l.status)).toEqual(['recurring', 'duplicate', 'auto', 'todo', 'other-month']);
    expect(merchantKey('CB FNAC MONTPELLIER 13/09')).toBe('fnac montpellier');
  });
});

import { buildDemo, demoCsv } from './demo';

describe('données d’exemple', () => {
  const today = new Date(2026, 9, 19);
  const d = buildDemo(today, 'hash');

  it('boucle trois mois et laisse le précédent à faire', () => {
    expect(d.closes.map((c) => c.month)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(d.closes[0].invest).toBeLessThan(600);
    expect(d.closes[2].invest).toBeGreaterThanOrEqual(600);
    expect(pendingReviewMonth(d, today)).toBe('2026-09');
    expect(d.goals.find((g) => g.id === 'japon')!.saved).toBe(1150);
    expect(d.goals.find((g) => g.id === 'matelas')!.saved).toBe(4200);
  });

  it('met le mois en cours en alerte', () => {
    expect(monthStatus(d, today).trend).toBe('warn');
  });

  it('le relevé d’exemple se range comme prévu', () => {
    const rec = closedRecurringDraft(d.recurring);
    const lines = classifyImport(parseBankCsv(demoCsv('2026-09')).rows, '2026-09', rec, d.entries, d.rules);
    const count = (s: string) => lines.filter((l) => l.status === s).length;
    expect([count('recurring'), count('duplicate'), count('auto'), count('todo')]).toEqual([9, 1, 2, 3]);
  });
});
