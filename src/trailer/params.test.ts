import { describe, expect, it } from 'vitest';
import { locale } from '../i18n';
import { DEFAULT_CONFIG, LIMITS, OPTIONS, type TrailerConfig } from './config';
import { PANEL_LAYOUT, PARAMS, formatValue, isRelevant, optionsOf, rangeOf, type ParamKey } from './params';
import { resolve } from './rules';
import { SUMMARY_LAYOUT } from './summary';

const keys = Object.keys(DEFAULT_CONFIG) as ParamKey[];
const inPanel = Object.values(PANEL_LAYOUT).flatMap((items) =>
  items.flatMap((item): ParamKey[] => {
    if (typeof item === 'string') return [item];
    if ('grid' in item) return item.grid;
    if ('more' in item) return item.more.items.flatMap((inner) => (typeof inner === 'string' ? [inner] : inner.grid));
    return [];
  }),
);
const inSummary = SUMMARY_LAYOUT.flatMap((section) => section.items.flatMap((item) => (typeof item === 'string' ? [item] : (item.covers ?? []))));

describe('Parameterliste', () => {
  it('beschreibt jeden Parameter der Konfiguration genau einmal', () => {
    expect(Object.keys(PARAMS).sort()).toEqual([...keys].sort());
    const ids = Object.values(PARAMS).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('zeigt jeden Parameter genau einmal in der Bedienung, außer den Stellungen des Modells', () => {
    const expected = keys.filter((key) => !PARAMS[key].view).sort();
    expect([...inPanel].sort()).toEqual(expected);
  });

  it('führt jeden Parameter in der Zusammenfassung, außer den Stellungen des Modells', () => {
    const expected = keys.filter((key) => !PARAMS[key].view).sort();
    expect([...inSummary].sort()).toEqual(expected);
  });

  it('passt zur Art des Werts: Auswahllisten, Grenzen und Schalter', () => {
    const { config, derived } = resolve(DEFAULT_CONFIG);
    for (const key of keys) {
      const param = PARAMS[key];
      const start = DEFAULT_CONFIG[key];
      if (param.control === 'slider') {
        expect(typeof start, key).toBe('number');
        expect(param.limit ?? key, key).toSatisfy((limit: string) => limit in LIMITS);
        const range = rangeOf(key, config, derived);
        expect(range.min, key).toBeLessThanOrEqual(range.max);
        expect(range.step, key).toBeGreaterThan(0);
      } else if (param.control === 'segmented' || param.control === 'chips' || param.control === 'cards') {
        expect(param.numbers ? true : key in OPTIONS, key).toBe(true);
        expect(optionsOf(key, locale('de')).map((o) => o.id), key).toContain(start);
      } else if (param.control === 'switch') expect(typeof start, key).toBe('boolean');
      else if (param.control === 'number') expect(start, key).toBeNull();
      else expect(typeof start, key).toBe('string');
    }
  });

  it('zeigt Parameter nur dort, wo sie eine Rolle spielen', () => {
    const relevant = (overrides: Partial<TrailerConfig>) => {
      const { config } = resolve({ ...DEFAULT_CONFIG, ...overrides });
      return keys.filter((key) => isRelevant(key, config));
    };
    expect(relevant({})).not.toContain('bedHeightMm');
    expect(relevant({ body: 'lowbed' })).toEqual(expect.arrayContaining(['bedHeightMm', 'rearWheels', 'ramp']));
    expect(relevant({ body: 'lowbed' })).not.toContain('wallType');
    expect(relevant({ body: 'longload' })).toEqual(expect.arrayContaining(['minLengthMm', 'maxLengthMm', 'rasterMm']));
    expect(relevant({ body: 'longload' })).not.toContain('lashingRings');
    expect(relevant({ roof: 'tarp' })).toEqual(expect.arrayContaining(['roofShape', 'roofClearMm', 'roofSides']));
    expect(relevant({})).not.toContain('roofShape');
    expect(relevant({ deck: 'pine' })).toContain('edgeProtection');
    expect(relevant({})).not.toContain('edgeProtection');
    expect(relevant({ wallType: 'fixed' })).toEqual(expect.arrayContaining(['wallMaterial', 'wallHeightMm']));
    expect(relevant({ loadType: 'custom' })).toContain('loadNote');
    expect(relevant({ loadType: 'custom' })).not.toContain('loadLengthMm');
  });

  it('schreibt Werte so, wie sie in Bedienung und Zusammenfassung stehen', () => {
    const L = locale('de');
    const c: TrailerConfig = { ...DEFAULT_CONFIG, aisleWidthMm: 3200, notes: '  eilig  ' };
    expect(formatValue('payloadT', c, L)).toBe('24 t');
    expect(formatValue('lengthMm', c, L)).toBe('6.000 mm');
    expect(formatValue('speedKmh', c, L)).toBe('6 km/h');
    expect(formatValue('trailersInTrain', c, L)).toBe('1');
    expect(formatValue('tyre', c, L)).toBe('Vollgummi');
    expect(formatValue('wallHeightMm', c, L)).toBe('400 mm');
    expect(formatValue('publicRoads', c, L)).toBe('Nein');
    expect(formatValue('aisleWidthMm', c, L)).toBe('3.200 mm');
    expect(formatValue('curveRadiusMm', c, L)).toBe('Keine Angabe');
    expect(formatValue('notes', c, L)).toBe('eilig');
    expect(formatValue('colorId', c, L)).toBe('RAL 3020 Verkehrsrot');
    expect(formatValue('tyre', c, locale('en'))).toBe('Solid rubber');
  });

  it('gibt die Einstellbereiche aus Auslegung und Konfiguration wieder', () => {
    const { config, derived } = resolve({ ...DEFAULT_CONFIG, body: 'longload', minLengthMm: 6000, maxLengthMm: 7000, rasterMm: 500 });
    expect(rangeOf('lengthMm', config, derived)).toEqual({ min: config.minLengthMm, max: config.maxLengthMm, step: 500 });
    const std = resolve(DEFAULT_CONFIG);
    expect(rangeOf('lengthMm', std.config, std.derived)).toEqual({ ...LIMITS.lengthMm, min: std.derived.minLengthMm });
    expect(rangeOf('loadLengthMm', std.config, std.derived).max).toBe(std.config.lengthMm);
    expect(rangeOf('minLengthMm', std.config, std.derived)).toEqual({ ...LIMITS.lengthMm, step: 100 });
  });
});
