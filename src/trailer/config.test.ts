import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, LIMITS, axleLayout } from './config';
import { resolve } from './rules';

describe('resolve', () => {
  it('lässt die Standardkonfiguration unverändert', () => {
    const r = resolve(DEFAULT_CONFIG);
    expect(r.config).toEqual(DEFAULT_CONFIG);
    expect(r.adjustments).toEqual({});
    expect(r.derived.axleType).toBe('pendel');
    expect(r.derived.wheelCount).toBe(8);
  });

  it('hebt die Achszahl an, wenn die Traglast es verlangt', () => {
    const r = resolve({ ...DEFAULT_CONFIG, payloadT: 30, axles: 2 });
    expect(r.config.axles).toBe(3);
    expect(r.adjustments.axles).toBeDefined();
  });

  it('nimmt Starrachsen bei geringer Achslast', () => {
    const r = resolve({ ...DEFAULT_CONFIG, payloadT: 8, axles: 2 });
    expect(r.derived.axleType).toBe('starr');
    expect(r.derived.wheelCount).toBe(4);
  });

  it('hebt eine zu niedrige Ladehöhe an und meldet es', () => {
    const r = resolve({ ...DEFAULT_CONFIG, deckHeightMm: 400 });
    expect(r.config.deckHeightMm).toBe(r.derived.minDeckHeightMm);
    expect(r.config.deckHeightMm).toBeGreaterThan(400);
    expect(r.adjustments.deckHeightMm).toBeDefined();
  });

  it('stellt die Lenkung gerade, solange die Deichsel hochgeklappt ist', () => {
    const steered = resolve({ ...DEFAULT_CONFIG, steeringDeg: -35 });
    expect(steered.config.steeringDeg).toBe(-35);
    expect(steered.adjustments.steeringDeg).toBeUndefined();

    const raised = resolve({ ...DEFAULT_CONFIG, steeringDeg: -35, drawbarUp: true });
    expect(raised.config.steeringDeg).toBe(0);
    expect(raised.adjustments.steeringDeg).toBeDefined();
  });

  it('liefert für jede Eingabe eine stabile, baubare Konfiguration', () => {
    for (let payloadT = LIMITS.payloadT.min; payloadT <= LIMITS.payloadT.max; payloadT++) {
      for (let axles = LIMITS.axles.min; axles <= LIMITS.axles.max; axles++) {
        for (const lengthMm of [2000, 2600, 4000, 7500, 12000]) {
          for (const widthMm of [1200, 2000, 3000]) {
            const r = resolve({ ...DEFAULT_CONFIG, payloadT, axles, lengthMm, widthMm, deckHeightMm: 400 });
            const { config: c, derived: d } = r;

            expect(c.axles).toBeGreaterThanOrEqual(d.minAxles);
            expect(c.lengthMm).toBeGreaterThanOrEqual(d.minLengthMm);
            expect(c.widthMm).toBeGreaterThanOrEqual(d.minWidthMm);
            expect(c.deckHeightMm).toBeGreaterThanOrEqual(d.minDeckHeightMm);
            expect(c.payloadT / c.axles).toBeLessThanOrEqual(12);
            expect(resolve(c).config).toEqual(c);

            // Achsgruppen liegen unter der Ladefläche und berühren sich nicht.
            const layout = axleLayout(c, d);
            const r2 = d.wheelDiameterMm / 2;
            const frontMin = Math.min(...layout.frontAxlesMm) - r2;
            const frontMax = Math.max(...layout.frontAxlesMm) + r2;
            const rearMin = Math.min(...layout.rearAxlesMm) - r2;
            const rearMax = Math.max(...layout.rearAxlesMm) + r2;
            expect(frontMax).toBeLessThanOrEqual(c.lengthMm / 2);
            expect(rearMin).toBeGreaterThanOrEqual(-c.lengthMm / 2);
            expect(frontMin - rearMax).toBeGreaterThanOrEqual(150);
          }
        }
      }
    }
  });
});
