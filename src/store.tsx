import { createContext, useContext } from 'react';
import type { AppData, Entry } from './types';

export type Screen =
  | { name: 'home' }
  | { name: 'moves' }
  | { name: 'goals' }
  | { name: 'goal'; id: string }
  | { name: 'patrimoine' }
  | { name: 'settings' }
  | { name: 'recurring' }
  | { name: 'cats' }
  | { name: 'rules' }
  | { name: 'review'; month: string };

export type Tab = 'home' | 'moves' | 'goals' | 'patrimoine';

export interface Store {
  data: AppData;
  today: Date;
  update: (fn: (d: AppData) => AppData) => void;
  go: (s: Screen) => void;
  openEntry: (entry?: Entry) => void;
  toast: (message: string) => void;
}

export const StoreContext = createContext<Store | null>(null);

export const useStore = (): Store => {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreContext manquant');
  return s;
};

export const catName = (data: AppData, id?: string): string => data.cats.find((c) => c.id === id)?.name ?? 'Loisirs';
