import { describe, expect, it } from 'vitest';
import { PRICE_DATA, RULE_DATA } from './index';
import { DEFAULT_CONFIG, OPTIONS } from '../trailer/config';
import { PRICES, type PartPrice } from '../trailer/pricing';

const ids = (key: keyof typeof OPTIONS) => OPTIONS[key].map((o) => String(o.id)).sort();
const keys = (o: object) => Object.keys(o).sort();

describe('Stammdaten', () => {
  it('haben für jede Auswahl der Bedienung einen Eintrag', () => {
    expect(keys(RULE_DATA.tyres)).toEqual(ids('tyre'));
    expect(keys(RULE_DATA.steering)).toEqual(ids('steering'));
    expect(keys(RULE_DATA.springHeightMm)).toEqual(ids('suspension'));
    expect(keys(RULE_DATA.deckKgPerM2)).toEqual(ids('deck'));
    expect(keys(RULE_DATA.groundFactor)).toEqual(ids('ground'));
    expect(keys(PRICE_DATA.wiring)).toEqual(ids('lighting'));
    expect(keys(PRICE_DATA.brakeLines)).toEqual(ids('brake'));
  });

  it('enthalten schlüssige Grenzen, in denen auch die Ausgangswerte liegen', () => {
    for (const [key, limit] of Object.entries(RULE_DATA.limits) as [keyof typeof RULE_DATA.limits, { min: number; max: number; step?: number }][]) {
      expect(limit.min, key).toBeLessThan(limit.max);
      if (limit.step !== undefined) expect(limit.step, key).toBeGreaterThan(0);
      const start = DEFAULT_CONFIG[key];
      expect(start, key).toBeGreaterThanOrEqual(limit.min);
      expect(start, key).toBeLessThanOrEqual(limit.max);
    }
    expect(RULE_DATA.axles.rigidAxleLoadT).toBeLessThan(RULE_DATA.axles.maxAxleLoadT);
  });

  it('führen die Radgrößen aufsteigend nach Durchmesser und Tragfähigkeit', () => {
    const sizes = RULE_DATA.wheelSizes;
    expect(sizes.length).toBeGreaterThan(1);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i].diameterMm).toBeGreaterThan(sizes[i - 1].diameterMm);
      expect(sizes[i].capacityKg).toBeGreaterThan(sizes[i - 1].capacityKg);
    }
  });

  it('kennen für Lenkung und Bereifung nur gültige Angaben', () => {
    for (const mode of Object.values(RULE_DATA.steering)) {
      expect(['bogie', 'knuckle']).toContain(mode.front);
      expect(['bogie', 'knuckle', 'fixed']).toContain(mode.rear);
      expect(mode.maxDeg).toBeGreaterThan(0);
      expect(mode.maxDeg).toBeLessThanOrEqual(RULE_DATA.limits.steeringDeg.max);
    }
    for (const tyre of Object.values(RULE_DATA.tyres)) for (const value of Object.values(tyre)) expect(value).toBeGreaterThan(0);
  });

  it('enthalten nur Preise, mit denen sich rechnen lässt', () => {
    const list: PartPrice[] = PRICES.parts.list;
    expect(list.length).toBeGreaterThan(20);
    for (const entry of list) {
      expect(entry.name.trim(), entry.name).not.toBe('');
      expect(entry.eur, entry.name).toBeGreaterThan(0);
      expect(['piece', 'm2', 'wheel', 'drum', 'slewRing', undefined]).toContain(entry.per);
    }
    // Ein allgemeinerer Name darf keinen genaueren verdecken, der erst danach steht.
    list.forEach((entry, i) => list.slice(0, i).forEach((earlier) => expect(entry.name.startsWith(earlier.name), `${earlier.name} verdeckt ${entry.name}`).toBe(false)));
    for (const rate of Object.values(PRICES.ratePerKg)) expect(rate).toBeGreaterThan(0);
    expect(PRICES.ratePerKg.default).toBeGreaterThan(0);
    for (const share of [PRICES.smallPartsShare, PRICES.overheadShare, PRICES.vatShare, PRICES.spread, ...Object.values(PRICES.engineering)]) {
      expect(share).toBeGreaterThan(0);
      expect(share).toBeLessThan(1);
    }
  });
});
