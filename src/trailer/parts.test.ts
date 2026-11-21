import { describe, expect, it } from 'vitest';
import { advise } from './advice';
import { buildBom } from './bom';
import { DEFAULT_CONFIG, OPTIONS, resolve, type TrailerConfig } from './config';
import { partMassKg, trailerParts } from './parts';
import { describeConfig } from './summary';

/** Baut eine Konfiguration und prüft, dass alle Bauteile gültige Maße und Bezüge haben. */
function check(overrides: Partial<TrailerConfig>) {
  const { config, derived } = resolve({ ...DEFAULT_CONFIG, ...overrides });
  const description = trailerParts(config, derived);
  for (const p of description.parts) {
    const numbers = [
      ...p.pos,
      partMassKg(p),
      ...(p.kind === 'box' ? p.size : p.kind === 'cylinder' ? [p.radius, p.length] : p.kind === 'wheel' ? [p.radius, p.width] : [p.radius, p.tube]),
    ];
    expect(numbers.every(Number.isFinite), `${p.name}: ${numbers}`).toBe(true);
    if (p.kind === 'box') expect(Math.min(...p.size), p.name).toBeGreaterThan(0);
    expect(description.frames[p.frame], `${p.name} in ${p.frame}`).toBeDefined();
    expect(partMassKg(p), p.name).toBeGreaterThanOrEqual(0);
  }
  const bom = buildBom(description.parts);
  expect(bom.totalKg).toBeGreaterThan(0);
  expect(describeConfig(config, derived, bom.totalKg, bom.pieceCount).length).toBeGreaterThan(5);
  return { config, derived, description, bom };
}

describe('Bauteilbeschreibung', () => {
  it('baut jede einzelne Option jeder Auswahlliste', () => {
    for (const [key, options] of Object.entries(OPTIONS)) {
      for (const option of options) {
        // Abhängige Optionen mit einschalten, damit sie auch wirklich Bauteile erzeugen.
        check({ [key]: option.id, wallType: key === 'wallType' ? option.id : 'folding', deck: key === 'deck' ? option.id : 'hardwood' } as Partial<TrailerConfig>);
      }
    }
  });

  it('baut Vollausstattung über den ganzen Größenbereich', () => {
    const full: Partial<TrailerConfig> = {
      brake: 'air', parkingBrake: true, suspension: 'leaf', tyre: 'superElastic', deck: 'plywood', edgeProtection: 'raised',
      wallType: 'plug', wallMaterial: 'mesh', wallHeightMm: 600, lashingRings: true, towEye: 'flat', drawbarSpring: true,
      rearCoupling: 'automatic', lighting: 'stvzo', chocks: 'double', couplingHeightMm: 700,
    };
    for (const payloadT of [2, 8, 24, 48]) {
      for (const lengthMm of [2000, 6000, 12000]) {
        for (const widthMm of [1200, 3000]) check({ ...full, payloadT, lengthMm, widthMm });
      }
    }
  });

  it('nimmt Ausstattung in die Stückliste auf und lässt Einzelteile von Zukaufbaugruppen weg', () => {
    const base = check({}).bom;
    const { bom } = check({ rearCoupling: 'automatic', lighting: 'internal', chocks: 'single' });
    const names = bom.rows.map((r) => r.name);
    expect(names).toContain('Automatische Anhängerkupplung');
    expect(names).not.toContain('Fangmaul');
    expect(bom.rows.find((r) => r.name === 'Rückleuchte')?.quantity).toBe(2);
    expect(bom.totalKg).toBeGreaterThan(base.totalKg);
  });

  it('bremst je nach Bremsart die richtigen Achsen', () => {
    const count = (o: Partial<TrailerConfig>) => check(o).bom.rows.find((r) => r.name.includes('bremse') && r.group === 'Bremse' && r.name.startsWith('Trommel'))?.quantity ?? 0;
    expect(count({ brake: 'none' })).toBe(0);
    expect(count({ brake: 'overrun' })).toBe(2);
    expect(count({ brake: 'air', axles: 3, payloadT: 30 })).toBe(4);
    expect(count({ brake: 'none', parkingBrake: true })).toBe(2);
  });

  it('wählt für Luftbereifung größere Räder und hebt die Ladehöhe an', () => {
    const solid = check({});
    const air = check({ tyre: 'pneumatic' });
    expect(air.derived.wheelDiameterMm).toBeGreaterThan(solid.derived.wheelDiameterMm);
    expect(air.config.deckHeightMm).toBeGreaterThan(solid.config.deckHeightMm);
  });

  it('richtet die Deichsel auf die Kupplungshöhe aus', () => {
    const level = check({}).description.frames.drawbar.angle;
    const high = check({ couplingHeightMm: 900 }).description.frames.drawbar.angle;
    expect(level).toBe(0);
    expect(high).toBeGreaterThan(0);
  });
});

describe('Hinweise', () => {
  const notes = (o: Partial<TrailerConfig>) => {
    const { config, derived, bom } = check(o);
    return advise(config, derived, bom.totalKg);
  };

  it('bleibt bei der Standardkonfiguration still', () => {
    expect(notes({})).toEqual([]);
  });

  it('meldet fehlende Ausstattung für öffentliche Verkehrswege', () => {
    const list = notes({ publicRoads: true });
    expect(list.some((n) => n.includes('Betriebsbremse'))).toBe(true);
    expect(list.some((n) => n.includes('Beleuchtung'))).toBe(true);
    expect(notes({ publicRoads: true, brake: 'air', lighting: 'stvzo', chocks: 'single', tyre: 'pneumatic', speedKmh: 25 })).toEqual([]);
  });

  it('meldet zu schnelle Fahrt für die Bereifung und fehlende Kupplung im Zugverband', () => {
    expect(notes({ speedKmh: 20 }).some((n) => n.includes('16 km/h'))).toBe(true);
    expect(notes({ trailersInTrain: 3 }).some((n) => n.includes('Kupplung hinten'))).toBe(true);
  });
});
