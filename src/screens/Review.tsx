import { useMemo, useRef, useState } from 'react';
import type { ClosedRecurring, Entry, Kind, MonthClose, Rule } from '../types';
import { useStore } from '../store';
import { applyClose, closedRecurringDraft, goalState, monthResult } from '../lib/budget';
import { classifyImport, merchantKey, parseBankCsv, type ImportLine } from '../lib/csv';
import { addMonths, cap, eur, eur0, monthName, parseAmount, uid } from '../lib/format';
import { Icon, Stepper, Tag } from '../ui';
import { demoCsv } from '../lib/demo';

type Choice = { kind: Kind; cat?: string };
const DEBIT_CHOICES: [Kind, string][] = [
  ['leisure', 'Loisirs'],
  ['life', 'Vie courante'],
  ['exception', 'Exceptionnel'],
  ['ignore', 'Virement interne'],
];
const CREDIT_CHOICES: [Kind, string][] = [
  ['extra', 'Revenu exceptionnel'],
  ['ignore', 'Virement interne'],
];

/** Le point du mois : confirmer, ranger, faire le bilan, répartir. Rien n'est enregistré avant la dernière étape. */
export const Review = ({ month }: { month: string }) => {
  const { data, today, update, go } = useStore();
  const [step, setStep] = useState(1);
  const [recurring, setRecurring] = useState<ClosedRecurring[]>(() => closedRecurringDraft(data.recurring));
  const [editing, setEditing] = useState<string | null>(null);
  const [lines, setLines] = useState<ImportLine[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [remember, setRemember] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<MonthClose | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const label = monthName(month);

  const todo = lines?.filter((l) => l.status === 'todo') ?? [];
  const auto = lines?.filter((l) => l.status === 'auto') ?? [];
  const pendingEntries: Entry[] = useMemo(() => {
    if (!lines) return [];
    return lines
      .filter((l) => l.status === 'auto' || (l.status === 'todo' && choices[l.id]))
      .map((l) => {
        const c = l.status === 'auto' ? { kind: l.kind as Kind, cat: l.cat } : choices[l.id];
        return { id: uid(), date: l.date, label: cap(merchantKey(l.raw)) || l.raw, amount: Math.abs(l.amount), kind: c.kind, cat: c.kind === 'leisure' ? c.cat ?? data.cats[0]?.id : undefined, source: 'import' as const, raw: l.raw };
      })
      .filter((e) => e.kind !== 'ignore');
  }, [lines, choices, data.cats]);
  const preview = { ...data, entries: [...data.entries, ...pendingEntries] };
  const result = monthResult(preview, month, recurring);
  const prevClose = data.closes.find((c) => c.month === addMonths(month, -1));
  const goals = data.goals.filter((g) => !g.fromSafety && g.saved < g.target);
  const total = Math.max(0, Math.round(result.invest));
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const allocOf = (id: string) => alloc[id] ?? Math.min(goals.find((g) => g.id === id)?.plan ?? 0, total);
  const allocated = goals.reduce((s, g) => s + allocOf(g.id), 0);
  const pea = total - allocated;

  const onText = (text: string) => {
    const parsed = parseBankCsv(text);
    setImportErrors(parsed.errors);
    const classified = classifyImport(parsed.rows, month, recurring, data.entries, data.rules);
    setLines(classified);
    setChoices({});
    // Le relevé fait foi : on reprend le montant réellement prélevé ou versé.
    setRecurring((rec) =>
      rec.map((r) => {
        const line = classified.find((l) => l.matchedId === r.id);
        return line ? { ...r, amount: Math.abs(line.amount), happened: true } : r;
      }),
    );
  };

  const finish = () => {
    const newRules: Rule[] = todo
      .filter((l) => choices[l.id] && remember[l.id] !== false && merchantKey(l.raw))
      .map((l) => ({ id: uid(), pattern: merchantKey(l.raw), kind: choices[l.id].kind, cat: choices[l.id].cat }))
      .filter((r, i, arr) => arr.findIndex((x) => x.pattern === r.pattern) === i && !data.rules.some((x) => x.pattern === r.pattern));
    const close: MonthClose = {
      month,
      ...result,
      recurring,
      allocations: [
        ...goals.map((g) => ({ target: g.id, label: g.name, amount: allocOf(g.id) })),
        { target: 'pea', label: 'PEA', amount: Math.max(0, pea) },
      ],
      closedAt: new Date().toISOString(),
    };
    update((d) => applyClose({ ...d, entries: [...d.entries, ...pendingEntries], rules: [...d.rules, ...newRules] }, close));
    setDone(close);
  };

  if (done)
    return (
      <div className="scroll">
        <div className="pad stack done-view">
          <div className="ok-icon">
            <Icon name="check" size={44} stroke={2.2} />
          </div>
          <h2 className="display-s">{cap(label)} est bouclé</h2>
          {done.invest > 0 ? (
            <>
              <p className="muted">Il te reste à faire ces virements depuis ta banque :</p>
              <ul className="ruled num">
                {done.allocations
                  .filter((a) => a.amount > 0)
                  .map((a) => (
                    <li key={a.target}>
                      <span className="lbl">{a.label}</span>
                      <span className="amt">{eur0(a.amount)}</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="muted">Rien à investir ce mois-ci. Le bilan est enregistré.</p>
          )}
          <button type="button" className="btn" onClick={() => go({ name: 'home' })}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );

  const head = (title: string) => (
    <div className="pad">
      <div className="flowbar">
        <button
          type="button"
          className="iconbtn"
          onClick={() => (step === 1 ? go({ name: 'home' }) : setStep(step - 1))}
          aria-label={step === 1 ? 'Quitter le point du mois' : 'Étape précédente'}
        >
          <Icon name={step === 1 ? 'close' : 'left'} />
        </button>
        <div className="eyebrow">
          Point de {label} · étape {step} sur 4
        </div>
      </div>
      <div className="steps" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <h2 className="flow-title">{title}</h2>
    </div>
  );
  const foot = (labelBtn: string, onClick: () => void, disabled = false) => (
    <div className="flowfoot pad">
      <button type="button" className="btn" onClick={onClick} disabled={disabled}>
        {labelBtn}
      </button>
    </div>
  );

  if (step === 1) {
    const count = (s: ImportLine['status']) => lines?.filter((l) => l.status === s).length ?? 0;
    return (
      <>
        {head('Confirmer les opérations')}
        <div className="scroll">
          <div className="pad">
            <p className="muted small">Ces opérations se sont inscrites toutes seules. Décoche celles qui n'ont pas eu lieu, touche un montant pour le corriger.</p>
            <ul className="ruled num">
              {recurring.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="check"
                    role="checkbox"
                    aria-checked={r.happened}
                    aria-label={`${r.label} a eu lieu`}
                    onClick={() => setRecurring(recurring.map((x) => (x.id === r.id ? { ...x, happened: !x.happened } : x)))}
                  >
                    {r.happened && <Icon name="check" size={18} stroke={2.6} />}
                  </button>
                  <span className={`lbl ${r.happened ? '' : 'struck'}`}>{r.label}</span>
                  {editing === r.id ? (
                    <input
                      className="inline-amount"
                      inputMode="decimal"
                      autoFocus
                      aria-label={`Montant réel de ${r.label}`}
                      defaultValue={String(r.amount).replace('.', ',')}
                      onBlur={(e) => {
                        const n = parseAmount(e.target.value);
                        if (n !== null && n >= 0) setRecurring(recurring.map((x) => (x.id === r.id ? { ...x, amount: n } : x)));
                        setEditing(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <button type="button" className={`amt amtbtn ${r.kind === 'income' ? 'plus' : ''}`} onClick={() => setEditing(r.id)}>
                      {r.kind === 'income' ? '+ ' : '− '}
                      {eur(r.amount)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className={`dropzone ${lines ? 'done' : ''}`}>
              {lines ? (
                <>
                  <strong>Relevé importé</strong>
                  <p className="small">
                    {lines.length - count('other-month')} opérations de {label} · {count('recurring')} déjà prévues · {count('duplicate')} déjà saisies · {count('auto')} rangées par tes règles · {count('todo')} à ranger
                  </p>
                  <button type="button" className="linkbtn" onClick={() => fileRef.current?.click()}>
                    Importer un autre fichier
                  </button>
                </>
              ) : (
                <>
                  <strong>Rattraper les oublis</strong>
                  <p className="small muted">Exporte le relevé de {label} depuis ta banque au format CSV, puis importe-le ici. Seules les opérations absentes seront ajoutées.</p>
                  <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
                    <Icon name="upload" size={20} />
                    Importer le relevé CSV
                  </button>
                  {data.settings.demo && (
                    <button type="button" className="linkbtn" onClick={() => onText(demoCsv(month))}>
                      Utiliser le relevé d'exemple
                    </button>
                  )}
                </>
              )}
              {importErrors.length > 0 && (
                <details className="small">
                  <summary>{importErrors.length} ligne(s) non lue(s)</summary>
                  <ul>
                    {importErrors.slice(0, 8).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => e.target.files?.[0] && onText(await e.target.files[0].text())} />
            </div>
            <p className="small muted">Rien n'est enregistré avant la dernière étape.</p>
          </div>
        </div>
        {foot(lines ? 'Continuer' : 'Continuer sans import', () => setStep(2))}
      </>
    );
  }

  if (step === 2) {
    const allSorted = todo.every((l) => choices[l.id]);
    return (
      <>
        {head('Ranger les opérations importées')}
        <div className="scroll">
          <div className="pad stack">
            {!lines ? (
              <p className="muted">Aucun relevé importé : rien à ranger.</p>
            ) : todo.length === 0 ? (
              <p className="muted">Tout est rangé. {auto.length > 0 && `${auto.length} opération(s) rangée(s) par tes règles.`}</p>
            ) : (
              <p className="muted small">
                {auto.length > 0 && `${auto.length} opération(s) rangée(s) par tes règles. `}Il en reste {todo.filter((l) => !choices[l.id]).length} à ranger.
              </p>
            )}
            {todo.map((l) => {
              const c = choices[l.id];
              const opts = l.amount > 0 ? CREDIT_CHOICES : DEBIT_CHOICES;
              const key = merchantKey(l.raw);
              return (
                <div className="sortcard" key={l.id}>
                  <div className="row">
                    <strong>{cap(key) || 'Opération'}</strong>
                    <span className={`amt num ${l.amount > 0 ? 'plus' : ''}`}>
                      {l.amount > 0 ? '+ ' : '− '}
                      {eur(Math.abs(l.amount))}
                    </span>
                  </div>
                  <div className="raw">
                    {l.raw} · {l.date.split('-').reverse().join('/')}
                  </div>
                  <div className="chips" role="group" aria-label={`Ranger ${key}`}>
                    {opts.map(([k, lab]) => (
                      <button key={k} type="button" className="chip" aria-pressed={c?.kind === k} onClick={() => setChoices({ ...choices, [l.id]: { kind: k, cat: k === 'leisure' ? c?.cat ?? data.cats[0]?.id : undefined } })}>
                        {lab}
                      </button>
                    ))}
                  </div>
                  {c?.kind === 'leisure' && (
                    <div className="chips" role="group" aria-label="Catégorie de loisirs">
                      {data.cats.map((cat) => (
                        <button key={cat.id} type="button" className="chip soft" aria-pressed={c.cat === cat.id} onClick={() => setChoices({ ...choices, [l.id]: { kind: 'leisure', cat: cat.id } })}>
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {key && (
                    <label className="toggle">
                      <input type="checkbox" checked={remember[l.id] !== false} onChange={(e) => setRemember({ ...remember, [l.id]: e.target.checked })} />
                      Ranger « {key} » ainsi les prochaines fois
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {foot('Continuer', () => setStep(3), !allSorted)}
      </>
    );
  }

  if (step === 3) {
    const { targetLeisure, targetInvest, lifeBudget } = data.settings;
    const okL = result.leisure <= targetLeisure;
    const okI = result.invest >= targetInvest;
    const msg = okL && okI ? 'Les deux cibles sont tenues.' : !okI ? `Il manque ${eur0(targetInvest - result.invest)} pour atteindre ta cible d'investissement.` : "Cible d'investissement tenue, malgré des loisirs au-dessus du budget.";
    const verdict = (title: string, value: number, target: number, ok: boolean, prev?: number) => (
      <div className="verdict">
        <div className="row">
          <h3>{title}</h3>
          <Tag tone={ok ? 'ok' : 'bad'}>
            {ok ? (
              <>
                <Icon name="check" size={14} stroke={2.6} />
                Tenue
              </>
            ) : (
              'Manquée'
            )}
          </Tag>
        </div>
        <div className="row">
          <div className="big num">{eur0(value)}</div>
          <div className="small muted num">cible {eur0(target)}</div>
        </div>
        {prev !== undefined && (
          <div className="small muted num">
            {cap(monthName(addMonths(month, -1)))} : {eur0(prev)} · {value - prev >= 0 ? '+' : '−'} {eur0(Math.abs(value - prev))}
          </div>
        )}
      </div>
    );
    return (
      <>
        {head(`Bilan de ${label}`)}
        <div className="scroll">
          <div className="pad stack">
            <p className="strong">{msg}</p>
            {verdict('Loisirs dépensés', result.leisure, targetLeisure, okL, prevClose?.leisure)}
            {verdict('Reste à investir', result.invest, targetInvest, okI, prevClose?.invest)}
            <dl className="ledger num">
              <dt>Revenus</dt>
              <dd>{eur0(result.income + result.extra)}</dd>
              <dt>Charges fixes</dt>
              <dd>− {eur0(result.fixed)}</dd>
              <dt>Épargne de sécurité</dt>
              <dd>− {eur0(result.safety)}</dd>
              <dt>Vie courante{result.lifeSpent > lifeBudget ? ` (forfait dépassé de ${eur0(result.lifeSpent - lifeBudget)})` : ''}</dt>
              <dd>− {eur0(result.life)}</dd>
              {result.exception > 0 && (
                <>
                  <dt>Exceptionnel</dt>
                  <dd>− {eur0(result.exception)}</dd>
                </>
              )}
              <dt>Loisirs</dt>
              <dd>− {eur0(result.leisure)}</dd>
              <dt className="total">Reste à investir</dt>
              <dd className="total">{eur0(result.invest)}</dd>
            </dl>
          </div>
        </div>
        {foot(total > 0 ? `Répartir ${eur0(total)}` : 'Continuer', () => setStep(4))}
      </>
    );
  }

  return (
    <>
      {head('Répartir le reste à investir')}
      <div className="scroll">
        <div className="pad">
          <div className="left-to num">
            <span>À répartir</span>
            <span>{eur0(total)}</span>
          </div>
          {total === 0 ? (
            <p className="muted">Rien à répartir ce mois-ci.</p>
          ) : (
            <>
              {goals.map((g) => {
                const s = goalState(g, today, allocOf(g.id));
                return (
                  <div className="alloc" key={g.id}>
                    <div className="lbl">
                      <strong>{g.name}</strong>
                      <div className="small muted num">
                        Il faut {eur0(s.needed)} par mois · {s.label.toLowerCase()}
                      </div>
                    </div>
                    <Stepper id={`al-${g.id}`} label={g.name} value={allocOf(g.id)} onChange={(v) => setAlloc({ ...alloc, [g.id]: v })} format={eur0} />
                  </div>
                );
              })}
              <div className="alloc">
                <div className="lbl">
                  <strong>PEA</strong>
                  <div className="small muted">Le reste, automatiquement</div>
                </div>
                <output className="num strong alloc-out">{eur0(Math.max(0, pea))}</output>
              </div>
              {goals.length === 0 && <p className="small muted">Ajoute des objectifs dans l'onglet Objectifs pour répartir entre eux et le PEA.</p>}
              {pea < 0 && (
                <p className="error">
                  Tu as réparti {eur0(-pea)} de trop. Retire-les d'un objectif.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {foot('Valider et boucler le mois', finish, pea < 0)}
    </>
  );
};
