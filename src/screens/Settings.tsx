import { useRef, useState } from 'react';
import { useStore } from '../store';
import { plannedAvailable, recurringTotals } from '../lib/budget';
import { eur0, uid } from '../lib/format';
import { hashPin } from '../lib/pin';
import { backupFileName, clearData, exportJson, importJson } from '../lib/storage';
import { ConfirmButton, Icon, Stepper, TopBar } from '../ui';
import { PinPad } from './Lock';
import { RecurringEditor } from './RecurringEditor';

const share = async (text: string) => {
  const name = backupFileName();
  const file = new File([text], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde Patrimoine' });
      return;
    } catch {
      /* partage annulé : on télécharge */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const Settings = () => {
  const { data, update, go, toast } = useStore();
  const [pinStep, setPinStep] = useState<0 | 1 | 2>(0);
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const s = data.settings;
  const available = plannedAvailable(data);
  const set = (p: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  const over = s.targetLeisure + s.targetInvest - available;
  const t = recurringTotals(data.recurring);
  const nav = (label: string, sub: string, onClick: () => void) => (
    <li>
      <button type="button" className="rowbtn" onClick={onClick}>
        <span className="lbl">
          {label}
          <span className="sub">{sub}</span>
        </span>
        <Icon name="right" size={18} />
      </button>
    </li>
  );

  return (
    <div className="scroll">
      <div className="pad">
        <TopBar title="Réglages" onBack={() => go({ name: 'home' })} />
        <div className="stack">
          {s.demo && (
            <section className="demo-box stack-s">
              <strong>Données d'exemple</strong>
              <p className="small">Ces chiffres sont fictifs. Quand tu veux utiliser l'application pour de vrai, efface-les et recommence la configuration.</p>
              <ConfirmButton
                label="Quitter la démo"
                confirmLabel="Effacer les données d'exemple"
                onConfirm={() => {
                  clearData();
                  location.reload();
                }}
              />
            </section>
          )}
          <section>
            <h3>Mes deux cibles</h3>
            <div className="alloc">
              <div className="lbl">
                <strong>Loisirs</strong>
                <div className="small muted">par mois</div>
              </div>
              <Stepper id="s-leisure" label="Loisirs" value={s.targetLeisure} onChange={(v) => set({ targetLeisure: v })} format={eur0} />
            </div>
            <div className="alloc">
              <div className="lbl">
                <strong>Investissement</strong>
                <div className="small muted">par mois</div>
              </div>
              <Stepper id="s-invest" label="Investissement" value={s.targetInvest} onChange={(v) => set({ targetInvest: v })} format={eur0} />
            </div>
            <div className="alloc">
              <div className="lbl">
                <strong>Forfait vie courante</strong>
                <div className="small muted">courses, carburant…</div>
              </div>
              <Stepper id="s-life" label="Vie courante" value={s.lifeBudget} onChange={(v) => set({ lifeBudget: v })} format={eur0} />
            </div>
            <p className={`small num ${over > 0 ? 'error' : 'muted'}`}>
              {over > 0
                ? `Tes cibles dépassent de ${eur0(over)} ce qui reste chaque mois (${eur0(available)}).`
                : `Il reste ${eur0(available)} par mois à partager ; marge non affectée : ${eur0(-over)}.`}
            </p>
          </section>

          <section>
            <h3>Configuré une fois</h3>
            <ul className="ruled">
              {nav('Revenus et charges récurrentes', `${eur0(t.income)} de revenus · ${eur0(t.fixed + t.safety)} de charges et d'épargne`, () => go({ name: 'recurring' }))}
              {nav('Catégories de loisirs', data.cats.map((c) => c.name).join(', '), () => go({ name: 'cats' }))}
              {nav('Règles de rangement', `${data.rules.length} règle${data.rules.length > 1 ? 's' : ''} apprise${data.rules.length > 1 ? 's' : ''}`, () => go({ name: 'rules' }))}
              {nav("Code d'accès", 'Changer le code', () => setPinStep(1))}
            </ul>
          </section>

          <section className="stack-s">
            <h3>Sauvegarde</h3>
            <p className="small muted">Tes données sont uniquement sur ce téléphone. Exporte une sauvegarde chaque mois, par exemple après le point du mois, et range-la dans ton cloud.</p>
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                await share(exportJson(data));
                toast('Sauvegarde exportée.');
              }}
            >
              <Icon name="download" size={20} />
              Exporter une sauvegarde
            </button>
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={20} />
              Restaurer ou importer l'ancienne version
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const res = importJson(await file.text(), data);
                if (!res.ok) return toast(res.error);
                update(() => res.data);
                toast(res.note);
              }}
            />
          </section>

          <section className="stack-s">
            <h3>Effacer</h3>
            <ConfirmButton
              label="Effacer toutes les données"
              confirmLabel="Oui, tout effacer de ce téléphone"
              onConfirm={() => {
                clearData();
                location.reload();
              }}
            />
          </section>
          <p className="small muted center">Patrimoine · version 1.0</p>
        </div>
      </div>

      {pinStep > 0 && (
        <div className="overlay">
          <button type="button" className="iconbtn overlay-close" onClick={() => setPinStep(0)} aria-label="Annuler">
            <Icon name="close" />
          </button>
          {pinStep === 1 ? (
            <PinPad
              title="Nouveau code"
              error={pinError}
              onComplete={(p) => {
                setNewPin(p);
                setPinError(undefined);
                setPinStep(2);
              }}
            />
          ) : (
            <PinPad
              title="Confirme le nouveau code"
              onComplete={async (p) => {
                if (p !== newPin) {
                  setPinError('Les deux codes sont différents. Recommence.');
                  setPinStep(1);
                  return;
                }
                const pinHash = await hashPin(p);
                set({ pinHash });
                setPinStep(0);
                toast('Code modifié.');
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const RecurringSettings = () => {
  const { data, update, go } = useStore();
  const setRec = (recurring: typeof data.recurring) => update((d) => ({ ...d, recurring }));
  return (
    <div className="scroll">
      <div className="pad">
        <TopBar title="Revenus et charges" onBack={() => go({ name: 'settings' })} />
        <div className="stack">
          <p className="small muted">Ces opérations s'inscrivent toutes seules chaque mois. Tu les confirmes au point du mois.</p>
          <h3>Revenus</h3>
          <RecurringEditor kind="income" items={data.recurring} onChange={setRec} />
          <h3>Charges fixes</h3>
          <RecurringEditor kind="fixed" items={data.recurring} onChange={setRec} />
          <h3>Épargne de sécurité</h3>
          <RecurringEditor kind="safety" items={data.recurring} onChange={setRec} />
        </div>
      </div>
    </div>
  );
};

export const CatsSettings = () => {
  const { data, update, go } = useStore();
  const [name, setName] = useState('');
  return (
    <div className="scroll">
      <div className="pad">
        <TopBar title="Catégories de loisirs" onBack={() => go({ name: 'settings' })} />
        <ul className="ruled">
          {data.cats.map((c) => (
            <li key={c.id}>
              <input className="inline-text" aria-label="Nom de la catégorie" value={c.name} onChange={(e) => update((d) => ({ ...d, cats: d.cats.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) }))} />
              <button
                type="button"
                className="iconbtn"
                disabled={data.cats.length <= 1}
                onClick={() => update((d) => ({ ...d, cats: d.cats.filter((x) => x.id !== c.id) }))}
                aria-label={`Supprimer ${c.name}`}
              >
                <Icon name="trash" size={20} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="addrow"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            update((d) => ({ ...d, cats: [...d.cats, { id: uid(), name: name.trim() }] }));
            setName('');
          }}
        >
          <input id="new-cat" value={name} placeholder="Nouvelle catégorie" onChange={(e) => setName(e.target.value)} aria-label="Nouvelle catégorie" />
          <button type="submit" className="btn small-btn">
            Ajouter
          </button>
        </form>
      </div>
    </div>
  );
};

const KIND_LABEL: Record<string, string> = { leisure: 'Loisirs', life: 'Vie courante', exception: 'Exceptionnel', extra: 'Revenu exceptionnel', ignore: 'Virement interne' };

export const RulesSettings = () => {
  const { data, update, go } = useStore();
  return (
    <div className="scroll">
      <div className="pad">
        <TopBar title="Règles de rangement" onBack={() => go({ name: 'settings' })} />
        <p className="small muted">Apprises au point du mois : une opération dont le libellé contient ce mot est rangée automatiquement.</p>
        {data.rules.length === 0 ? (
          <p className="muted empty">Aucune règle pour l'instant.</p>
        ) : (
          <ul className="ruled">
            {data.rules.map((r) => (
              <li key={r.id}>
                <span className="lbl">
                  « {r.pattern} »
                  <span className="sub">
                    {KIND_LABEL[r.kind]}
                    {r.kind === 'leisure' && r.cat ? ` · ${data.cats.find((c) => c.id === r.cat)?.name ?? ''}` : ''}
                  </span>
                </span>
                <button type="button" className="iconbtn" onClick={() => update((d) => ({ ...d, rules: d.rules.filter((x) => x.id !== r.id) }))} aria-label={`Supprimer la règle ${r.pattern}`}>
                  <Icon name="trash" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

