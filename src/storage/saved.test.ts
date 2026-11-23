import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../trailer/config';
import { resolve } from '../trailer/rules';
import { clearSaved, deleteSaved, exportSaved, importSaved, listSaved, loadDraft, sanitizeConfig, saveConfig, saveDraft, type KeyValueStore } from './saved';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('gespeicherte Konfigurationen', () => {
  it('speichert unter einem Namen und lädt unverändert', () => {
    const store = memoryStore();
    const config = { ...DEFAULT_CONFIG, payloadT: 12, body: 'lowbed' as const, notes: 'Halle 3' };
    const { entry } = saveConfig('  Tieflader Halle 3 ', config, store);
    expect(entry.name).toBe('Tieflader Halle 3');
    const [loaded] = listSaved(store);
    expect(loaded.config).toEqual(config);
    expect(loaded.id).toBe(entry.id);
  });

  it('überschreibt einen Eintrag gleichen Namens statt ihn zu verdoppeln', () => {
    const store = memoryStore();
    const first = saveConfig('Standard', DEFAULT_CONFIG, store).entry;
    const { list, entry } = saveConfig('standard', { ...DEFAULT_CONFIG, payloadT: 30 }, store);
    expect(list).toHaveLength(1);
    expect(entry.id).toBe(first.id);
    expect(list[0].config.payloadT).toBe(30);
  });

  it('löscht einzelne Einträge', () => {
    const store = memoryStore();
    const a = saveConfig('A', DEFAULT_CONFIG, store).entry;
    saveConfig('B', DEFAULT_CONFIG, store);
    expect(deleteSaved(a.id, store).map((e) => e.name)).toEqual(['B']);
  });

  it('löscht auf Wunsch alle Einträge', () => {
    const store = memoryStore();
    saveConfig('A', DEFAULT_CONFIG, store);
    saveConfig('B', DEFAULT_CONFIG, store);
    expect(clearSaved(store)).toEqual([]);
    expect(listSaved(store)).toEqual([]);
  });

  it('übersteht beschädigte oder fremde Speicherinhalte', () => {
    const store = memoryStore();
    store.setItem('anhaenger-konfigurator/gespeichert/v1', '{kaputt');
    expect(listSaved(store)).toEqual([]);
    store.setItem('anhaenger-konfigurator/gespeichert/v1', JSON.stringify([{ name: '' }, 5, { name: 'Gültig', config: null }]));
    expect(listSaved(store).map((e) => e.name)).toEqual(['Gültig']);
    expect(listSaved(store)[0].config).toEqual(DEFAULT_CONFIG);
  });

  it('gibt Einträge als Datei weiter und liest sie wieder ein', () => {
    const source = memoryStore();
    saveConfig('Eins', { ...DEFAULT_CONFIG, payloadT: 8 }, source);
    saveConfig('Zwei', { ...DEFAULT_CONFIG, steering: 'allWheel' }, source);
    const target = memoryStore();
    saveConfig('Zwei', DEFAULT_CONFIG, target);
    const { list, imported } = importSaved(exportSaved(listSaved(source)), target);
    expect(imported).toBe(2);
    expect(list).toHaveLength(2);
    expect(list.find((e) => e.name === 'Zwei')!.config.steering).toBe('allWheel');
    expect(() => importSaved('{"irgendwas": 1}', target)).toThrow();
    expect(() => importSaved('kein json', target)).toThrow();
  });

  it('merkt sich den Arbeitsstand', () => {
    const store = memoryStore();
    expect(loadDraft(store)).toBeNull();
    saveDraft({ config: { ...DEFAULT_CONFIG, widthMm: 2000 }, currentId: 'abc' }, store);
    expect(loadDraft(store)).toEqual({ config: { ...DEFAULT_CONFIG, widthMm: 2000 }, currentId: 'abc' });
  });
});

describe('sanitizeConfig', () => {
  it('ergänzt fehlende Felder und verwirft unbekannte und ungültige', () => {
    const config = sanitizeConfig({
      payloadT: 30,
      deck: 'wood', // Option aus einer älteren Version
      colorId: 'gibt-es-nicht',
      lengthMm: '6000',
      couplingHeightMm: 650,
      towForceN: 'viel',
      wallHeightMm: 500,
      fremdesFeld: true,
    });
    expect(config).toEqual({ ...DEFAULT_CONFIG, payloadT: 30, couplingHeightMm: 650 });
    expect(Object.keys(config)).toEqual(Object.keys(DEFAULT_CONFIG));
  });

  it('liefert immer eine baubare Konfiguration', () => {
    for (const raw of [null, 7, 'text', [], { payloadT: Infinity, axles: -3, body: 'longload', minLengthMm: 1 }]) {
      const { config } = resolve(sanitizeConfig(raw));
      expect(config.payloadT).toBeGreaterThan(0);
      expect(Number.isFinite(config.lengthMm)).toBe(true);
    }
  });
});
