/**
 * Parameter des Konfigurators und die Auslegung des Fahrwerks.
 *
 * Alle Längen in Millimetern, Lasten in Tonnen bzw. Kilogramm. Die Auslegung
 * folgt bewusst einfachen Faustregeln für das Anschauungsmodell und ersetzt
 * keine technische Auslegung. Das Regelwerk dazu steht in rules.ts.
 */

import { RULE_DATA } from '../data';
import { ceilTo, clamp, roundTo } from './math';

/** Auswahllisten mit Anzeigenamen, gemeinsam genutzt von Bedienung und Zusammenfassung. */
export const OPTIONS = {
  body: [
    { id: 'platform', name: 'Plattform' },
    { id: 'lowbed', name: 'Tieflader' },
    { id: 'longload', name: 'Langmaterial' },
  ],
  rearWheels: [
    { id: 'inside', name: 'Innen laufend' },
    { id: 'outside', name: 'Außen laufend' },
  ],
  ramp: [
    { id: 'none', name: 'Ohne' },
    { id: 'side', name: 'Seitlich' },
    { id: 'rear', name: 'Hinten' },
  ],
  rasterMm: [
    { id: 250, name: '250 mm' },
    { id: 500, name: '500 mm' },
    { id: 1000, name: '1.000 mm' },
  ],
  roof: [
    { id: 'none', name: 'Ohne' },
    { id: 'tarp', name: 'Plane' },
    { id: 'sheet', name: 'Dachblech' },
  ],
  roofShape: [
    { id: 'flat', name: 'Flachdach' },
    { id: 'mono', name: 'Pultdach' },
  ],
  roofSides: [
    { id: 'open', name: 'Offen' },
    { id: 'tarp', name: 'Plane fest' },
    { id: 'curtain', name: 'Vorhangplane' },
    { id: 'mesh', name: 'Schutzgitter' },
  ],
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
  steering: [
    { id: 'turntable', name: 'Drehschemel' },
    { id: 'doubleTurntable', name: 'Doppel-Drehschemel' },
    { id: 'ackermann2', name: '2-Rad-Achsschenkel' },
    { id: 'ackermann4', name: '4-Rad-Achsschenkel' },
    { id: 'allWheel', name: 'Allrad (Pendelachsen)' },
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

export type Body = OptionId<'body'>;
export type RearWheels = OptionId<'rearWheels'>;
export type Ramp = OptionId<'ramp'>;
export type Raster = OptionId<'rasterMm'>;
export type Roof = OptionId<'roof'>;
export type RoofShape = OptionId<'roofShape'>;
export type RoofSides = OptionId<'roofSides'>;
export type Site = OptionId<'site'>;
export type Ground = OptionId<'ground'>;
export type LoadType = OptionId<'loadType'>;
export type Steering = OptionId<'steering'>;
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

  // Bauform
  body: Body;
  /** Tieflader: Ladehöhe des Tiefbetts. */
  bedHeightMm: number;
  /** Tieflader: Hinterräder unter einem Podest (innen) oder neben dem Tiefbett (außen). */
  rearWheels: RearWheels;
  ramp: Ramp;
  /** Langmaterial: kürzeste und längste einstellbare Länge sowie das Raster dazwischen. */
  minLengthMm: number;
  maxLengthMm: number;
  rasterMm: Raster;

  // Dachaufbau
  roof: Roof;
  roofShape: RoofShape;
  /** Lichte Höhe unter dem Dach. */
  roofClearMm: number;
  roofSides: RoofSides;

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
  steering: Steering;
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

/** Einstellbereiche der Zahlenwerte; gepflegt in src/data/rules.json. */
export const LIMITS = RULE_DATA.limits;

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

  body: 'platform',
  bedHeightMm: 350,
  rearWheels: 'inside',
  ramp: 'none',
  minLengthMm: 5000,
  maxLengthMm: 8000,
  rasterMm: 500,

  roof: 'none',
  roofShape: 'flat',
  roofClearMm: 1800,
  roofSides: 'open',

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

  steering: 'turntable',
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

// Die folgenden Kennzahlen stehen in src/data/rules.json und lassen sich dort pflegen.

/** Tragfähigkeit einer Achslinie mit Pendelachsen (4 Räder). */
export const MAX_AXLE_LOAD_T = RULE_DATA.axles.maxAxleLoadT;
/** Bis zu dieser Achslast genügt eine Starrachse mit 2 Rädern. */
export const RIGID_AXLE_LOAD_T = RULE_DATA.axles.rigidAxleLoadT;

/**
 * Lenkungsarten: Vorder- und Hinterachsen sitzen entweder auf einem Drehschemel
 * ('bogie'), lenken je Rad bzw. Pendelachse um einen eigenen Zapfen ('knuckle')
 * oder sind starr ('fixed'). maxDeg begrenzt den Lenkeinschlag.
 */
export const STEERING = RULE_DATA.steering as unknown as Record<Steering, { front: 'bogie' | 'knuckle'; rear: 'bogie' | 'knuckle' | 'fixed'; maxDeg: number }>;

/** Eigenschaften der Bereifungsarten. */
export const TYRES = RULE_DATA.tyres as unknown as Record<
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
>;

/** Raddurchmesser in mm mit Tragfähigkeit eines Vollgummirads in kg, aufsteigend. */
const WHEEL_SIZES = RULE_DATA.wheelSizes;

/** Bauhöhe der Federung zwischen Rahmen und Achse in mm. */
export const SPRING_HEIGHT_MM = RULE_DATA.springHeightMm as unknown as Record<Suspension, number>;

/** Mehr- oder Mindergewicht des Belags gegenüber Stahlblech in kg/m², für die Überschlagsrechnung. */
const DECK_KG_PER_M2 = RULE_DATA.deckKgPerM2 as unknown as Record<DeckMaterial, number>;

/** Zuschlag auf den Rollwiderstand je nach Untergrund. */
export const GROUND_FACTOR = RULE_DATA.groundFactor as unknown as Record<Ground, number>;

/** Schwellen, ab denen Hinweise erscheinen. */
export const ADVICE_LIMITS = RULE_DATA.advice;

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


/** Kleinstes Rad, das die Radlast mit der gewählten Bereifung trägt; sonst das größte. */
function wheelFor(wheelLoadKg: number, tyre: Tyre): { diameterMm: number; capacityKg: number } {
  const factor = TYRES[tyre].capacity;
  for (const { diameterMm, capacityKg } of WHEEL_SIZES) {
    if (capacityKg * factor >= wheelLoadKg) return { diameterMm, capacityKg: capacityKg * factor };
  }
  const { diameterMm, capacityKg } = WHEEL_SIZES[WHEEL_SIZES.length - 1];
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

/** Langmaterial: Länge eines Fahrgestellmoduls über einer Achsgruppe in mm. */
export const moduleLengthMm = (d: Pick<Derived, 'frontAxles' | 'rearAxles' | 'axleSpacingMm' | 'wheelDiameterMm'>) =>
  groupLength(Math.max(d.frontAxles, d.rearAxles), d.axleSpacingMm, d.wheelDiameterMm) + 600;

/** Tieflader außen laufend: Breite eines Radkastens neben dem Tiefbett in mm. */
export const wheelHouseMm = (d: Pick<Derived, 'axleType' | 'wheelWidthMm'>) =>
  d.axleType === 'pendel' ? 2 * d.wheelWidthMm + 240 : d.wheelWidthMm + 160;

/** Belag aus Holz oder Platten, an dessen Rand ein Kantenschutz sitzen kann. */
export const hasBoardDeck = (deck: DeckMaterial) => deck === 'pine' || deck === 'hardwood' || deck === 'plywood';

export function computeDerived(c: TrailerConfig): Derived {
  const areaM2 = (c.lengthMm / 1000) * (c.widthMm / 1000);
  const axleLoadT = c.payloadT / c.axles;
  // Die Allradlenkung setzt Pendelachsen voraus.
  const axleType = axleLoadT > RIGID_AXLE_LOAD_T || c.steering === 'allWheel' ? 'pendel' : 'starr';
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

  // Der Tieflader braucht zwischen den Achsgruppen zusätzlich Platz für das Tiefbett.
  const minLengthMm = clamp(
    ceilTo(
      groupLength(frontAxles, axleSpacingMm, wheelDiameterMm) +
        groupLength(rearAxles, axleSpacingMm, wheelDiameterMm) +
        (c.body === 'lowbed' ? 2450 : 500),
      LIMITS.lengthMm.step,
    ),
    LIMITS.lengthMm.min,
    LIMITS.lengthMm.max,
  );
  // Außen laufende Hinterräder lassen ein Tiefbett von mindestens 800 mm Breite zwischen den Radkästen.
  const minWidthMm = clamp(
    ceilTo(
      Math.max(
        axleType === 'pendel' ? 2 * (2 * wheelWidthMm + 100) + 360 : 2 * wheelWidthMm + 700,
        c.body === 'lowbed' && c.rearWheels === 'outside' ? 2 * wheelHouseMm({ axleType, wheelWidthMm }) + 800 : 0,
      ),
      LIMITS.widthMm.step,
    ),
    LIMITS.widthMm.min,
    LIMITS.widthMm.max,
  );
  // Rad + Drehschemel (160 mm) bzw. Lenkzapfen (60 mm) + Federung + Rahmen.
  const mode = STEERING[c.steering];
  const underFrameMm = mode.front === 'bogie' || mode.rear === 'bogie' ? 160 : 60;
  const minDeckHeightMm = clamp(
    ceilTo(wheelDiameterMm + frameHeightMm + underFrameMm + springHeightMm, LIMITS.deckHeightMm.step),
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
  // Beim Langmaterial-Anhänger sitzt jede Achsgruppe mittig unter ihrem Fahrgestellmodul.
  const centered = c.body === 'longload' ? moduleLengthMm(d) / 2 : 0;
  const frontOffset = centered || Math.max(frontLen / 2 + 150, Math.min(0.13 * c.lengthMm, 900));
  const rearOffset = centered || Math.max(rearLen / 2 + 150, Math.min(0.16 * c.lengthMm, 1400));
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
