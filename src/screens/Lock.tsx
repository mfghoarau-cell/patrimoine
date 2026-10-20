import { useState } from 'react';
import { Icon } from '../ui';

/** Pavé de code à 4 chiffres, utilisé pour déverrouiller et pour créer le code. */
export const PinPad = ({ title, subtitle, hint, error, onComplete }: { title: string; subtitle?: string; hint?: string; error?: string; onComplete: (pin: string) => void }) => {
  const [pin, setPin] = useState('');
  const press = (k: string) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) setTimeout(() => {
      onComplete(next);
      setPin('');
    }, 160);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="pin pad">
      <div className="brand">
        <Icon name="leaf" size={26} stroke={2} />
        Patrimoine
      </div>
      <h2>{title}</h2>
      {subtitle && <p className="small muted center">{subtitle}</p>}
      {hint && <p className="pin-hint">{hint}</p>}
      <div className="dots" aria-label={`${pin.length} chiffre(s) saisi(s) sur 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <p className="pin-error" role="alert">
        {error ?? ''}
      </p>
      <div className="keypad">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : k === 'del' ? (
            <button key={i} type="button" onClick={() => press('del')} aria-label="Effacer">
              <Icon name="back" size={26} />
            </button>
          ) : (
            <button key={i} type="button" onClick={() => press(k)}>
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
};
