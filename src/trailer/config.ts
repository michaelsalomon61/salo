/**
 * Parameter und Regelwerk des Konfigurators.
 *
 * Alle Längen in Millimetern, Lasten in Tonnen bzw. Kilogramm. Die Regeln sind
 * bewusst einfache Faustregeln für das Anschauungsmodell und ersetzen keine
 * technische Auslegung.
 */

/** Auswahllisten mit Anzeigenamen, gemeinsam genutzt von Bedienung und Zusammenfassung. */
export const OPTIONS = {
  site: [
    { id: 'indoor', name: 'Innerbetrieblich' },
    { id: 'outdoor', name: 'Außerbetrieblich' },
    { id: 'both', name: 'Innen und außen' },
  ],
  ground: [
    { id: 'smooth', name: 'Hallenboden' },
    { id: 'asphalt', name: 'Asphalt / Beton' },
    { id: 'paving', name: 'Pflaster' },
    { id: 'unpaved', name: 'Unbefestigt' },
  ],
  loadType: [
    { id: 'area', name: 'Flächenlast' },
    { id: 'point', name: 'Punktlast' },
    { id: 'custom', name: 'Individuell' },
  ],
  brake: [
    { id: 'none', name: 'Ungebremst' },
    { id: 'overrun', name: 'Auflaufbremse' },
    { id: 'air', name: 'Druckluftbremse' },
    { id: 'hydraulic', name: 'Hydraulische Bremse' },
    { id: 'electric', name: 'Elektrische Bremse' },
  ],
  tyre: [
    { id: 'solid', name: 'Vollgummi' },
    { id: 'superElastic', name: 'Super-Elastic' },
    { id: 'pneumatic', name: 'Luft' },
    { id: 'polyurethane', name: 'Polyurethan / Vulkollan' },
  ],
  suspension: [
    { id: 'none', name: 'Ungefedert' },
    { id: 'rubber', name: 'Gummiachsfederung' },
    { id: 'leaf', name: 'Stahlblattfederung' },
    { id: 'air', name: 'Luftfederung' },
  ],
  deck: [
    { id: 'steel', name: 'Glattblech' },
    { id: 'checker', name: 'Riffelblech' },
    { id: 'pine', name: 'Kiefernholz' },
    { id: 'hardwood', name: 'Hartholz' },
    { id: 'plywood', name: 'Siebdruckplatte' },
    { id: 'rubber', name: 'Gummiauflage' },
    { id: 'none', name: 'Ohne Abdeckung' },
  ],
  edgeProtection: [
    { id: 'none', name: 'Ohne' },
    { id: 'flush', name: 'Kantenschutz' },
    { id: 'raised', name: 'Abgleitsicherung' },
  ],
  wallType: [
    { id: 'none', name: 'Ohne' },
    { id: 'fixed', name: 'Fest' },
    { id: 'plug', name: 'Steckbar' },
    { id: 'folding', name: 'Abklappbar' },
  ],
  wallMaterial: [
    { id: 'wood', name: 'Holz' },
    { id: 'aluminium', name: 'Aluminium' },
    { id: 'mesh', name: 'Drahtgitter' },
  ],
  wallHeightMm: [
    { id: 200, name: '200 mm' },
    { id: 400, name: '400 mm' },
    { id: 600, name: '600 mm' },
  ],
  towEye: [
    { id: 'din', name: 'DIN-Zugöse' },
    { id: 'flat', name: 'Flachstahl-Zugöse' },
  ],
  rearCoupling: [
    { id: 'none', name: 'Ohne' },
    { id: 'pin', name: 'Steckbolzenkupplung' },
    { id: 'automatic', name: 'Automatische Kupplung' },
  ],
  lighting: [
    { id: 'none', name: 'Ohne' },
    { id: 'internal', name: 'Innerbetrieblich' },
    { id: 'stvzo', name: 'Nach StVZO' },
  ],
  chocks: [
    { id: 'none', name: 'Ohne' },
    { id: 'single', name: 'Einfach wirkend' },
    { id: 'double', name: 'Doppelt wirkend' },
  ],
} as const;

