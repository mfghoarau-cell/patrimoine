import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppData, Entry } from './types';
import { StoreContext, type Screen, type Store, type Tab } from './store';
import { askPersistence, loadData, saveData } from './lib/storage';
import { hashPin } from './lib/pin';
import { DEMO_PIN } from './lib/demo';
import { Icon } from './ui';
import { PinPad } from './screens/Lock';
import { Setup } from './screens/Setup';
import { Home } from './screens/Home';
import { Moves } from './screens/Moves';
import { EntrySheet } from './screens/EntrySheet';
import { Review } from './screens/Review';
import { GoalDetail, Goals } from './screens/Goals';
import { Patrimoine } from './screens/Patrimoine';
import { CatsSettings, RecurringSettings, RulesSettings, Settings } from './screens/Settings';

/** Verrouillage automatique après une minute en arrière-plan. */
const LOCK_AFTER_MS = 60_000;

const TABS: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'home', label: 'Accueil', icon: 'home' },
  { tab: 'moves', label: 'Mouvements', icon: 'list' },
  { tab: 'goals', label: 'Objectifs', icon: 'target' },
  { tab: 'patrimoine', label: 'Patrimoine', icon: 'bars' },
];

const tabOf = (s: Screen): Tab | null => {
  if (s.name === 'home' || s.name === 'moves' || s.name === 'goals' || s.name === 'patrimoine') return s.name;
  if (s.name === 'goal') return 'goals';
  return null;
};

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [locked, setLocked] = useState(() => !!data.settings.pinHash);
  const [pinError, setPinError] = useState<string>();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [entrySheet, setEntrySheet] = useState<{ entry?: Entry } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [today, setToday] = useState(() => new Date());
  const [saveFailed, setSaveFailed] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const toastTimer = useRef<number>();

  useEffect(() => {
    setSaveFailed(!saveData(data));
  }, [data]);

  useEffect(() => {
    void askPersistence();
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else {
        setToday(new Date());
        if (hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS && data.settings.pinHash) setLocked(true);
        hiddenAt.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [data.settings.pinHash]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const go = useCallback((s: Screen) => {
    setEntrySheet(null);
    setScreen(s);
    requestAnimationFrame(() => document.querySelector('.scroll')?.scrollTo({ top: 0 }));
  }, []);

  const store: Store = useMemo(
    () => ({
      data,
      today,
      update: (fn) => setData((d) => fn(d)),
      go,
      openEntry: (entry?: Entry) => setEntrySheet({ entry }),
      toast,
    }),
    [data, today, go, toast],
  );

  if (!data.settings.setupDone)
    return (
      <div className="app">
        <Setup
          initial={data}
          onDone={(d) => {
            setData(d);
            setLocked(false);
            setScreen({ name: 'home' });
          }}
        />
      </div>
    );

  if (locked)
    return (
      <div className="app">
        <PinPad
          title="Entre ton code"
          subtitle={data.settings.demo ? `Données d'exemple : code ${DEMO_PIN}` : undefined}
          error={pinError}
          onComplete={async (pin) => {
            if ((await hashPin(pin)) === data.settings.pinHash) {
              setPinError(undefined);
              setLocked(false);
              setToday(new Date());
            } else setPinError('Code incorrect.');
          }}
        />
      </div>
    );

  const active = tabOf(screen);
  let body: JSX.Element;
  switch (screen.name) {
    case 'home':
      body = <Home />;
      break;
    case 'moves':
      body = <Moves />;
      break;
    case 'goals':
      body = <Goals />;
      break;
    case 'goal':
      body = <GoalDetail id={screen.id} />;
      break;
    case 'patrimoine':
      body = <Patrimoine />;
      break;
    case 'settings':
      body = <Settings />;
      break;
    case 'recurring':
      body = <RecurringSettings />;
      break;
    case 'cats':
      body = <CatsSettings />;
      break;
    case 'rules':
      body = <RulesSettings />;
      break;
    case 'review':
      body = <Review key={screen.month} month={screen.month} />;
      break;
  }

  return (
    <StoreContext.Provider value={store}>
      <div className="app">
        {saveFailed && (
          <div className="savebar" role="alert">
            Enregistrement impossible sur ce téléphone. Exporte une sauvegarde depuis les réglages.
          </div>
        )}
        {body}
        {screen.name !== 'review' && (
          <nav className="tabbar" aria-label="Navigation principale">
            {TABS.slice(0, 2).map((t) => (
              <button key={t.tab} type="button" onClick={() => go({ name: t.tab })} aria-current={active === t.tab ? 'page' : undefined}>
                <Icon name={t.icon} size={24} />
                <span>{t.label}</span>
              </button>
            ))}
            <button type="button" className="add" onClick={() => setEntrySheet({})} aria-label="Ajouter une dépense">
              <span className="addc">
                <Icon name="plus" size={26} stroke={2.4} />
              </span>
              <span>Dépense</span>
            </button>
            {TABS.slice(2).map((t) => (
              <button key={t.tab} type="button" onClick={() => go({ name: t.tab })} aria-current={active === t.tab ? 'page' : undefined}>
                <Icon name={t.icon} size={24} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        )}
        {entrySheet && <EntrySheet entry={entrySheet.entry} onClose={() => setEntrySheet(null)} />}
        {toastMsg && (
          <div className="toast" role="status">
            {toastMsg}
          </div>
        )}
      </div>
    </StoreContext.Provider>
  );
}
