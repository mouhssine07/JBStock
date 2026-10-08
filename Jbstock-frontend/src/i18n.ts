import { useSyncExternalStore } from 'react';
import en from '../../desktop/src/locales/en.json';
import ar from '../../desktop/src/locales/ar.json';

export type Language = 'en' | 'ar';
export type MessageKey = Exclude<keyof typeof en, 'desktop'>;
const catalogs: Record<Language, typeof en> = { en, ar };
const storageKey = 'jbstock.language';
let state = { language: 'en' as Language, storageError: false, changing: false };
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
function applyLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  state = { ...state, language };
}
function isLanguage(value: unknown): value is Language { return value === 'en' || value === 'ar'; }

export async function initializeLanguage() {
  try {
    const result = window.jbstock ? await window.jbstock.getLanguage() : null;
    if (result && !result.ok) throw new Error('LANGUAGE_STORAGE_ERROR');
    const value = result?.ok ? result.data : localStorage.getItem(storageKey);
    if (value !== null && !isLanguage(value)) throw new Error('INVALID_LANGUAGE');
    applyLanguage(value ?? 'en');
  } catch {
    applyLanguage('en');
    state = { ...state, storageError: true };
  }
}

async function setLanguage(language: Language) {
  if (!isLanguage(language) || state.changing) return;
  state = { ...state, changing: true };
  notify();
  try {
    if (window.jbstock) {
      const result = await window.jbstock.setLanguage(language);
      if (!result.ok || result.data !== language) throw new Error('LANGUAGE_STORAGE_ERROR');
    } else localStorage.setItem(storageKey, language);
    applyLanguage(language);
    state = { ...state, storageError: false };
  } catch { state = { ...state, storageError: true }; }
  finally { state = { ...state, changing: false }; notify(); }
}

function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useLanguage() {
  const current = useSyncExternalStore(subscribe, () => state);
  const locale = current.language === 'ar' ? 'ar' : 'en';
  return { ...current, setLanguage,
    t: (key: MessageKey, values: Record<string, string> = {}) => catalogs[current.language][key]
      .replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match),
    formatNumber: (value: number) => new Intl.NumberFormat(locale).format(value),
    formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options).format(value),
    formatMoney: (value: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value),
  };
}