type OptionId<K extends keyof typeof OPTIONS> = (typeof OPTIONS)[K][number]['id'];

export type Site = OptionId<'site'>;
export type Ground = OptionId<'ground'>;
export type LoadType = OptionId<'loadType'>;
export type Brake = OptionId<'brake'>;
export type Tyre = OptionId<'tyre'>;
export type Suspension = OptionId<'suspension'>;
export type DeckMaterial = OptionId<'deck'>;
export type EdgeProtection = OptionId<'edgeProtection'>;
export type WallType = OptionId<'wallType'>;
export type WallMaterial = OptionId<'wallMaterial'>;
export type WallHeight = OptionId<'wallHeightMm'>;
export type TowEye = OptionId<'towEye'>;
export type RearCoupling = OptionId<'rearCoupling'>;
export type Lighting = OptionId<'lighting'>;
export type Chocks = OptionId<'chocks'>;

export function optionName<K extends keyof typeof OPTIONS>(key: K, id: OptionId<K>): string {
  const list: readonly { id: string | number; name: string }[] = OPTIONS[key];
  return list.find((o) => o.id === id)?.name ?? String(id);
}

export interface TrailerConfig {
  // Grunddaten
  payloadT: number;
  axles: number;
  lengthMm: number;
  widthMm: number;
  deckHeightMm: number;

  // Einsatz
  speedKmh: number;
  site: Site;
  /** Einsatz auf öffentlichen Verkehrswegen (StVZO). */
  publicRoads: boolean;
  ground: Ground;
  aisleWidthMm: number | null;
  curveRadiusMm: number | null;
  slopePct: number;
  obstacleMm: number;
  hoursLoadedPerDay: number | null;
  distanceKmPerDay: number | null;

  // Last
  loadType: LoadType;
  loadLengthMm: number;
  loadWidthMm: number;
  loadHeightMm: number;
  loadNote: string;
  /** Last als Umriss im 3D-Modell zeigen. */
  showLoad: boolean;

  // Fahrwerk
  brake: Brake;
  parkingBrake: boolean;
  tyre: Tyre;
  /** Spurfreie (nicht abfärbende) Bereifung. */
  nonMarking: boolean;
  suspension: Suspension;

  // Ladefläche
  deck: DeckMaterial;
  edgeProtection: EdgeProtection;
  wallType: WallType;
  wallMaterial: WallMaterial;
  wallHeightMm: WallHeight;
  lashingRings: boolean;

  // Deichsel und Kupplung
  towEye: TowEye;
  /** Gefederte Deichsel-Höheneinstellung. */
  drawbarSpring: boolean;
  drawbarUp: boolean;
  /** Lenkeinschlag in Grad, negativ = links, positiv = rechts. */
  steeringDeg: number;
  rearCoupling: RearCoupling;

  // Ausstattung
  lighting: Lighting;
  chocks: Chocks;
  colorId: string;

  // Zugfahrzeug
  towWeightKg: number | null;
  couplingHeightMm: number | null;
  towForceN: number | null;
  trailersInTrain: number;

  notes: string;
}

export const LIMITS = {
  payloadT: { min: 2, max: 48, step: 1 },
  axles: { min: 2, max: 4 },
  lengthMm: { min: 2000, max: 12000, step: 100 },
  widthMm: { min: 1200, max: 3000, step: 50 },
  deckHeightMm: { min: 400, max: 1800, step: 10 },
  steeringDeg: { min: -60, max: 60, step: 1 },
  speedKmh: { min: 2, max: 40, step: 1 },
  slopePct: { min: 0, max: 15, step: 1 },
  obstacleMm: { min: 0, max: 150, step: 5 },
  loadLengthMm: { min: 200, max: 12000, step: 100 },
  loadWidthMm: { min: 200, max: 3000, step: 50 },
  loadHeightMm: { min: 100, max: 3000, step: 50 },
  trailersInTrain: { min: 1, max: 6, step: 1 },
} as const;

