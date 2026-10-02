import {useSyncExternalStore} from 'react';
import {normalizeView} from './battlefield-lab.mjs';

// Preview choices and measured native layout. Kept outside authored records and undo history.
const KEY = 'ashenedspire.battlefield.view';
const read = () => {try {return normalizeView(JSON.parse(localStorage.getItem(KEY) || '{}'));} catch {return normalizeView({});}};
let state = {view: read(), metrics: null, catalog: null, selected: null};
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());

export const battlefieldView = {
  get: () => state,
  subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
  setView(patch) {
    state = {...state, view: normalizeView({...state.view, ...patch})};
    if ('device' in patch || 'encounter' in patch || 'testClass' in patch) state.metrics = null;
    try {localStorage.setItem(KEY, JSON.stringify(state.view));} catch {}
    emit();
  },
  setMetrics(metrics) {state = {...state, metrics}; emit();},
  setCatalog(catalog) {state = {...state, catalog}; emit();},
  select(eid) {state = {...state, selected: eid}; emit();},
};

export const useBattlefieldView = () => useSyncExternalStore(battlefieldView.subscribe, battlefieldView.get);
