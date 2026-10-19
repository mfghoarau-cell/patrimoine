import { useRef, useState } from 'react';
import type { AppData } from '../types';
import { eur0, monthKey, uid } from '../lib/format';
import { plannedAvailable } from '../lib/budget';
import { hashPin } from '../lib/pin';
import { importJson } from '../lib/storage';
import { buildDemo, DEMO_PIN } from '../lib/demo';
import { Icon, MoneyField, Stepper } from '../ui';
import { PinPad } from './Lock';
import { RecurringEditor } from './RecurringEditor';

type Step = 'welcome' | 'pin' | 'pin2' | 'income' | 'fixed' | 'targets';
const ORDER: Step[] = ['welcome', 'pin', 'pin2', 'income', 'fixed', 'targets'];

/** Première configuration : tout ce qui se répète est saisi une seule fois. */
export const Setup = ({ initial, onDone }: { initial: AppData; onDone: (d: AppData) => void }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [d, setD] = useState<AppData>(() => ({
    ...initial,
    recurring: initial.recurring.length
      ? initial.recurring
      : [
          { id: uid(), label: 'Salaire', amount: 0, kind: 'income', day: 28, active: true },
          { id: uid(), label: 'Épargne de sécurité', amount: 0, kind: 'safety', day: 2, active: true },
        ],
  }));
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState<string>();
  const [restoreError, setRestoreError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const next = () => setStep(ORDER[ORDER.indexOf(step) + 1]);
  const prev = () => setStep(ORDER[Math.max(0, ORDER.indexOf(step) - 1)]);
  const available = plannedAvailable(d);
  const s = d.settings;
  const setSettings = (p: Partial<AppData['settings']>) => setD({ ...d, settings: { ...d.settings, ...p } });

  if (step === 'welcome')
    return (
      <div className="scroll">
        <div className="pad stack welcome">
          <div className="brand">
            <Icon name="leaf" size={30} stroke={2} />
            Patrimoine
          </div>
          <h2 className="display">Fixe ton cap, l'application t'aide à le tenir.</h2>
          <ol className="principles">
            <li>
              <strong>Tu déclares une fois</strong> tes revenus et tes charges qui reviennent chaque mois.
            </li>
            <li>
              <strong>Tu choisis deux cibles</strong> : un budget loisirs et un montant à investir.
            </li>
            <li>
              <strong>Au quotidien, tu ne saisis que tes loisirs.</strong> L'application te prévient si ta cible d'investissement est menacée.
            </li>
          </ol>
          <p className="small muted">Tes données restent sur ce téléphone. Configuration en 3 minutes.</p>
          <button type="button" className="btn" onClick={next}>
            Commencer
          </button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
            Restaurer une sauvegarde
          </button>
          <button type="button" className="linkbtn center-self" onClick={async () => onDone(buildDemo(new Date(), await hashPin(DEMO_PIN)))}>
            Découvrir avec des données d'exemple
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const res = importJson(await file.text(), d);
              if (!res.ok) return setRestoreError(res.error);
              setRestoreError(undefined);
              setD(res.data);
              if (res.data.settings.setupDone && res.data.settings.pinHash) onDone(res.data);
              else next();
            }}
          />
          {restoreError && (
            <p className="error" role="alert">
              {restoreError}
            </p>
          )}
        </div>
      </div>
    );

  if (step === 'pin')
    return (
      <PinPad
        title="Choisis un code"
        subtitle="Il protège l'accès à l'application sur ce téléphone."
        onComplete={(p) => {
          setFirstPin(p);
          setPinError(undefined);
          next();
        }}
      />
    );

  if (step === 'pin2')
    return (
      <PinPad
        title="Confirme ton code"
        error={pinError}
        onComplete={async (p) => {
          if (p !== firstPin) {
            setPinError('Les deux codes sont différents. Recommence.');
            setStep('pin');
            return;
          }
          setSettings({ pinHash: await hashPin(p) });
          next();
        }}
      />
    );

  const head = (n: number, title: string, sub: string) => (
    <div className="pad">
      <div className="flowbar">
        <button type="button" className="iconbtn" onClick={prev} aria-label="Étape précédente">
          <Icon name="left" />
        </button>
        <div className="eyebrow">Configuration · étape {n} sur 3</div>
      </div>
      <div className="steps" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= n ? 'on' : ''} />
        ))}
      </div>
      <h2 className="flow-title">{title}</h2>
      <p className="muted small flow-sub">{sub}</p>
    </div>
  );

  if (step === 'income') {
    const salary = d.recurring.filter((r) => r.kind === 'income');
    return (
      <>
        {head(1, 'Ce qui rentre et ce que tu mets de côté', 'Ces montants reviennent chaque mois : tu ne les saisiras plus.')}
        <div className="scroll">
          <div className="pad stack">
            <h3>Revenus</h3>
            <RecurringEditor kind="income" items={d.recurring} onChange={(recurring) => setD({ ...d, recurring })} />
            <h3>Épargne de sécurité programmée</h3>
            <RecurringEditor kind="safety" items={d.recurring} onChange={(recurring) => setD({ ...d, recurring })} />
            <MoneyField id="life" label="Forfait vie courante" value={s.lifeBudget} onChange={(lifeBudget) => setSettings({ lifeBudget })} hint="Courses, carburant, pharmacie : un montant mensuel réservé, sans suivi au quotidien." />
          </div>
        </div>
        <div className="flowfoot pad">
          <button type="button" className="btn" onClick={next} disabled={!salary.some((r) => r.amount > 0)}>
            Continuer
          </button>
        </div>
      </>
    );
  }

  if (step === 'fixed')
    return (
      <>
        {head(2, 'Tes charges fixes', 'Loyer, abonnements, assurances : tout ce qui est prélevé chaque mois.')}
        <div className="scroll">
          <div className="pad stack">
            <RecurringEditor kind="fixed" items={d.recurring} onChange={(recurring) => setD({ ...d, recurring })} />
          </div>
        </div>
        <div className="flowfoot pad">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const rest = Math.max(0, available);
              const leisure = Math.min(s.targetLeisure, Math.round((rest * 0.35) / 10) * 10);
              setSettings({ targetLeisure: leisure, targetInvest: Math.max(0, Math.floor((rest - leisure) / 10) * 10) });
              next();
            }}
          >
            Continuer
          </button>
        </div>
      </>
    );

  const over = s.targetLeisure + s.targetInvest - available;
  return (
    <>
      {head(3, 'Tes deux cibles', `Après charges, vie courante et épargne de sécurité, il reste ${eur0(available)} par mois à partager.`)}
      <div className="scroll">
        <div className="pad stack">
          <div className="alloc">
            <div className="lbl">
              <strong>Loisirs</strong>
              <div className="small muted">Ce que tu t'autorises chaque mois</div>
            </div>
            <Stepper id="t-leisure" label="Loisirs" value={s.targetLeisure} onChange={(v) => setSettings({ targetLeisure: v })} format={eur0} />
          </div>
          <div className="alloc">
            <div className="lbl">
              <strong>Investissement</strong>
              <div className="small muted">Ce que tu veux placer chaque mois</div>
            </div>
            <Stepper id="t-invest" label="Investissement" value={s.targetInvest} onChange={(v) => setSettings({ targetInvest: v })} format={eur0} />
          </div>
          {over > 0 ? (
            <p className="error">Tes deux cibles dépassent de {eur0(over)} ce qui reste chaque mois. Baisse l'une des deux.</p>
          ) : (
            <p className="small muted num">Marge non affectée : {eur0(-over)} par mois.</p>
          )}
        </div>
      </div>
      <div className="flowfoot pad">
        <button
          type="button"
          className="btn"
          disabled={over > 0}
          onClick={() =>
            onDone({
              ...d,
              recurring: d.recurring.filter((r) => r.amount > 0 && r.label.trim()),
              settings: { ...d.settings, setupDone: true, startMonth: d.settings.startMonth || monthKey(new Date()) },
            })
          }
        >
          Terminer
        </button>
      </div>
    </>
  );
};
