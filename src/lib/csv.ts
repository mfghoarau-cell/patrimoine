import type { ClosedRecurring, Entry, Kind, Rule } from '../types';
import { normalizeText, parseAmount } from './format';

export interface BankRow {
  date: string; // AAAA-MM-JJ
  raw: string;
  amount: number; // négatif = débit, positif = crédit
}

export interface ParseResult {
  rows: BankRow[];
  errors: string[];
}

const splitRow = (line: string, sep: string): string[] => {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
};

const parseDate = (value: string): string | null => {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
};

const headerKey = (h: string) => normalizeText(h).replace(/ /g, '');
const isDateHeader = (h: string) => /^date(operation|op|comptable|decomptabilisation|valeur)?$/.test(headerKey(h)) || headerKey(h) === 'dateoperation';
const isLabelHeader = (h: string) => /^(libelle|libellesimplifie|libelleoperation|description|operation|intitule|detail)/.test(headerKey(h));
const isAmountHeader = (h: string) => /^(montant|amount|montanteur|montanteuros)/.test(headerKey(h));
const isDebitHeader = (h: string) => /^debit/.test(headerKey(h));
const isCreditHeader = (h: string) => /^credit/.test(headerKey(h));

/**
 * Lit l'export CSV d'une banque. Accepte les séparateurs ; , et tabulation, les lignes d'en-tête de compte
 * avant le tableau, une colonne de montant signé ou deux colonnes débit / crédit.
 */
export const parseBankCsv = (text: string): ParseResult => {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  for (let h = 0; h < Math.min(lines.length, 30); h += 1) {
    const line = lines[h];
    const sep = [';', '\t', ','].sort((a, b) => line.split(b).length - line.split(a).length)[0];
    const headers = splitRow(line, sep);
    const iDate = headers.findIndex(isDateHeader);
    const iLabel = headers.findIndex(isLabelHeader);
    const iAmount = headers.findIndex(isAmountHeader);
    const iDebit = headers.findIndex(isDebitHeader);
    const iCredit = headers.findIndex(isCreditHeader);
    if (iDate < 0 || iLabel < 0 || (iAmount < 0 && iDebit < 0 && iCredit < 0)) continue;

    const rows: BankRow[] = [];
    for (let i = h + 1; i < lines.length; i += 1) {
      const cells = splitRow(lines[i], sep);
      const date = parseDate(cells[iDate] ?? '');
      const raw = (cells[iLabel] ?? '').replace(/\s+/g, ' ').trim();
      let amount: number | null = null;
      if (iAmount >= 0) amount = parseAmount(cells[iAmount] ?? '');
      else {
        const debit = parseAmount(cells[iDebit] ?? '');
        const credit = parseAmount(cells[iCredit] ?? '');
        if (debit) amount = -Math.abs(debit);
        else if (credit) amount = Math.abs(credit);
      }
      if (!date || !raw || amount === null || amount === 0) {
        if (cells.some((c) => c.trim())) errors.push(`Ligne ${i + 1} ignorée : date, libellé ou montant illisible.`);
        continue;
      }
      rows.push({ date, raw, amount });
    }
    return { rows, errors };
  }
  return { rows: [], errors: ['Colonnes introuvables : le fichier doit contenir une date, un libellé et un montant (ou débit et crédit).'] };
};

const NOISE = new Set(['cb', 'carte', 'prlv', 'sepa', 'vir', 'virement', 'prelevement', 'paiement', 'par', 'achat', 'retrait', 'dab', 'de', 'du', 'la', 'le', 'les', 'fact', 'facture', 'inst', 'instantane', 'recu', 'emis', 'x']);

/** Nom du commerçant extrait d'un libellé bancaire : « CB FNAC MONTPELLIER 14/09 » donne « fnac montpellier ». */
export const merchantKey = (raw: string): string => {
  const words = normalizeText(raw)
    .split(' ')
    .filter((w) => w.length > 1 && !NOISE.has(w) && !/\d/.test(w));
  return words.slice(0, 2).join(' ');
};

export const ruleFor = (raw: string, rules: Rule[]): Rule | undefined => {
  const text = normalizeText(raw);
  return rules.find((r) => r.pattern && text.includes(r.pattern));
};

export type ImportStatus = 'recurring' | 'duplicate' | 'auto' | 'todo' | 'other-month';

export interface ImportLine extends BankRow {
  id: string;
  status: ImportStatus;
  kind?: Kind;
  cat?: string;
  matchedLabel?: string;
  /** Opération récurrente rapprochée de cette ligne. */
  matchedId?: string;
}

/** Les prélèvements variables (électricité, téléphone) bougent un peu d'un mois à l'autre. */
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * 0.1);
const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

/**
 * Classe les lignes d'un relevé pour un mois donné :
 * - opérations récurrentes déjà inscrites (rapprochées par montant),
 * - doublons d'une saisie manuelle ou d'un import précédent,
 * - opérations rangées par une règle,
 * - opérations à ranger.
 */
export const classifyImport = (
  rows: BankRow[],
  month: string,
  recurring: ClosedRecurring[],
  entries: Entry[],
  rules: Rule[],
): ImportLine[] => {
  const usedRecurring = new Set<string>();
  const usedEntries = new Set<string>();
  const monthEntries = entries.filter((e) => e.date.startsWith(month));
  return rows.map((row, i) => {
    const id = `imp-${i}`;
    if (!row.date.startsWith(month)) return { ...row, id, status: 'other-month' as const };

    const sign = row.amount > 0 ? 'income' : 'out';
    const rec = recurring.find(
      (r) => r.happened && !usedRecurring.has(r.id) && (r.kind === 'income') === (sign === 'income') && close(Math.abs(row.amount), r.amount),
    );
    if (rec) {
      usedRecurring.add(rec.id);
      return { ...row, id, status: 'recurring' as const, matchedLabel: rec.label, matchedId: rec.id };
    }

    const dup = monthEntries.find(
      (e) =>
        !usedEntries.has(e.id) &&
        Math.abs(e.amount - Math.abs(row.amount)) < 0.01 &&
        (e.raw ? e.raw === row.raw && e.date === row.date : daysApart(e.date, row.date) <= 4),
    );
    if (dup) {
      usedEntries.add(dup.id);
      return { ...row, id, status: 'duplicate' as const, matchedLabel: dup.label };
    }

    const rule = ruleFor(row.raw, rules);
    if (rule && (rule.kind === 'extra' || rule.kind === 'ignore' || row.amount < 0)) {
      return { ...row, id, status: 'auto' as const, kind: rule.kind, cat: rule.cat };
    }
    return { ...row, id, status: 'todo' as const };
  });
};
