import { useState } from 'react';
import type { Entry, Kind } from '../types';
import { catName, useStore } from '../store';
import { learnedFavorites, monthStatus } from '../lib/budget';
import { eur, isoDay, uid } from '../lib/format';
import { ConfirmButton, Icon, Sheet } from '../ui';

const KIND_CHOICES: [Kind, string][] = [
  ['leisure', 'Loisirs'],
  ['exception', 'Exceptionnel'],
];
const IMPORT_CHOICES: [Kind, string][] = [
  ['leisure', 'Loisirs'],
  ['life', 'Vie courante'],
  ['exception', 'Exceptionnel'],
  ['extra', 'Revenu exceptionnel'],
  ['ignore', 'Virement interne'],
];

/** Saisie express d'une dépense, ou modification d'une opération existante. */
export const EntrySheet = ({ entry, onClose }: { entry?: Entry; onClose: () => void }) => {
  const { data, today, update, toast } = useStore();
  const editing = !!entry;
  const [amount, setAmount] = useState(entry ? entry.amount.toFixed(2).replace('.', ',').replace(/,00$/, '') : '');
  const [kind, setKind] = useState<Kind>(entry?.kind ?? 'leisure');
  const [cat, setCat] = useState(entry?.cat ?? data.cats[0]?.id ?? 'autre');
  const [label, setLabel] = useState(entry?.label ?? '');
  const [date, setDate] = useState(entry?.date ?? isoDay(today));
  const favorites = editing ? [] : learnedFavorites(data.entries, today);
  const value = Number(amount.replace(',', '.')) || 0;
  const st = monthStatus(data, today);
  const leftAfter = st.leisureLeft - (kind === 'leisure' ? value : 0) + (editing && entry?.kind === 'leisure' && entry.date.startsWith(st.month) ? entry.amount : 0);

  const press = (k: string) => {
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1);
      if (k === ',') return a.includes(',') ? a : `${a || '0'},`;
      if (a.includes(',') && a.split(',')[1].length >= 2) return a;
      if (a.replace(',', '').length >= 7) return a;
      return a === '0' ? k : a + k;
    });
  };

  const save = () => {
    if (!(value > 0)) return;
    const finalLabel = label.trim() || (kind === 'leisure' ? catName(data, cat) : 'Dépense exceptionnelle');
    const next: Entry = {
      id: entry?.id ?? uid(),
      date,
      label: finalLabel,
      amount: Math.round(value * 100) / 100,
      kind,
      cat: kind === 'leisure' ? cat : undefined,
      source: entry?.source ?? 'manual',
      raw: entry?.raw,
    };
    update((d) => ({ ...d, entries: editing ? d.entries.map((e) => (e.id === next.id ? next : e)) : [...d.entries, next] }));
    onClose();
    if (kind === 'leisure' && date.startsWith(st.month))
      toast(leftAfter >= 0 ? `Enregistré. Reste ${eur(leftAfter)} pour les loisirs.` : `Enregistré. Budget loisirs dépassé de ${eur(-leftAfter)}.`);
    else toast('Enregistré.');
  };

  const choices = entry?.source === 'import' ? IMPORT_CHOICES : KIND_CHOICES;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'];

  return (
    <Sheet title={editing ? 'Modifier l’opération' : 'Nouvelle dépense'} onClose={onClose}>
      {favorites.length > 0 && (
        <div className="chips" aria-label="Dépenses fréquentes">
          {favorites.map((f) => (
            <button
              key={`${f.label}${f.amount}`}
              type="button"
              className="chip fav"
              onClick={() => {
                setAmount(f.amount.toFixed(2).replace('.', ',').replace(/,00$/, ''));
                setLabel(f.label);
                if (f.cat) setCat(f.cat);
                setKind('leisure');
              }}
            >
              {f.label} · <span className="num">{eur(f.amount)}</span>
            </button>
          ))}
        </div>
      )}
      {entry?.raw && <p className="raw">{entry.raw}</p>}
      <div className="amount-display num" aria-live="polite">
        {amount || '0'}
        <span className="cur"> €</span>
      </div>
      {kind === 'leisure' && date.startsWith(st.month) && (
        <p className="impact num">
          {value > 0
            ? leftAfter >= 0
              ? `Il restera ${eur(leftAfter)} pour les loisirs ce mois-ci`
              : `Le budget loisirs sera dépassé de ${eur(-leftAfter)}`
            : `Reste ${eur(Math.max(0, st.leisureLeft))} pour les loisirs ce mois-ci`}
        </p>
      )}
      <div className="chips" role="group" aria-label="Type">
        {choices.map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      {kind === 'leisure' && (
        <div className="chips" role="group" aria-label="Catégorie">
          {data.cats.map((c) => (
            <button key={c.id} type="button" className="chip soft" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="keypad wide">
        {keys.map((k) =>
          k === 'del' ? (
            <button key={k} type="button" onClick={() => press(k)} aria-label="Effacer">
              <Icon name="back" size={24} />
            </button>
          ) : (
            <button key={k} type="button" onClick={() => press(k)}>
              {k}
            </button>
          ),
        )}
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor="e-label">Libellé</label>
          <input id="e-label" value={label} placeholder={kind === 'leisure' ? catName(data, cat) : 'Facultatif'} autoComplete="off" onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="e-date">Date</label>
          <input id="e-date" type="date" value={date} max={isoDay(today)} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      </div>
      <button type="button" className="btn" onClick={save} disabled={!(value > 0)}>
        {editing ? 'Enregistrer' : `Ajouter ${value > 0 ? eur(value) : ''}`}
      </button>
      {editing && (
        <ConfirmButton
          label="Supprimer l'opération"
          confirmLabel="Confirmer la suppression"
          className="btn danger-ghost"
          onConfirm={() => {
            update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== entry!.id) }));
            onClose();
            toast('Opération supprimée.');
          }}
        />
      )}
    </Sheet>
  );
};