export const COLORS = [
  { id: 'ral3020', name: 'Verkehrsrot', ral: 'RAL 3020', hex: '#c8131b' },
  { id: 'ral2004', name: 'Reinorange', ral: 'RAL 2004', hex: '#e25303' },
  { id: 'ral1023', name: 'Verkehrsgelb', ral: 'RAL 1023', hex: '#f2b600' },
  { id: 'ral6018', name: 'Gelbgrün', ral: 'RAL 6018', hex: '#4f9a35' },
  { id: 'ral5010', name: 'Enzianblau', ral: 'RAL 5010', hex: '#0a4f84' },
  { id: 'ral7016', name: 'Anthrazitgrau', ral: 'RAL 7016', hex: '#383e42' },
  { id: 'ral7035', name: 'Lichtgrau', ral: 'RAL 7035', hex: '#c9cdcb' },
  { id: 'ral9005', name: 'Tiefschwarz', ral: 'RAL 9005', hex: '#0e0e10' },
] as const;

export const DEFAULT_CONFIG: TrailerConfig = {
  payloadT: 24,
  axles: 2,
  lengthMm: 6000,
  widthMm: 2500,
  deckHeightMm: 950,

  speedKmh: 6,
  site: 'indoor',
  publicRoads: false,
  ground: 'smooth',
  aisleWidthMm: null,
  curveRadiusMm: null,
  slopePct: 0,
  obstacleMm: 0,
  hoursLoadedPerDay: null,
  distanceKmPerDay: null,

  loadType: 'area',
  loadLengthMm: 4000,
  loadWidthMm: 2000,
  loadHeightMm: 1000,
  loadNote: '',
  showLoad: false,

  brake: 'none',
  parkingBrake: false,
  tyre: 'solid',
  nonMarking: false,
  suspension: 'none',

  deck: 'steel',
  edgeProtection: 'none',
  wallType: 'none',
  wallMaterial: 'wood',
  wallHeightMm: 400,
  lashingRings: false,

  towEye: 'din',
  drawbarSpring: false,
  drawbarUp: false,
  steeringDeg: 0,
  rearCoupling: 'none',

  lighting: 'none',
  chocks: 'none',
  colorId: 'ral3020',

  towWeightKg: null,
  couplingHeightMm: null,
  towForceN: null,
  trailersInTrain: 1,

  notes: '',
};

/** Tragfähigkeit einer Achslinie mit Pendelachsen (4 Räder). */
export const MAX_AXLE_LOAD_T = 12;
/** Bis zu dieser Achslast genügt eine Starrachse mit 2 Rädern. */
export const RIGID_AXLE_LOAD_T = 5;

/** Eigenschaften der Bereifungsarten. */
export const TYRES: Record<
  Tyre,
  {
    /** Tragfähigkeit im Verhältnis zu einem Vollgummirad gleichen Durchmessers. */
    capacity: number;
    /** Reifenbreite im Verhältnis zum Durchmesser. */
    widthRatio: number;
    /** Empfohlene Höchstgeschwindigkeit in km/h. */
    maxSpeedKmh: number;
    /** Rollwiderstandsbeiwert auf glattem Boden. */
    rolling: number;
    /** Radmasse in kg bei 1 m Durchmesser, skaliert mit dem Quadrat. */
    massFactor: number;
  }
> = {
  solid: { capacity: 1, widthRatio: 0.42, maxSpeedKmh: 16, rolling: 0.02, massFactor: 260 },
  superElastic: { capacity: 0.85, widthRatio: 0.42, maxSpeedKmh: 25, rolling: 0.022, massFactor: 230 },
  pneumatic: { capacity: 0.5, widthRatio: 0.36, maxSpeedKmh: 40, rolling: 0.025, massFactor: 110 },
  polyurethane: { capacity: 1.4, widthRatio: 0.36, maxSpeedKmh: 6, rolling: 0.012, massFactor: 300 },
};

