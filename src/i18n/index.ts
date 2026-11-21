/**
 * Mehrsprachigkeit.
 *
 * Die Ausgangstexte im Code sind deutsch und dienen zugleich als Schlüssel:
 * `t('Stückliste')` liefert in Deutsch den Text selbst, sonst die Übersetzung
 * aus translations.ts. Platzhalter in geschweiften Klammern werden ersetzt;
 * Zahlen erscheinen in der Schreibweise der gewählten Sprache.
 */
import { TRANSLATIONS } from './translations';

export const LANGUAGES = [
  { id: 'de', name: 'Deutsch', tag: 'de-DE' },
  { id: 'en', name: 'English', tag: 'en-GB' },
  { id: 'sk', name: 'Slovenčina', tag: 'sk-SK' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['id'];

/**
 * Werte für Platzhalter. Zahlen werden formatiert, Begriffe mit übersetzt;
 * { raw } setzt einen Text unverändert ein, etwa einen vom Nutzer vergebenen Namen.
 */
export type Vars = Record<string, string | number | { raw: string }>;

/** Text mit Platzhaltern, der erst bei der Anzeige übersetzt wird. */
export interface Msg {
  text: string;
  vars?: Vars;
}
export const msg = (text: string, vars?: Vars): Msg => ({ text, vars });

export interface Locale {
  lang: Lang;
  /** Übersetzt einen deutschen Ausgangstext und setzt Platzhalter ein. */
  t: (text: string, vars?: Vars) => string;
  m: (message: Msg) => string;
  /** Benennung eines Bauteils; Durchmesserangaben im Namen bleiben erhalten. */
  partName: (name: string) => string;
  nf: (value: number) => string;
  mm: (value: number) => string;
  kg: (value: number) => string;
  eur: (value: number) => string;
  date: (value: Date) => string;
  dateTime: (value: Date) => string;
}

const cache = new Map<Lang, Locale>();

/** Ausgangstexte, für die in einer Fremdsprache keine Übersetzung hinterlegt ist; dient den Tests. */
export const untranslated = new Set<string>();

export function locale(lang: Lang): Locale {
  const cached = cache.get(lang);
  if (cached) return cached;

  const tag = LANGUAGES.find((l) => l.id === lang)!.tag;
  const number = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const currency = new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const dateLong = new Intl.DateTimeFormat(tag, { dateStyle: 'long' });
  const dateShort = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' });

  const lookup = (text: string) => {
    if (lang === 'de') return text;
    const found = TRANSLATIONS[text]?.[lang];
    if (found === undefined) untranslated.add(text);
    return found ?? text;
  };
  const t = (text: string, vars?: Vars) => {
    const template = lookup(text);
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = vars[name];
      if (value === undefined) return whole;
      // Zahlen in Landesschreibweise; eingesetzte Begriffe wie "Vollgummi" werden mit übersetzt.
      if (typeof value === 'number') return number.format(value);
      return typeof value === 'string' ? lookup(value) : value.raw;
    });
  };
  const partName = (name: string) => {
    const match = /^(.*?)( Ø \d+)?(, spurfrei)?$/.exec(name);
    if (!match) return lookup(name);
    return `${lookup(match[1])}${match[2] ?? ''}${match[3] ? lookup(match[3]) : ''}`;
  };

  const result: Locale = {
    lang,
    t,
    m: (message) => t(message.text, message.vars),
    partName,
    nf: (value) => number.format(value),
    mm: (value) => `${number.format(value)} mm`,
    kg: (value) => `${number.format(value)} kg`,
    eur: (value) => currency.format(value),
    date: (value) => dateLong.format(value),
    dateTime: (value) => dateShort.format(value),
  };
  cache.set(lang, result);
  return result;
}

const STORAGE_KEY = 'anhaenger-konfigurator/sprache';

/** Zuletzt gewählte Sprache, sonst die des Browsers, sonst Deutsch. */
export function initialLang(): Lang {
  const known = (value: string | null | undefined): Lang | null => LANGUAGES.find((l) => l.id === value?.slice(0, 2).toLowerCase())?.id ?? null;
  try {
    const stored = known(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Ohne lokalen Speicher entscheidet die Browsersprache.
  }
  return (typeof navigator !== 'undefined' ? known(navigator.language) : null) ?? 'de';
}

export function rememberLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Die Wahl gilt dann nur für diese Sitzung.
  }
}
