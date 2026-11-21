/**
 * Durchläuft alle Texte, die aus Daten entstehen: Auswahllisten, Farben,
 * Bauteilnamen, Werkstoffe, Hinweise, Zusammenfassung, Angebot und Stückliste
 * für viele Konfigurationen. Die Tests prüfen damit, dass keine Übersetzung fehlt.
 */
import { advise } from '../trailer/advice';
import { bomToCsv, buildBom } from '../trailer/bom';
import { COLORS, DEFAULT_CONFIG, OPTIONS, resolve, type TrailerConfig } from '../trailer/config';
import { trailerParts } from '../trailer/parts';
import { estimateQuote, quoteToCsv } from '../trailer/pricing';
import { buildImagePrompt } from '../trailer/prompt';
import { describeConfig, describeProse, summaryToCsv } from '../trailer/summary';
import type { Locale } from './index';

function exerciseConfig(L: Locale, overrides: Partial<TrailerConfig>) {
  const { config, derived, adjustments } = resolve({ ...DEFAULT_CONFIG, ...overrides });
  Object.values(adjustments).forEach((m) => L.m(m));
  const description = trailerParts(config, derived);
  const bom = buildBom(description.parts, L);
  bomToCsv(bom, L);
  advise(config, derived, bom.totalKg).forEach((m) => L.m(m));
  summaryToCsv(describeConfig(config, derived, description, bom.totalKg, bom.pieceCount, L), L);
  describeProse(config, derived, L);
  buildImagePrompt(config, derived, description, bom.totalKg, bom.pieceCount, L);
  quoteToCsv(estimateQuote(config, description.parts), L);
}

export function exerciseDataTexts(L: Locale) {
  // Maßangaben wie "400 mm" sind keine Texte und werden in der Oberfläche eigens formatiert.
  for (const options of Object.values(OPTIONS)) for (const o of options) if (typeof o.id === 'string') L.t(o.name);
  for (const c of COLORS) L.t(c.name);

  const extras: Partial<TrailerConfig> = { wallType: 'folding', deck: 'hardwood', edgeProtection: 'raised', lashingRings: true, drawbarSpring: true, parkingBrake: true, nonMarking: true, notes: 'x' };
  for (const [key, options] of Object.entries(OPTIONS)) {
    for (const o of options) {
      for (const body of ['platform', 'lowbed', 'longload'] as const) {
        exerciseConfig(L, { ...extras, body, rearWheels: 'outside', ramp: 'rear', roof: 'tarp', roofSides: 'curtain', [key]: o.id } as Partial<TrailerConfig>);
      }
    }
  }
  // Fälle, die Hinweise und Anpassungen des Regelwerks auslösen.
  exerciseConfig(L, { payloadT: 48, axles: 2, lengthMm: 2000, widthMm: 1200, deckHeightMm: 400, drawbarUp: true, steeringDeg: 30 });
  exerciseConfig(L, { publicRoads: true, speedKmh: 30, ground: 'unpaved', obstacleMm: 150, slopePct: 8, trailersInTrain: 3, towForceN: 100, towWeightKg: 500 });
  exerciseConfig(L, { publicRoads: false, speedKmh: 20, tyre: 'pneumatic', payloadT: 48, axles: 4, loadType: 'custom' });
  exerciseConfig(L, { body: 'lowbed', bedHeightMm: 800, rearWheels: 'outside', steering: 'allWheel', ramp: 'rear', rearCoupling: 'pin' });
  exerciseConfig(L, { body: 'lowbed', rearWheels: 'outside', ramp: 'rear', rearCoupling: 'pin' });
  exerciseConfig(L, { body: 'lowbed', rearWheels: 'outside', payloadT: 6, brake: 'hydraulic', chocks: 'single', lighting: 'internal' });
  exerciseConfig(L, { body: 'longload', minLengthMm: 2000, maxLengthMm: 12000 });
  exerciseConfig(L, { payloadT: 6, steering: 'ackermann2', brake: 'electric', suspension: 'air', roof: 'sheet', roofSides: 'mesh', wallMaterial: 'mesh', wallType: 'plug' });
}