/** Raddurchmesser in mm mit Tragfähigkeit eines Vollgummirads in kg. */
const WHEEL_SIZES: [diameterMm: number, capacityKg: number][] = [
  [250, 600],
  [310, 1100],
  [400, 1900],
  [500, 3600],
  [560, 4600],
  [650, 6000],
  [760, 8000],
];

/** Bauhöhe der Federung zwischen Rahmen und Achse in mm. */
export const SPRING_HEIGHT_MM: Record<Suspension, number> = { none: 0, rubber: 60, leaf: 100, air: 160 };

/** Mehr- oder Mindergewicht des Belags gegenüber Stahlblech in kg/m², für die Überschlagsrechnung. */
const DECK_KG_PER_M2: Record<DeckMaterial, number> = {
  steel: 0,
  checker: 0,
  pine: -40,
  hardwood: -30,
  plywood: -45,
  rubber: 12,
  none: -63,
};

export interface Derived {
  axleType: 'pendel' | 'starr';
  frontAxles: number;
  rearAxles: number;
  wheelsPerAxle: number;
  wheelCount: number;
  wheelDiameterMm: number;
  wheelWidthMm: number;
  /** Tragfähigkeit eines Rads der gewählten Bereifung in kg. */
  wheelCapacityKg: number;
  axleSpacingMm: number;
  frameHeightMm: number;
  springHeightMm: number;
  /** Überschlägiges Eigengewicht, nur für die Auslegung der Räder. Das genaue Gewicht liefert die Stückliste. */
  tareEstimateKg: number;
  minAxles: number;
  minLengthMm: number;
  minWidthMm: number;
  minDeckHeightMm: number;
}

export type AdjustedField = 'axles' | 'lengthMm' | 'widthMm' | 'deckHeightMm' | 'steeringDeg';

