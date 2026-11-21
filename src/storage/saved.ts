/**
 * Gespeicherte Konfigurationen.
 *
 * Abgelegt wird im lokalen Speicher des Browsers, also je Gerät und Browser.
 * Zum Weitergeben lassen sich die Einträge als Datei aus- und einlesen.
 */
import { COLORS, DEFAULT_CONFIG, OPTIONS, type TrailerConfig } from '../trailer/config';

export interface SavedConfig {
  id: string;
  name: string;
  /** Zeitpunkt des letzten Speicherns, ISO 8601. */
  savedAt: string;
  /** Die gewünschten Werte, wie eingegeben; das Regelwerk wird beim Laden neu angewandt. */
  config: TrailerConfig;
}

/** Der Teil der Browser-Speicherschnittstelle, der hier gebraucht wird. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const LIST_KEY = 'anhaenger-konfigurator/gespeichert/v1';
const DRAFT_KEY = 'anhaenger-konfigurator/entwurf/v1';
const FILE_FORMAT = 'anhaenger-konfigurationen';

/** Lokaler Speicher des Browsers; fehlt er oder ist er gesperrt, ein flüchtiger Ersatz. */
function browserStore(): KeyValueStore {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Zugriff vom Browser verweigert.
  }
  const memory = new Map<string, string>();
  return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
}

/**
 * Macht aus beliebigen gelesenen Daten eine vollständige, gültige Konfiguration.
 * Unbekannte Felder entfallen, fehlende oder ungültige erhalten den Standardwert.
 * So bleiben Einträge aus älteren Versionen des Konfigurators ladbar.
 */
export function sanitizeConfig(raw: unknown): TrailerConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const options = OPTIONS as Record<string, readonly { id: string | number }[]>;
  const result = { ...DEFAULT_CONFIG } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(DEFAULT_CONFIG)) {
    const value = source[key];
    if (key in options) {
      if (options[key].some((o) => o.id === value)) result[key] = value;
    } else if (key === 'colorId') {
      if (COLORS.some((c) => c.id === value)) result[key] = value;
    } else if (fallback === null) {
      // Freie Zahlenfelder: eine Zahl oder "keine Angabe".
      if (value === null || (typeof value === 'number' && Number.isFinite(value))) result[key] = value;
    } else if (typeof fallback === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    } else if (typeof value === typeof fallback) {
      result[key] = value;
    }
  }
  return result as unknown as TrailerConfig;
}

function sanitizeEntry(raw: unknown): SavedConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!name) return null;
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : newId(),
    name,
    savedAt: typeof entry.savedAt === 'string' && !Number.isNaN(Date.parse(entry.savedAt)) ? entry.savedAt : new Date().toISOString(),
    config: sanitizeConfig(entry.config),
  };
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de');
const newestFirst = (list: SavedConfig[]) => [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

export function listSaved(store: KeyValueStore = browserStore()): SavedConfig[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(LIST_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return newestFirst(parsed.map(sanitizeEntry).filter((e): e is SavedConfig => e !== null));
  } catch {
    return [];
  }
}

function write(list: SavedConfig[], store: KeyValueStore): SavedConfig[] {
  const sorted = newestFirst(list);
  store.setItem(LIST_KEY, JSON.stringify(sorted));
  return sorted;
}

/** Speichert unter einem Namen; ein vorhandener Eintrag gleichen Namens wird überschrieben. */
export function saveConfig(name: string, config: TrailerConfig, store: KeyValueStore = browserStore()): { list: SavedConfig[]; entry: SavedConfig } {
  const list = listSaved(store);
  const existing = list.find((e) => sameName(e.name, name));
  const entry: SavedConfig = { id: existing?.id ?? newId(), name: name.trim(), savedAt: new Date().toISOString(), config: sanitizeConfig(config) };
  return { list: write([...list.filter((e) => e.id !== entry.id), entry], store), entry };
}

export function deleteSaved(id: string, store: KeyValueStore = browserStore()): SavedConfig[] {
  return write(listSaved(store).filter((e) => e.id !== id), store);
}

/** Gibt es schon einen Eintrag mit diesem Namen? */
export function findByName(list: SavedConfig[], name: string): SavedConfig | undefined {
  return list.find((e) => sameName(e.name, name));
}

/** Alle Einträge als Dateiinhalt zum Weitergeben. */
export function exportSaved(list: SavedConfig[]): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, entries: list }, null, 2);
}

/**
 * Liest Einträge aus einem Dateiinhalt und nimmt sie auf. Gleichnamige Einträge
 * werden überschrieben. Wirft, wenn der Inhalt keine Konfigurationen enthält.
 */
export function importSaved(text: string, store: KeyValueStore = browserStore()): { list: SavedConfig[]; imported: number } {
  const parsed: unknown = JSON.parse(text);
  const entries = parsed && typeof parsed === 'object' && (parsed as { format?: unknown }).format === FILE_FORMAT ? (parsed as { entries?: unknown }).entries : null;
  if (!Array.isArray(entries)) throw new Error('Keine Konfigurationsdatei');
  const incoming = entries.map(sanitizeEntry).filter((e): e is SavedConfig => e !== null);
  if (incoming.length === 0) throw new Error('Keine Konfigurationen enthalten');
  let list = listSaved(store);
  for (const entry of incoming) {
    const existing = findByName(list, entry.name);
    list = [...list.filter((e) => e.id !== existing?.id && e.id !== entry.id), { ...entry, id: existing?.id ?? entry.id }];
  }
  return { list: write(list, store), imported: incoming.length };
}

/** Arbeitsstand, damit ein Neuladen der Seite nichts verwirft. */
export interface Draft {
  config: TrailerConfig;
  /** Der gespeicherte Eintrag, aus dem der Arbeitsstand stammt. */
  currentId: string | null;
}

export function loadDraft(store: KeyValueStore = browserStore()): Draft | null {
  try {
    const parsed: unknown = JSON.parse(store.getItem(DRAFT_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const draft = parsed as Record<string, unknown>;
    return { config: sanitizeConfig(draft.config), currentId: typeof draft.currentId === 'string' ? draft.currentId : null };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft, store: KeyValueStore = browserStore()) {
  try {
    store.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ohne Speicher geht der Arbeitsstand beim Neuladen verloren; die Seite funktioniert trotzdem.
  }
}
