/**
 * Prüft, dass kein Bauteil in der Luft hängt.
 *
 * Für jede Konfiguration werden alle Bauteile als Körper aufgebaut. Zwei
 * Körper gelten als verbunden, wenn sie sich berühren oder durchdringen. Jedes
 * Bauteil muss über eine Kette solcher Berührungen am Rahmen hängen. Geprüft
 * wird die Grundstellung: Lenkung gerade, Deichsel abgesenkt.
 */
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import * as replicad from 'replicad';
import opencascade from 'replicad-opencascadejs';
import { DEFAULT_CONFIG, type TrailerConfig } from '../trailer/config';
import { resolve } from '../trailer/rules';
import { buildStepParts } from './step';

const require = createRequire(import.meta.url);

/** Bis zu diesem Abstand in Millimetern gilt eine Lücke als Berührung. */
const TOUCH = 0.5;
/** Für die Meldung: so weit wird nach dem nächsten Nachbarn eines losen Teils gesucht. */
const SEARCH = 100;

type Bounds = [[number, number, number], [number, number, number]];
const boxGap = (a: Bounds, b: Bounds) => Math.max(...[0, 1, 2].map((i) => Math.max(a[0][i] - b[1][i], b[0][i] - a[1][i], 0)));

/** Lose Bauteilgruppen einer Konfiguration, jeweils mit der kleinsten Lücke zum Rest des Fahrzeugs. */
function looseGroups(overrides: Partial<TrailerConfig>): string[] {
  const oc = replicad.getOC();
  const { config, derived } = resolve({ ...DEFAULT_CONFIG, ...overrides });
  const solids = buildStepParts(replicad, config, derived);
  const bounds = solids.map((s) => s.shape.boundingBox.bounds as Bounds);
  const distance = (i: number, j: number) => {
    const tool = new oc.BRepExtrema_DistShapeShape(solids[i].shape.wrapped, solids[j].shape.wrapped);
    const value = tool.IsDone() ? tool.Value() : Infinity;
    tool.delete();
    return value;
  };

  const parent = solids.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      if (find(i) !== find(j) && boxGap(bounds[i], bounds[j]) <= TOUCH && distance(i, j) <= TOUCH) parent[find(i)] = find(j);
    }
  }

  const frame = find(solids.findIndex((s) => s.name.startsWith('Stirnblech')));
  const groups = new Map<number, number[]>();
  solids.forEach((_, i) => {
    if (find(i) !== frame) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  });

  return [...groups.values()].map((members) => {
    let nearest = { gap: Infinity, from: '', to: '' };
    for (const i of members) {
      for (let j = 0; j < solids.length; j++) {
        if (members.includes(j) || boxGap(bounds[i], bounds[j]) > Math.min(SEARCH, nearest.gap)) continue;
        const gap = distance(i, j);
        if (gap < nearest.gap) nearest = { gap, from: solids[i].name, to: solids[j].name };
      }
    }
    const names = [...new Set(members.map((i) => solids[i].name.replace(/ \d+$/, '')))].join(', ');
    return Number.isFinite(nearest.gap)
      ? `${names}: ${nearest.gap.toFixed(1)} mm zwischen ${nearest.from} und ${nearest.to}`
      : `${names}: weiter als ${SEARCH} mm vom Rest entfernt`;
  });
}

const equipped: Partial<TrailerConfig> = { parkingBrake: true, lashingRings: true, drawbarSpring: true, chocks: 'double', rearCoupling: 'automatic', lighting: 'stvzo', brake: 'air', suspension: 'leaf' };

