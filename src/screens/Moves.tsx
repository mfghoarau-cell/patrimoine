import { useState } from 'react';
import { catName, useStore } from '../store';
import { addMonths, cap, dayHeading, daysInMonth, eur, isoDay, monthKey, monthYear } from '../lib/format';
import { Icon, TopBar } from '../ui';

type Filter = 'all' | 'leisure' | 'auto';
interface Row {
  key: string;
  date: string;
  label: string;
  sub: string;
  amount: number; // signé
  dot: string;
  entryId?: string;
}

const KIND_LABEL: Record<string, string> = {
  life: 'Vie courante',
  exception: 'Exceptionnel',
  extra: 'Revenu exceptionnel',
  ignore: 'Virement interne',
};

export const Moves = () => {
  const { data, today, openEntry } = useStore();
  const current = monthKey(today);
  const [month, setMonth] = useState(current);
  const [filter, setFilter] = useState<Filter>('all');
  const todayIso = isoDay(today);
  const close = data.closes.find((c) => c.month === month);

  const rows: Row[] = [];
  // Opérations récurrentes : confirmées si le mois est bouclé, sinon celles dont la date est passée.
  const dayOf = (id: string) => data.recurring.find((x) => x.id === id)?.day ?? 1;
  const recurring = close ? close.recurring.filter((r) => r.happened) : data.recurring.filter((r) => r.active);
  recurring.forEach((r) => {
    const day = Math.min(dayOf(r.id), daysInMonth(month));
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (!close && date > todayIso) return;
    rows.push({
      key: `r-${r.id}`,
      date,
      label: r.label,
      sub: r.kind === 'safety' ? 'Automatique · épargne' : 'Automatique',
      amount: r.kind === 'income' ? r.amount : -r.amount,
      dot: r.kind === 'income' ? 'income' : 'fixed',
    });
  });
  data.entries
    .filter((e) => e.date.startsWith(month))
    .forEach((e) =>
      rows.push({
        key: e.id,
        date: e.date,
        label: e.label,
        sub: e.kind === 'leisure' ? catName(data, e.cat) : KIND_LABEL[e.kind] ?? '',
        amount: e.kind === 'extra' ? e.amount : -e.amount,
        dot: e.kind,
        entryId: e.id,
      }),
    );

  const shown = rows
    .filter((r) => filter === 'all' || (filter === 'leisure' ? r.dot === 'leisure' : !r.entryId))
    .sort((a, b) => b.date.localeCompare(a.date));
  const days = [...new Set(shown.map((r) => r.date))];
  const chip = (k: Filter, l: string) => (
    <button type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
      {l}
    </button>
  );

  return (
    <div className="scroll">
      <div className="pad">
        <TopBar
          eyebrow={close ? 'Mois bouclé' : month === current ? 'Mois en cours' : 'Mois passé'}
          title={cap(monthYear(month))}
          action={
            <div className="monthnav">
              <button type="button" className="iconbtn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mois précédent">
                <Icon name="left" />
              </button>
              <button type="button" className="iconbtn" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= current} aria-label="Mois suivant">
                <Icon name="right" />
              </button>
            </div>
          }
        />
        <div className="chips" role="group" aria-label="Filtrer">
          {chip('all', 'Tout')}
          {chip('leisure', 'Loisirs')}
          {chip('auto', 'Automatiques')}
        </div>
        {shown.length === 0 ? (
          <p className="muted empty">Aucune opération pour ce filtre.</p>
        ) : (
          <div className="daylist">
            {days.map((d) => (
              <div key={d}>
                <span className="day-h">{dayHeading(d)}</span>
                <ul className="ruled">
                  {shown
                    .filter((r) => r.date === d)
                    .map((r) => {
                      const content = (
                        <>
                          <span className={`dot ${r.dot}`} />
                          <span className="lbl">
                            {r.label}
                            <span className="sub">{r.sub}</span>
                          </span>
                          <span className={`amt num ${r.amount > 0 ? 'plus' : ''}`}>
                            {r.amount > 0 ? '+ ' : '− '}
                            {eur(Math.abs(r.amount))}
                          </span>
                        </>
                      );
                      return (
                        <li key={r.key}>
                          {r.entryId ? (
                            <button type="button" className="rowbtn" onClick={() => openEntry(data.entries.find((e) => e.id === r.entryId))}>
                              {content}
                            </button>
                          ) : (
                            <div className="rowbtn static">{content}</div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