export interface Resolved {
  config: TrailerConfig;
  derived: Derived;
  /** Felder, die das Regelwerk gegenüber der Eingabe angehoben hat. */
  adjustments: Partial<Record<AdjustedField, string>>;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

/** Kleinstes Rad, das die Radlast mit der gewählten Bereifung trägt; sonst das größte. */
function wheelFor(wheelLoadKg: number, tyre: Tyre): { diameterMm: number; capacityKg: number } {
  const factor = TYRES[tyre].capacity;
  for (const [diameterMm, capacityKg] of WHEEL_SIZES) {
    if (capacityKg * factor >= wheelLoadKg) return { diameterMm, capacityKg: capacityKg * factor };
  }
  const [diameterMm, capacityKg] = WHEEL_SIZES[WHEEL_SIZES.length - 1];
  return { diameterMm, capacityKg: capacityKg * factor };
}

export const wheelMassKg = (diameterMm: number, tyre: Tyre) =>
  Math.round(TYRES[tyre].massFactor * (diameterMm / 1000) ** 2);

export function minAxlesFor(payloadT: number): number {
  return clamp(Math.ceil(payloadT / MAX_AXLE_LOAD_T), LIMITS.axles.min, LIMITS.axles.max);
}

/** Länge einer Achsgruppe von Radvorderkante bis Radhinterkante. */
const groupLength = (count: number, spacingMm: number, wheelMm: number) =>
  (count - 1) * spacingMm + wheelMm;

/** Belag aus Holz oder Platten, an dessen Rand ein Kantenschutz sitzen kann. */
export const hasBoardDeck = (deck: DeckMaterial) => deck === 'pine' || deck === 'hardwood' || deck === 'plywood';

export function computeDerived(c: TrailerConfig): Derived {
  const areaM2 = (c.lengthMm / 1000) * (c.widthMm / 1000);
  const axleLoadT = c.payloadT / c.axles;
  const axleType = axleLoadT > RIGID_AXLE_LOAD_T ? 'pendel' : 'starr';
  const wheelsPerAxle = axleType === 'pendel' ? 4 : 2;
  const wheelCount = wheelsPerAxle * c.axles;

  // An der Stückliste typischer Konfigurationen abgeglichen.
  const structureKg = areaM2 * (125 + 2.2 * c.payloadT + DECK_KG_PER_M2[c.deck]);
  const fixedKg = 300 + c.axles * 60;
  const tareWith = (diameterMm: number) =>
    structureKg + fixedKg + wheelCount * wheelMassKg(diameterMm, c.tyre);

  // Rad und Eigengewicht hängen voneinander ab: zwei Durchläufe genügen.
  let wheel = wheelFor((c.payloadT * 1000 + structureKg + fixedKg) / wheelCount, c.tyre);
  wheel = wheelFor((c.payloadT * 1000 + tareWith(wheel.diameterMm)) / wheelCount, c.tyre);
  const wheelDiameterMm = wheel.diameterMm;

  const tareEstimateKg = roundTo(tareWith(wheelDiameterMm), 10);
  const wheelWidthMm = roundTo(wheelDiameterMm * TYRES[c.tyre].widthRatio, 10);
  const axleSpacingMm = wheelDiameterMm + 120;
  const frameHeightMm = clamp(
    roundTo(100 + 4.5 * c.payloadT + 12 * (c.lengthMm / 1000), 10),
    120,
    420,
  );
  const springHeightMm = SPRING_HEIGHT_MM[c.suspension];

  const frontAxles = c.axles === 4 ? 2 : 1;
  const rearAxles = c.axles - frontAxles;

  const minLengthMm = clamp(
    ceilTo(
      groupLength(frontAxles, axleSpacingMm, wheelDiameterMm) +
        groupLength(rearAxles, axleSpacingMm, wheelDiameterMm) +
        500,
      LIMITS.lengthMm.step,
    ),
    LIMITS.lengthMm.min,
    LIMITS.lengthMm.max,
  );
  const minWidthMm = clamp(
    ceilTo(
      axleType === 'pendel' ? 2 * (2 * wheelWidthMm + 100) + 360 : 2 * wheelWidthMm + 700,
      LIMITS.widthMm.step,
    ),
    LIMITS.widthMm.min,
    LIMITS.widthMm.max,
  );
  // Rad + Drehschemel und Achsträger (160 mm) + Federung + Rahmen.
  const minDeckHeightMm = clamp(
    ceilTo(wheelDiameterMm + frameHeightMm + 160 + springHeightMm, LIMITS.deckHeightMm.step),
    LIMITS.deckHeightMm.min,
    LIMITS.deckHeightMm.max,
  );

  return {
    axleType,
    frontAxles,
    rearAxles,
    wheelsPerAxle,
    wheelCount,
    wheelDiameterMm,
    wheelWidthMm,
    wheelCapacityKg: Math.round(wheel.capacityKg),
    axleSpacingMm,
    frameHeightMm,
    springHeightMm,
    tareEstimateKg,
    minAxles: minAxlesFor(c.payloadT),
    minLengthMm,
    minWidthMm,
    minDeckHeightMm,
  };
}

/**
 * Macht aus der gewünschten Konfiguration eine baubare: Werte werden auf die
 * Grenzen begrenzt und dort angehoben, wo Traglast und Fahrwerk es verlangen.
 * Die Eingabe bleibt unverändert, damit ein angehobener Wert wieder zurückgeht,
 * sobald die Ursache entfällt.
 */
export function resolve(requested: TrailerConfig): Resolved {
  const limit = (key: keyof typeof LIMITS & keyof TrailerConfig, value: number) => {
    const l = LIMITS[key] as { min: number; max: number; step?: number };
    return clamp(roundTo(value, l.step ?? 1), l.min, l.max);
  };
  const c: TrailerConfig = {
    ...requested,
    payloadT: limit('payloadT', requested.payloadT),
    axles: limit('axles', requested.axles),
    lengthMm: limit('lengthMm', requested.lengthMm),
    widthMm: limit('widthMm', requested.widthMm),
    deckHeightMm: limit('deckHeightMm', requested.deckHeightMm),
    steeringDeg: limit('steeringDeg', requested.steeringDeg),
    speedKmh: limit('speedKmh', requested.speedKmh),
    slopePct: limit('slopePct', requested.slopePct),
    obstacleMm: limit('obstacleMm', requested.obstacleMm),
    trailersInTrain: limit('trailersInTrain', requested.trailersInTrain),
    // Ein Kantenschutz setzt einen Belag aus Holz oder Platten voraus.
    edgeProtection: hasBoardDeck(requested.deck) ? requested.edgeProtection : 'none',
  };
  const adjustments: Resolved['adjustments'] = {};

  // Eingeschlagen läge das Gelenk unter der Ladefläche, die Deichsel könnte nicht hochklappen.
  if (c.drawbarUp && c.steeringDeg !== 0) {
    c.steeringDeg = 0;
    adjustments.steeringDeg = 'Hochgeklappt steht die Deichsel in Geradeausstellung.';
  }

  const minAxles = minAxlesFor(c.payloadT);
  if (c.axles < minAxles) {
    c.axles = minAxles;
    adjustments.axles = `Ab ${(minAxles - 1) * MAX_AXLE_LOAD_T + 1} t Traglast mindestens ${minAxles} Achsen.`;
  }

  let derived = computeDerived(c);
  for (let i = 0; i < 6; i++) {
    let changed = false;
    if (c.lengthMm < derived.minLengthMm) {
      c.lengthMm = derived.minLengthMm;
      adjustments.lengthMm = 'Auf die Mindestlänge für dieses Fahrwerk angehoben.';
      changed = true;
    }
    if (c.widthMm < derived.minWidthMm) {
      c.widthMm = derived.minWidthMm;
      adjustments.widthMm = 'Auf die Mindestbreite für diese Bereifung angehoben.';
      changed = true;
    }
    if (c.deckHeightMm < derived.minDeckHeightMm) {
      c.deckHeightMm = derived.minDeckHeightMm;
      adjustments.deckHeightMm = 'Auf die Mindesthöhe für Räder, Federung und Rahmen angehoben.';
      changed = true;
    }
    if (!changed) break;
    derived = computeDerived(c);
  }

  // Die Last passt höchstens auf die Ladefläche.
  c.loadLengthMm = clamp(roundTo(c.loadLengthMm, 100), LIMITS.loadLengthMm.min, c.lengthMm);
  c.loadWidthMm = clamp(roundTo(c.loadWidthMm, 50), LIMITS.loadWidthMm.min, c.widthMm);
  c.loadHeightMm = limit('loadHeightMm', c.loadHeightMm);

  return { config: c, derived, adjustments };
}

export interface AxleLayout {
  /** Mitte der vorderen Achsgruppe (Drehschemel), x ab Fahrzeugmitte, vorn positiv. */
  frontCenterMm: number;
  rearCenterMm: number;
  frontAxlesMm: number[];
  rearAxlesMm: number[];
}

export function axleLayout(c: TrailerConfig, d: Derived): AxleLayout {
  const frontLen = groupLength(d.frontAxles, d.axleSpacingMm, d.wheelDiameterMm);
  const rearLen = groupLength(d.rearAxles, d.axleSpacingMm, d.wheelDiameterMm);
  const frontOffset = Math.max(frontLen / 2 + 150, Math.min(0.13 * c.lengthMm, 900));
  const rearOffset = Math.max(rearLen / 2 + 150, Math.min(0.16 * c.lengthMm, 1400));
  const frontCenterMm = c.lengthMm / 2 - frontOffset;
  const rearCenterMm = -c.lengthMm / 2 + rearOffset;
  const spread = (center: number, count: number) =>
    Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * d.axleSpacingMm);
  return {
    frontCenterMm,
    rearCenterMm,
    frontAxlesMm: spread(frontCenterMm, d.frontAxles),
    rearAxlesMm: spread(rearCenterMm, d.rearAxles),
  };
}