/** Zusammen decken die Fälle jede Option, Bauform, Lenkung und Achsbauart ab. */
const CASES: [string, Partial<TrailerConfig>][] = [
  ['Standard', {}],
  ['Vollausstattung: Druckluft, Blattfeder, StVZO, automatische Kupplung', equipped],
  ['Auflaufbremse, Gummifeder, Steckbolzenkupplung, Innenbeleuchtung, Flachstahl-Zugöse', { ...equipped, brake: 'overrun', suspension: 'rubber', rearCoupling: 'pin', lighting: 'internal', chocks: 'single', towEye: 'flat' }],
  ['Hydraulikbremse, Luftfeder', { ...equipped, brake: 'hydraulic', suspension: 'air' }],
  ['Elektrobremse, Starrachsen', { ...equipped, brake: 'electric', payloadT: 8 }],
  ['Kleiner Anhänger mit Starrachsen', { ...equipped, payloadT: 4, lengthMm: 3000, widthMm: 1500 }],
  ['48 t, vier Achsen, 10 m', { ...equipped, payloadT: 48, axles: 4, lengthMm: 10000 }],
  ['Luftbereifung, Polyurethan auf kurzem Anhänger', { ...equipped, tyre: 'pneumatic', payloadT: 12, lengthMm: 4000 }],
  ['Bordwand fest, Holz', { wallType: 'fixed', wallMaterial: 'wood' }],
  ['Bordwand steckbar, Aluminium, 600 mm', { wallType: 'plug', wallMaterial: 'aluminium', wallHeightMm: 600 }],
  ['Bordwand abklappbar, Drahtgitter', { wallType: 'folding', wallMaterial: 'mesh' }],
  ['Bordwand und Ausstattung ohne Belag', { ...equipped, wallType: 'fixed', deck: 'none' }],
  ['Hartholz mit Kantenschutz', { deck: 'hardwood', edgeProtection: 'flush' }],
  ['Kiefer ohne Kantenschutz', { deck: 'pine' }],
  ['Siebdruck mit Abgleitsicherung', { deck: 'plywood', edgeProtection: 'raised' }],
  ['Gummiauflage', { deck: 'rubber' }],
  ['Riffelblech', { deck: 'checker' }],
  ['Dach: Plane, flach, offen', { roof: 'tarp', roofShape: 'flat', roofSides: 'open' }],
  ['Dach: Blech, Pult, Vorhangplane, Bordwand', { roof: 'sheet', roofShape: 'mono', roofSides: 'curtain', wallType: 'folding' }],
  ['Dach: Plane mit Schutzgitter', { roof: 'tarp', roofSides: 'mesh' }],
  ['Dach: Plane fest, Pult', { roof: 'tarp', roofSides: 'tarp', roofShape: 'mono' }],
  ['Doppel-Drehschemel', { ...equipped, steering: 'doubleTurntable' }],
  ['2-Rad-Achsschenkel, Pendelachsen', { ...equipped, steering: 'ackermann2' }],
  ['2-Rad-Achsschenkel, Starrachsen, Auflaufbremse', { ...equipped, steering: 'ackermann2', payloadT: 8, brake: 'overrun' }],
  ['2-Rad-Achsschenkel, Starrachsen, ungebremst, ungefedert', { steering: 'ackermann2', payloadT: 8 }],
  ['4-Rad-Achsschenkel', { ...equipped, steering: 'ackermann4' }],
  ['4-Rad-Achsschenkel, Starrachsen, vier Achsen', { ...equipped, steering: 'ackermann4', payloadT: 16, axles: 4, suspension: 'rubber' }],
  ['Allradlenkung', { ...equipped, steering: 'allWheel', payloadT: 8 }],
  ['Tieflader, Räder innen, Klappe seitlich', { ...equipped, body: 'lowbed', rearWheels: 'inside', ramp: 'side' }],
  ['Tieflader, Räder außen, Klappe hinten', { ...equipped, body: 'lowbed', rearWheels: 'outside', ramp: 'rear', rearCoupling: 'none' }],
  ['Tieflader, Räder außen, Starrachsen, Klappe seitlich', { ...equipped, body: 'lowbed', rearWheels: 'outside', ramp: 'side', payloadT: 8 }],
  ['Tieflader ohne Belag, Doppel-Drehschemel', { ...equipped, body: 'lowbed', steering: 'doubleTurntable', deck: 'none' }],
  ['Langmaterial', { ...equipped, body: 'longload' }],
  ['Langmaterial, Allradlenkung, ohne Belag', { ...equipped, body: 'longload', steering: 'allWheel', deck: 'none' }],
];

describe('Zusammenhalt des Modells', () => {
  beforeAll(async () => {
    const wasm = require.resolve('replicad-opencascadejs/wasm');
    replicad.setOC(await opencascade({ locateFile: () => wasm }));
  }, 60_000);

  it.each(CASES)('%s: jedes Bauteil hängt am Rahmen', (_label, overrides) => {
    expect(looseGroups(overrides)).toEqual([]);
  }, 120_000);
});
