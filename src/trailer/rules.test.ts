import { describe, expect, it } from 'vitest';
import { ADVICE_RULES, advise } from './advice';
import { DEFAULT_CONFIG, type TrailerConfig } from './config';
import { RULES, resolve } from './rules';

const applied = (overrides: Partial<TrailerConfig>) => resolve({ ...DEFAULT_CONFIG, ...overrides }).applied;

describe('Regelwerk aus einzelnen Regeln', () => {
  it('gibt jeder Regel einen eindeutigen Namen', () => {
    const ids = [...RULES.choices, ...RULES.sizes, ...RULES.details].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const advice = ADVICE_RULES.map((r) => r.id);
    expect(new Set(advice).size).toBe(advice.length);
  });

  it('lässt die Standardkonfiguration unverändert', () => {
    const r = resolve(DEFAULT_CONFIG);
    expect(r.applied).toEqual([]);
    expect(r.adjustments).toEqual({});
    expect(r.config).toEqual(DEFAULT_CONFIG);
  });

  it('nennt die Regeln, die eingegriffen haben', () => {
    expect(applied({ payloadT: 40 })).toEqual(['minAxlesForPayload', 'minDeckHeightAboveWheels']);
    expect(applied({ drawbarUp: true, steeringDeg: 20 })).toEqual(['raisedDrawbarPointsStraight']);
    expect(applied({ body: 'lowbed', rearWheels: 'outside', steering: 'allWheel' })).toContain('steeredRearWheelsRunInside');
    expect(applied({ body: 'lowbed', ramp: 'rear' })).toContain('rearRampNeedsOutsideWheels');
    expect(applied({ body: 'lowbed', wallType: 'fixed', roof: 'tarp' })).toContain('platformOnlyBody');
    expect(applied({ loadLengthMm: 9000 })).toEqual(['loadFitsDeck']);
  });

  it('zeigt einen Hinweis genau an dem Feld, das die Regel nennt', () => {
    const r = resolve({ ...DEFAULT_CONFIG, payloadT: 40 });
    expect(Object.keys(r.adjustments).sort()).toEqual(['axles', 'deckHeightMm']);
    // Stille Regeln ändern, ohne einen Hinweis zu hinterlassen.
    expect(resolve({ ...DEFAULT_CONFIG, loadLengthMm: 9000 }).adjustments).toEqual({});
  });

  it('wendet die Mindestmaße wiederholt an, bis nichts mehr zu ändern ist', () => {
    const r = resolve({ ...DEFAULT_CONFIG, payloadT: 48, axles: 2, lengthMm: 2000, widthMm: 1200, deckHeightMm: 400 });
    expect(r.config.lengthMm).toBeGreaterThanOrEqual(r.derived.minLengthMm);
    expect(r.config.widthMm).toBeGreaterThanOrEqual(r.derived.minWidthMm);
    expect(r.config.deckHeightMm).toBeGreaterThanOrEqual(r.derived.minDeckHeightMm);
    // Ein zweiter Durchlauf über das Ergebnis ändert nichts mehr.
    expect(resolve(r.config).config).toEqual(r.config);
  });

  it('liefert Hinweise in fester Reihenfolge und nur, wenn eine Regel anschlägt', () => {
    const { config, derived } = resolve({ ...DEFAULT_CONFIG, publicRoads: true });
    expect(advise(config, derived, 3800).map((m) => m.text.split(':')[0])).toEqual(Array(4).fill('Öffentliche Verkehrswege'));
    const quiet = resolve(DEFAULT_CONFIG);
    expect(advise(quiet.config, quiet.derived, 3800)).toEqual([]);
  });
});
