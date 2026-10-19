import { useState } from 'react';
import type { ImmoSettings, PeaHolding } from '../types';
import { useStore } from '../store';
import { immoResult, peaFiveYears, peaSummary } from '../lib/patrimoine';
import { eur, eur0, parseAmount, uid } from '../lib/format';
import { ConfirmButton, Icon, Sheet, TextField, TopBar } from '../ui';

const NumField = ({ id, label, value, onChange, unit = '€' }: { id: string; label: string; value: number; onChange: (n: number) => void; unit?: string }) => {
  const [text, setText] = useState(String(value).replace('.', ','));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseAmount(e.target.value);
            if (n !== null) onChange(n);
          }}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
};

const HoldingSheet = ({ holding, onClose }: { holding?: PeaHolding; onClose: () => void }) => {
  const { update } = useStore();
  const [h, setH] = useState<PeaHolding>(holding ?? { id: uid(), name: '', isin: '', quantity: 0, avgBuyPrice: 0, currentPrice: 0 });
  const set = (p: Partial<PeaHolding>) => setH({ ...h, ...p });
  return (
    <Sheet title={holding ? 'Modifier la position' : 'Nouvelle position'} onClose={onClose}>
      <TextField id="h-name" label="Nom" value={h.name} placeholder="ETF Monde" onChange={(name) => set({ name })} />
      <TextField id="h-isin" label="ISIN (facultatif)" value={h.isin} onChange={(isin) => set({ isin })} />
      <div className="two">
        <NumField id="h-qty" label="Quantité" unit="parts" value={h.quantity} onChange={(quantity) => set({ quantity })} />
        <NumField id="h-pru" label="Prix de revient" value={h.avgBuyPrice} onChange={(avgBuyPrice) => set({ avgBuyPrice })} />
      </div>
      <NumField id="h-price" label="Cours actuel" value={h.currentPrice} onChange={(currentPrice) => set({ currentPrice })} />
      <button
        type="button"
        className="btn"
        disabled={!h.name.trim()}
        onClick={() => {
          update((d) => ({ ...d, pea: { ...d.pea, holdings: holding ? d.pea.holdings.map((x) => (x.id === h.id ? h : x)) : [...d.pea.holdings, h] } }));
          onClose();
        }}
      >
        Enregistrer
      </button>
      {holding && (
        <ConfirmButton
          label="Supprimer la position"
          confirmLabel="Confirmer la suppression"
          className="btn danger-ghost"
          onConfirm={() => {
            update((d) => ({ ...d, pea: { ...d.pea, holdings: d.pea.holdings.filter((x) => x.id !== holding.id) } }));
            onClose();
          }}
        />
      )}
    </Sheet>
  );
};

const ImmoSheet = ({ onClose }: { onClose: () => void }) => {
  const { data, update } = useStore();
  const [f, setF] = useState<ImmoSettings>(data.immo);
  const r = immoResult(f);
  const n = (key: keyof ImmoSettings, label: string, unit = '€') => <NumField id={`im-${key}`} label={label} unit={unit} value={f[key]} onChange={(v) => setF({ ...f, [key]: v })} />;
  return (
    <Sheet title="Simulation immobilière" onClose={onClose}>
      <dl className="ledger num">
        <dt>Coût total du projet</dt>
        <dd>{eur0(r.projectCost)}</dd>
        <dt>Montant emprunté</dt>
        <dd>{eur0(r.loan)}</dd>
        <dt>Mensualité</dt>
        <dd>{eur(r.payment)}</dd>
        <dt>Cash-flow mensuel</dt>
        <dd className={r.cashflow >= 0 ? 'pos' : 'neg'}>{eur(r.cashflow)}</dd>
        <dt>Rendement brut</dt>
        <dd>{r.grossYield.toFixed(2).replace('.', ',')} %</dd>
        <dt className="total">Rendement net simplifié</dt>
        <dd className="total">{r.netYield.toFixed(2).replace('.', ',')} %</dd>
      </dl>
      <div className="two">
        {n('price', 'Prix du bien')}
        {n('downPayment', 'Apport')}
        {n('notaryRate', 'Frais de notaire', '%')}
        {n('agencyFees', "Frais d'agence")}
        {n('renovationBudget', 'Travaux')}
        {n('loanRate', 'Taux du prêt', '%')}
        {n('loanDurationYears', 'Durée', 'ans')}
        {n('rentMonthly', 'Loyer mensuel')}
        {n('chargesMonthly', 'Charges mensuelles')}
        {n('insuranceMonthly', 'Assurance mensuelle')}
        {n('propertyTaxYearly', 'Taxe foncière annuelle')}
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => {
          update((d) => ({ ...d, immo: f }));
          onClose();
        }}
      >
        Enregistrer la simulation
      </button>
    </Sheet>
  );
};

