import { useEffect, useState, type ReactNode } from 'react';
import { parseAmount } from './lib/format';

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  bars: <path d="M4 20h16M6 20v-7M10.5 20V8M15 20v-5M19.5 20V5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  left: <path d="M15 18l-6-6 6-6" />,
  right: <path d="M9 18l6-6-6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  warn: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: (
    <>
      <path d="M21 6H9l-6 6 6 6h12z" />
      <path d="m16 10-4 4m0-4 4 4" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
      <path d="M5 19l7-7" />
    </>
  ),
  wheel: (
    <>
      <circle cx="7.6" cy="15.6" r="2" />
      <path d="M10.2 13.2 14.6 8.4" />
      <path d="M10.2 13.2 6 21M10.2 13.2 13.4 21" />
      <path d="M14.6 8.4 10.6 2.6M14.6 8.4 21 5.6" />
      <path d="M3 21h18" strokeOpacity=".45" />
    </>
  ),
  stock: (
    <>
      <path d="M3 20h18" strokeOpacity=".45" />
      <path d="M3.5 16.5 9 11l4 4 7.5-8" />
      <path d="M15 7h5.5v5.5" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  download: <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" />,
  upload: <path d="M12 20V9m0 0 4.5 4.5M12 9l-4.5 4.5M5 4h14" />,
};

export type IconName = keyof typeof PATHS;

export const Icon = ({ name, size = 22, stroke = 1.8 }: { name: string; size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

export const Tag = ({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) => <span className={`tag ${tone}`}>{children}</span>;

export const Gauge = ({ value, max, tick, label, tone }: { value: number; max: number; tick?: number; label: string; tone?: string }) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const t = tick !== undefined && max > 0 ? Math.max(0, Math.min(100, (tick / max) * 100)) : null;
  return (
    <div className={`gauge ${tone ?? ''}`} role="img" aria-label={label}>
      <div className="fill" style={{ width: `${pct}%` }} />
      {t !== null && <div className="tick" style={{ left: `calc(${t}% - 1px)` }} />}
    </div>
  );
};

export const Stepper = ({ id, label, value, step = 10, min = 0, onChange, format }: { id: string; label: string; value: number; step?: number; min?: number; onChange: (v: number) => void; format: (n: number) => string }) => (
  <div className="stepper" id={id}>
    <button type="button" onClick={() => onChange(Math.max(min, value - step))} aria-label={`Retirer ${step} € à ${label}`}>
      −
    </button>
    <output aria-live="polite" className="num">
      {format(value)}
    </output>
    <button type="button" onClick={() => onChange(value + step)} aria-label={`Ajouter ${step} € à ${label}`}>
      +
    </button>
  </div>
);

/** Champ de montant : garde le texte saisi tant qu'il est en cours d'édition. */
export const MoneyField = ({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (n: number) => void; hint?: string }) => {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  useEffect(() => {
    const parsed = parseAmount(text) ?? 0;
    if (Math.abs(parsed - value) > 0.001) setText(value ? String(value).replace('.', ',') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder="0"
          onChange={(e) => {
            setText(e.target.value);
            const n = parseAmount(e.target.value);
            onChange(n !== null && n >= 0 ? n : 0);
          }}
        />
        <span>€</span>
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
};

export const TextField = ({ id, label, value, onChange, placeholder, type = 'text' }: { id: string; label: string; value: string; onChange: (s: string) => void; placeholder?: string; type?: string }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} value={value} placeholder={placeholder} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
  </div>
);

export const Sheet = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet pad" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="row">
          <h3>{title}</h3>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/** Bouton qui demande une confirmation dans la page avant d'agir. */
export const ConfirmButton = ({ label, confirmLabel, onConfirm, className = 'btn danger' }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) => {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <div className="confirm">
      <button type="button" className={className} onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button type="button" className="btn ghost" onClick={() => setArmed(false)}>
        Annuler
      </button>
    </div>
  ) : (
    <button type="button" className={className} onClick={() => setArmed(true)}>
      {label}
    </button>
  );
};

export const TopBar = ({ eyebrow, title, onBack, action }: { eyebrow?: string; title: string; onBack?: () => void; action?: ReactNode }) => (
  <header className="topbar">
    {onBack && (
      <button type="button" className="iconbtn back" onClick={onBack} aria-label="Retour">
        <Icon name="left" />
      </button>
    )}
    <div className="tb-text">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
    </div>
    {action}
  </header>
);
