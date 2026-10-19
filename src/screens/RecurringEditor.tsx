import type { Recurring, RecurringKind } from '../types';
import { eur0, parseAmount, uid } from '../lib/format';
import { Icon } from '../ui';

const SUGGESTIONS: Record<RecurringKind, string[]> = {
  income: ['Salaire', 'Prime mensuelle', 'Allocation'],
  fixed: ['Loyer', 'Électricité', 'Internet', 'Forfait mobile', 'Assurance habitation', 'Transport', 'Streaming', 'Mutuelle'],
  safety: ['Épargne de sécurité'],
};

const KIND_LABEL: Record<RecurringKind, string> = { income: 'Revenus', fixed: 'Charges fixes', safety: 'Épargne de sécurité' };

/** Liste éditable d'opérations récurrentes d'un même type. */
export const RecurringEditor = ({ kind, items, onChange }: { kind: RecurringKind; items: Recurring[]; onChange: (items: Recurring[]) => void }) => {
  const mine = items.filter((r) => r.kind === kind);
  const others = items.filter((r) => r.kind !== kind);
  const set = (next: Recurring[]) => onChange([...others, ...next]);
  const patch = (id: string, p: Partial<Recurring>) => set(mine.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const add = (label = '') => set([...mine, { id: uid(), label, amount: 0, kind, day: kind === 'income' ? 28 : 5, active: true }]);
  const unused = SUGGESTIONS[kind].filter((s) => !mine.some((r) => r.label === s));
  const total = mine.filter((r) => r.active).reduce((a, r) => a + r.amount, 0);

  return (
    <section className="rec-editor" aria-label={KIND_LABEL[kind]}>
      {mine.length > 0 && (
        <ul className="rec-list">
          {mine.map((r) => (
            <li key={r.id} className={r.active ? '' : 'off'}>
              <input aria-label="Libellé" className="rec-label" value={r.label} placeholder="Libellé" onChange={(e) => patch(r.id, { label: e.target.value })} />
              <div className="rec-line">
                <label className="rec-amount">
                  <span className="sr">Montant de {r.label || 'cette ligne'}</span>
                  <input inputMode="decimal" value={r.amount ? String(r.amount).replace('.', ',') : ''} placeholder="0" onChange={(e) => patch(r.id, { amount: Math.max(0, parseAmount(e.target.value) ?? 0) })} />
                  <span>€</span>
                </label>
                <label className="rec-day">
                  <span>le</span>
                  <select value={r.day} onChange={(e) => patch(r.id, { day: Number(e.target.value) })} aria-label={`Jour du mois de ${r.label || 'cette ligne'}`}>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="iconbtn" onClick={() => set(mine.filter((x) => x.id !== r.id))} aria-label={`Supprimer ${r.label || 'cette ligne'}`}>
                  <Icon name="trash" size={20} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="chips">
        {unused.map((s) => (
          <button key={s} type="button" className="chip fav" onClick={() => add(s)}>
            + {s}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => add()}>
          + Autre
        </button>
      </div>
      {mine.length > 0 && <p className="small muted num">Total : {eur0(total)} par mois</p>}
    </section>
  );
};