export const Patrimoine = () => {
  const { data, update } = useStore();
  const [holding, setHolding] = useState<PeaHolding | 'new' | null>(null);
  const [immo, setImmo] = useState(false);
  const s = peaSummary(data.pea.holdings);
  const five = peaFiveYears(data.pea.openDate);
  const deposits = data.contributions.filter((c) => c.goalId === 'pea').reduce((a, c) => a + c.amount, 0);
  const r = immoResult(data.immo);
  return (
    <div className="scroll">
      <div className="pad">
        <TopBar eyebrow="PEA et projets" title="Patrimoine" />
        <div className="stack">
          <section className="env invest">
            <div className="env-head">
              <Icon name="stock" />
              <span>PEA</span>
            </div>
            <div className="big num">{eur0(s.value)}</div>
            <dl className="ledger num">
              <dt>Investi (prix de revient)</dt>
              <dd>{eur0(s.invested)}</dd>
              <dt>Plus-value latente</dt>
              <dd className={s.gain >= 0 ? 'pos' : 'neg'}>
                {s.gain >= 0 ? '+ ' : '− '}
                {eur0(Math.abs(s.gain))} · {s.gainPct.toFixed(1).replace('.', ',')} %
              </dd>
              <dt>Versé via le point du mois</dt>
              <dd>{eur0(deposits)}</dd>
              <dt className="total">Fiscalité allégée</dt>
              <dd className="total">{five ? (five <= new Date() ? 'acquise' : five.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })) : '—'}</dd>
            </dl>
            <TextField id="pea-open" type="date" label="Date d'ouverture du PEA" value={data.pea.openDate} onChange={(openDate) => update((d) => ({ ...d, pea: { ...d.pea, openDate } }))} />
          </section>
          <section>
            <div className="row">
              <h3>Positions</h3>
              <button type="button" className="linkbtn" onClick={() => setHolding('new')}>
                Ajouter
              </button>
            </div>
            {data.pea.holdings.length === 0 ? (
              <p className="muted small">Ajoute tes lignes pour suivre la valeur de ton PEA. Mets à jour les cours quand tu le souhaites.</p>
            ) : (
              <ul className="ruled num">
                {data.pea.holdings.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="rowbtn" onClick={() => setHolding(h)}>
                      <span className="lbl">
                        {h.name}
                        <span className="sub">
                          {h.quantity.toLocaleString('fr-FR')} parts · cours {eur(h.currentPrice)}
                        </span>
                      </span>
                      <span className="amt">{eur0(h.quantity * h.currentPrice)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <button type="button" className="cta-card" onClick={() => setImmo(true)}>
            <Icon name="home" size={24} />
            <div>
              <div className="t">Simulation immobilière</div>
              <div className="s num">
                Mensualité {eur0(r.payment)} · cash-flow {eur0(r.cashflow)}
              </div>
            </div>
            <span className="chev">
              <Icon name="right" />
            </span>
          </button>
        </div>
      </div>
      {holding && <HoldingSheet holding={holding === 'new' ? undefined : holding} onClose={() => setHolding(null)} />}
      {immo && <ImmoSheet onClose={() => setImmo(false)} />}
    </div>
  );
};
