import { describe, expect, it } from 'vitest';
import { locale } from '../i18n';
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

    // Nichts ragt unter die Fahrbahn (die klappbare Deichsel ausgenommen).
    if (p.frame !== 'drawbar') {
      let y = p.pos[1];
      for (let f = description.frames[p.frame]; f; f = description.frames[f.parent ?? '']) y += f.origin[1];
      const half = p.kind === 'box' ? p.size[1] / 2 : p.kind === 'wheel' ? p.radius : p.kind === 'cylinder' ? (p.axis === 'y' ? p.length / 2 : p.radius) : p.radius + p.tube;
      expect(y - half, `${p.name} unter der Fahrbahn (${JSON.stringify(overrides)})`).toBeGreaterThan(-0.002);
    }
  }
  const bom = buildBom(description.parts);
  expect(bom.totalKg).toBeGreaterThan(0);
  expect(describeConfig(config, derived, description, bom.totalKg, bom.pieceCount).length).toBeGreaterThan(5);
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

describe('Sonderbauformen', () => {
  const steeringIds = OPTIONS.steering.map((o) => o.id);

  it('baut den Tieflader mit jeder Lenkung, Radanordnung und Klappe', () => {
    for (const steering of steeringIds) {
      for (const rearWheels of ['inside', 'outside'] as const) {
        for (const ramp of ['none', 'side', 'rear'] as const) {
          for (const [payloadT, axles] of [[6, 2], [24, 2], [40, 4]] as const) {
            const { config, description } = check({ body: 'lowbed', steering, rearWheels, ramp, payloadT, axles, bedHeightMm: 180, brake: 'air', chocks: 'single', lashingRings: true, lighting: 'stvzo', rearCoupling: 'pin', parkingBrake: true });
            expect(description.bed!.length).toBeGreaterThan(1);
            expect(description.bed!.width).toBeGreaterThanOrEqual(0.8);
            expect(description.loadSurfaceY).toBeCloseTo(config.bedHeightMm / 1000, 6);
            // Außen laufende Räder gibt es nur mit starren Hinterachsen, die Heckklappe nur mit ihnen.
            if (config.rearWheels === 'outside') expect(['turntable', 'ackermann2']).toContain(steering);
            if (config.ramp === 'rear') expect(config.rearWheels).toBe('outside');
          }
        }
      }
    }
  });

  it('legt das Tiefbett mindestens 200 mm unter die Podeste', () => {
    const { config } = check({ body: 'lowbed', bedHeightMm: 800 });
    expect(config.bedHeightMm).toBeLessThanOrEqual(config.deckHeightMm - 200);
  });

  it('hält beim Langmaterial-Anhänger Länge, Grenzen und Raster zusammen', () => {
    for (const steering of steeringIds) {
      for (const rasterMm of [250, 500, 1000] as const) {
        for (const [minLengthMm, maxLengthMm, lengthMm] of [[2000, 12000, 7300], [5000, 8000, 6200], [9000, 9500, 2000]]) {
          const { config, description } = check({ body: 'longload', steering, rasterMm, minLengthMm, maxLengthMm, lengthMm, payloadT: 12, brake: 'air', chocks: 'double' });
          expect(config.maxLengthMm).toBeGreaterThanOrEqual(config.minLengthMm);
          expect(config.lengthMm).toBeGreaterThanOrEqual(config.minLengthMm);
          expect(config.lengthMm).toBeLessThanOrEqual(config.maxLengthMm);
          expect((config.lengthMm - config.minLengthMm) % rasterMm).toBe(0);
          expect(resolve(config).config).toEqual(config);

          // Das Innenrohr steckt in jeder Stellung noch im Außenrohr und ragt hinten nicht heraus.
          const tube = (name: string) => description.parts.find((p) => p.name === name)!;
          const outer = tube('Langrohr außen');
          const inner = tube('Langrohr innen');
          if (outer.kind !== 'box' || inner.kind !== 'box') throw new Error('Langrohr fehlt');
          const outerRear = outer.pos[0] - outer.size[0] / 2;
          const outerFront = outer.pos[0] + outer.size[0] / 2;
          const innerRear = inner.pos[0] - inner.size[0] / 2;
          expect(innerRear).toBeGreaterThanOrEqual(outerRear - 1e-6);
          expect(outerFront - innerRear).toBeGreaterThan(0.3);
        }
      }
    }
  });

  it('baut den Dachaufbau in jeder Form und schließt ihn auf Wunsch seitlich', () => {
    for (const roof of ['tarp', 'sheet'] as const) {
      for (const roofShape of ['flat', 'mono'] as const) {
        for (const roofSides of OPTIONS.roofSides.map((o) => o.id)) {
          for (const wallType of ['none', 'folding'] as const) {
            const { config, description, bom } = check({ roof, roofShape, roofSides, wallType, roofClearMm: 2000 });
            expect(description.height).toBeGreaterThan((config.deckHeightMm + 2000) / 1000);
            expect(bom.groups.some((g) => g.group === 'Dachaufbau')).toBe(true);
            // Mit Dach übernehmen die Dachpfosten die Ecken der Bordwände.
            expect(description.parts.some((p) => p.name === 'Eckrunge')).toBe(false);
          }
        }
      }
    }
    expect(check({ roof: 'tarp', body: 'lowbed' }).config.roof).toBe('none');
  });
});

