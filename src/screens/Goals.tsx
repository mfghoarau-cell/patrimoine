import { useState } from 'react';
import type { Goal } from '../types';
import { useStore } from '../store';
import { goalState, monthsUntil } from '../lib/budget';
import { addMonths, cap, eur0, monthKey, monthYear, parseMonth, uid } from '../lib/format';
import { ConfirmButton, Gauge, Icon, MoneyField, Sheet, Tag, TextField, TopBar } from '../ui';

const shortMonth = (key: string) => {
  const { y, m } = parseMonth(key);
  return new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

export const GoalSheet = ({ goal, onClose }: { goal?: Goal; onClose: () => void }) => {
  const { data, today, update, toast } = useStore();
  const [g, setG] = useState<Goal>(goal ?? { id: uid(), name: '', target: 0, saved: 0, deadline: addMonths(monthKey(today), 12), plan: 0 });
  const set = (p: Partial<Goal>) => setG({ ...g, ...p });
  const hasSafetyGoal = data.goals.some((x) => x.fromSafety && x.id !== g.id);
  const valid = g.name.trim() && g.target > 0 && /^\d{4}-\d{2}$/.test(g.deadline);
  return (
    <Sheet title={goal ? 'Modifier l’objectif' : 'Nouvel objectif'} onClose={onClose}>
      <TextField id="g-name" label="Nom" value={g.name} placeholder="Voyage, apport, voiture…" onChange={(name) => set({ name })} />
      <div className="two">
        <MoneyField id="g-target" label="Montant visé" value={g.target} onChange={(target) => set({ target })} />
        <MoneyField id="g-saved" label="Déjà mis de côté" value={g.saved} onChange={(saved) => set({ saved })} />
      </div>
      <div className="two">
        <TextField id="g-deadline" type="month" label="Échéance" value={g.deadline} onChange={(deadline) => set({ deadline })} />
        <MoneyField id="g-plan" label="Prévu par mois" value={g.plan} onChange={(plan) => set({ plan })} />
      </div>
      {g.target > 0 && /^\d{4}-\d{2}$/.test(g.deadline) && (
        <p className="small muted num">
          Pour l'atteindre à temps, il faut {eur0(Math.max(0, g.target - g.saved) / monthsUntil(g.deadline, today))} par mois.
        </p>
      )}
      {!hasSafetyGoal && (
        <label className="toggle">
          <input type="checkbox" checked={!!g.fromSafety} onChange={(e) => set({ fromSafety: e.target.checked })} />
          Alimenté automatiquement par l'épargne de sécurité
        </label>
      )}
      <button
        type="button"
        className="btn"
        disabled={!valid}
        onClick={() => {
          update((d) => ({ ...d, goals: goal ? d.goals.map((x) => (x.id === g.id ? g : x)) : [...d.goals, g] }));
          toast(goal ? 'Objectif modifié.' : 'Objectif ajouté.');
          onClose();
        }}
      >
        Enregistrer
      </button>
      {goal && (
        <ConfirmButton
          label="Supprimer l'objectif"
          confirmLabel="Confirmer la suppression"
          className="btn danger-ghost"
          onConfirm={() => {
            update((d) => ({ ...d, goals: d.goals.filter((x) => x.id !== goal.id) }));
            toast('Objectif supprimé.');
            onClose();
          }}
        />
      )}
    </Sheet>
  );
};

export const Goals = () => {
  const { data, today, go } = useStore();
  const [adding, setAdding] = useState(false);
  return (
    <div className="scroll">
      <div className="pad">
        <TopBar
          eyebrow={`${data.goals.length} objectif${data.goals.length > 1 ? 's' : ''}`}
          title="Objectifs"
          action={
            <button type="button" className="iconbtn" onClick={() => setAdding(true)} aria-label="Ajouter un objectif">
              <Icon name="plus" />
            </button>
          }
        />
        {data.goals.length === 0 ? (
          <div className="empty stack">
            <p className="muted">Un objectif reçoit une part de ton investissement à chaque point du mois : un voyage, un apport, un matelas de sécurité.</p>
            <button type="button" className="btn ghost" onClick={() => setAdding(true)}>
              Créer un objectif
            </button>
          </div>
        ) : (
          <div>
            {data.goals.map((g) => {
              const s = goalState(g, today);
              return (
                <button type="button" className="goal" key={g.id} onClick={() => go({ name: 'goal', id: g.id })}>
                  <div className="row">
                    <strong>{g.name}</strong>
                    <Tag tone={s.tone}>{s.label}</Tag>
                  </div>
                  <Gauge value={g.saved} max={g.target} tone="invest" label={`${eur0(g.saved)} sur ${eur0(g.target)}`} />
                  <div className="legend num">
                    <span>
                      {eur0(g.saved)} sur {eur0(g.target)}
                    </span>
                    <span>{shortMonth(g.deadline)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {adding && <GoalSheet onClose={() => setAdding(false)} />}
    </div>
  );
};

export const GoalDetail = ({ id }: { id: string }) => {
  const { data, today, go } = useStore();
  const [editing, setEditing] = useState(false);
  const g = data.goals.find((x) => x.id === id);
  if (!g)
    return (
      <div className="scroll">
        <div className="pad">
          <TopBar title="Objectif introuvable" onBack={() => go({ name: 'goals' })} />
        </div>
      </div>
    );
  const s = goalState(g, today);
  const history = data.contributions
    .filter((c) => c.goalId === g.id)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
  const max = Math.max(1, ...history.map((h) => h.amount));
  return (
    <div className="scroll">
      <div className="pad">
        <TopBar
          eyebrow="Objectif"
          title={g.name}
          onBack={() => go({ name: 'goals' })}
          action={
            <button type="button" className="linkbtn" onClick={() => setEditing(true)}>
              Modifier
            </button>
          }
        />
        <div className="stack">
          <div className="env invest">
            <div className="row">
              <div>
                <div className="big num">{eur0(g.saved)}</div>
                <div className="small muted num">mis de côté sur {eur0(g.target)}</div>
              </div>
              <Tag tone={s.tone}>{s.label}</Tag>
            </div>
            <Gauge value={g.saved} max={g.target} tone="invest" label={`${Math.round((g.saved / g.target) * 100)} % atteint`} />
            <dl className="ledger num">
              <dt>Échéance</dt>
              <dd>{cap(monthYear(g.deadline))}</dd>
              <dt>Mois restants</dt>
              <dd>{monthsUntil(g.deadline, today)}</dd>
              <dt>Il faut par mois</dt>
              <dd>{eur0(s.needed)}</dd>
              <dt className="total">{g.fromSafety ? 'Épargne de sécurité' : 'Prévu par mois'}</dt>
              <dd className="total">{g.fromSafety ? 'automatique' : eur0(g.plan)}</dd>
            </dl>
          </div>
          <section>
            <h3>Derniers versements</h3>
            {history.length === 0 ? (
              <p className="muted small">Les versements apparaîtront après ton premier point du mois.</p>
            ) : (
              <div className="hist num">
                {history.map((h) => (
                  <div key={h.month}>
                    <span>{eur0(h.amount)}</span>
                    <i style={{ height: `${(h.amount / max) * 70}px` }} />
                    <span>{parseMonth(h.month) && new Date(parseMonth(h.month).y, parseMonth(h.month).m, 1).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      {editing && <GoalSheet goal={g} onClose={() => setEditing(false)} />}
    </div>
  );
};