describe('Lenkungsarten', () => {
  const steeringIds = OPTIONS.steering.map((o) => o.id);

  it('baut jede Lenkung für alle Achszahlen und Achsbauarten, geradeaus und eingeschlagen', () => {
    for (const steering of steeringIds) {
      for (const [payloadT, axles] of [[4, 2], [8, 2], [24, 2], [30, 3], [48, 4]] as const) {
        for (const steeringDeg of [0, 25, -60]) {
          const { description } = check({ steering, payloadT, axles, steeringDeg, brake: 'air', suspension: 'rubber' });
          const seen = new Set<string>();
          for (const [name, frame] of Object.entries(description.frames)) {
            // Übergeordnete Bezugssysteme müssen vor ihren Kindern stehen.
            if (frame.parent) expect(seen.has(frame.parent), `${name} nach ${frame.parent}`).toBe(true);
            expect(Number.isFinite(frame.angle), name).toBe(true);
            expect(Math.abs(frame.angle)).toBeLessThan(Math.PI / 2);
            seen.add(name);
          }
        }
      }
    }
  });

  it('dreht beim Doppel-Drehschemel den hinteren Schemel gegenläufig', () => {
    const { frames } = check({ steering: 'doubleTurntable', steeringDeg: 20 }).description;
    expect(frames.bogieFront.angle).toBeCloseTo((-20 * Math.PI) / 180, 5);
    expect(frames.bogieRear.angle).toBeCloseTo(-frames.bogieFront.angle, 5);
  });

  it('schlägt bei der Achsschenkellenkung das kurveninnere Rad stärker ein', () => {
    const { frames, parts } = check({ steering: 'ackermann2', steeringDeg: 20, payloadT: 8 }).description;
    const knuckles = Object.entries(frames).filter(([name]) => name.startsWith('knuckle'));
    // Zwei Vorderräder gelenkt, die Hinterräder starr.
    expect(knuckles).toHaveLength(2);
    const right = knuckles.find(([, f]) => f.origin[2] > 0)![1];
    const left = knuckles.find(([, f]) => f.origin[2] < 0)![1];
    // Einschlag nach rechts: negatives Vorzeichen, rechts liegt innen.
    expect(right.angle).toBeLessThan(left.angle);
    expect(left.angle).toBeLessThan(0);
    expect(frames.tongue.angle).toBeCloseTo((-20 * Math.PI) / 180, 5);
    expect(parts.some((p) => p.name === 'Spurstange')).toBe(true);
    expect(frames.bogieFront).toBeUndefined();
  });

  it('lenkt bei Allradlenkung alle Pendelachsen, hinten gegenläufig', () => {
    const { derived, description } = check({ steering: 'allWheel', steeringDeg: 15, payloadT: 8 });
    expect(derived.axleType).toBe('pendel');
    const knuckles = Object.values(description.frames).filter((f) => f.origin[1] === 0 && f.parent === 'chassis' && f.axis === 'y' && f.origin[2] !== 0);
    expect(knuckles).toHaveLength(4);
    for (const k of knuckles) expect(Math.sign(k.angle)).toBe(k.origin[0] > 0 ? -1 : 1);
  });

  it('begrenzt den Lenkeinschlag je Lenkungsart', () => {
    expect(check({ steering: 'turntable', steeringDeg: 60 }).config.steeringDeg).toBe(60);
    expect(check({ steering: 'ackermann2', steeringDeg: 60 }).config.steeringDeg).toBe(40);
  });
});

describe('Hinweise', () => {
  const notes = (o: Partial<TrailerConfig>) => {
    const { config, derived, bom } = check(o);
    return advise(config, derived, bom.totalKg).map(locale('de').m);
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
