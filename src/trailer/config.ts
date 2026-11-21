/**
 * Regelwerk des Konfigurators.
 *
 * Alle Längen in Millimetern, Lasten in Tonnen bzw. Kilogramm. Die Regeln sind
 * bewusst einfache Faustregeln für das Anschauungsmodell und ersetzen keine
 * technische Auslegung.
 */

export type DeckMaterial = 'steel' | 'checker' | 'wood' | 'rubber';

export interface TrailerConfig {
  payloadT: number;
  axles: number;
  lengthMm: number;
  widthMm: number;
  deckHeightMm: number;
  deck: DeckMaterial;
  colorId: string;
  drawbarUp: boolean;
  /** Lenkeinschlag des Drehschemels in Grad, negativ = links, positiv = rechts. */
  steeringDeg: number;
}

export const LIMITS = {
  payloadT: { min: 2, max: 48, step: 1 },
  axles: { min: 2, max: 4 },
  lengthMm: { min: 2000, max: 12000, step: 100 },
  widthMm: { min: 1200, max: 3000, step: 50 },
  deckHeightMm: { min: 400, max: 1500, step: 10 },
  steeringDeg: { min: -60, max: 60, step: 1 },
} as const;

export const COLORS = [
  { id: 'ral3020', name: 'Verkehrsrot', ral: 'RAL 3020', hex: '#c8131b' },
  { id: 'ral5010', name: 'Enzianblau', ral: 'RAL 5010', hex: '#0a4f84' },
  { id: 'ral1023', name: 'Verkehrsgelb', ral: 'RAL 1023', hex: '#f2b600' },
  { id: 'ral6018', name: 'Gelbgrün', ral: 'RAL 6018', hex: '#4f9a35' },
  { id: 'ral7016', name: 'Anthrazitgrau', ral: 'RAL 7016', hex: '#383e42' },
  { id: 'ral7035', name: 'Lichtgrau', ral: 'RAL 7035', hex: '#c9cdcb' },
] as const;

/** kgPerM2: Mehr- oder Mindergewicht des Belags gegenüber Stahlblech, für die Überschlagsrechnung. */
export const DECKS: { id: DeckMaterial; name: string; kgPerM2: number }[] = [
  { id: 'steel', name: 'Stahlblech', kgPerM2: 0 },
  { id: 'checker', name: 'Riffelblech', kgPerM2: 0 },
  { id: 'wood', name: 'Hartholz', kgPerM2: -30 },
  { id: 'rubber', name: 'Gummi', kgPerM2: 12 },
];

export const DEFAULT_CONFIG: TrailerConfig = {
  payloadT: 24,
  axles: 2,
  lengthMm: 6000,
  widthMm: 2500,
  deckHeightMm: 950,
  deck: 'steel',
  colorId: 'ral3020',
  drawbarUp: false,
  steeringDeg: 0,
};

/** Tragfähigkeit einer Achslinie mit Pendelachsen (4 Räder). */
export const MAX_AXLE_LOAD_T = 12;
/** Bis zu dieser Achslast genügt eine Starrachse mit 2 Rädern. */
export const RIGID_AXLE_LOAD_T = 5;

export interface Derived {
  axleType: 'pendel' | 'starr';
  frontAxles: number;
  rearAxles: number;
  wheelsPerAxle: number;
  wheelCount: number;
  wheelDiameterMm: number;
  wheelWidthMm: number;
  axleSpacingMm: number;
  frameHeightMm: number;
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

/** Vollgummirad passend zur Radlast. */
function wheelDiameterFor(wheelLoadKg: number): number {
  if (wheelLoadKg <= 600) return 250;
  if (wheelLoadKg <= 1100) return 310;
  if (wheelLoadKg <= 1900) return 400;
  if (wheelLoadKg <= 3600) return 500;
  return 560;
}

export const wheelMassKg = (diameterMm: number) => Math.round(260 * (diameterMm / 1000) ** 2);

export function minAxlesFor(payloadT: number): number {
  return clamp(Math.ceil(payloadT / MAX_AXLE_LOAD_T), LIMITS.axles.min, LIMITS.axles.max);
}

/** Länge einer Achsgruppe von Radvorderkante bis Radhinterkante. */
const groupLength = (count: number, spacingMm: number, wheelMm: number) =>
  (count - 1) * spacingMm + wheelMm;

export function computeDerived(c: TrailerConfig): Derived {
  const areaM2 = (c.lengthMm / 1000) * (c.widthMm / 1000);
  const axleLoadT = c.payloadT / c.axles;
  const axleType = axleLoadT > RIGID_AXLE_LOAD_T ? 'pendel' : 'starr';
  const wheelsPerAxle = axleType === 'pendel' ? 4 : 2;
  const wheelCount = wheelsPerAxle * c.axles;

  const deck = DECKS.find((d) => d.id === c.deck) ?? DECKS[0];
  // An der Stückliste typischer Konfigurationen abgeglichen.
  const structureKg = areaM2 * (125 + 2.2 * c.payloadT + deck.kgPerM2);
  const fixedKg = 300 + c.axles * 60;
  const tareWith = (diameterMm: number) =>
    structureKg + fixedKg + wheelCount * wheelMassKg(diameterMm);

  // Rad und Eigengewicht hängen voneinander ab: zwei Durchläufe genügen.
  let wheelDiameterMm = wheelDiameterFor((c.payloadT * 1000 + structureKg + fixedKg) / wheelCount);
  wheelDiameterMm = wheelDiameterFor((c.payloadT * 1000 + tareWith(wheelDiameterMm)) / wheelCount);

  const tareEstimateKg = roundTo(tareWith(wheelDiameterMm), 10);
  const wheelWidthMm = roundTo(wheelDiameterMm * 0.42, 10);
  const axleSpacingMm = wheelDiameterMm + 120;
  const frameHeightMm = clamp(
    roundTo(100 + 4.5 * c.payloadT + 12 * (c.lengthMm / 1000), 10),
    120,
    420,
  );

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
  // Rad + Drehschemel und Achsträger (160 mm) + Rahmen.
  const minDeckHeightMm = clamp(
    ceilTo(wheelDiameterMm + frameHeightMm + 160, LIMITS.deckHeightMm.step),
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
    axleSpacingMm,
    frameHeightMm,
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
  const c: TrailerConfig = {
    ...requested,
    payloadT: clamp(roundTo(requested.payloadT, LIMITS.payloadT.step), LIMITS.payloadT.min, LIMITS.payloadT.max),
    axles: clamp(Math.round(requested.axles), LIMITS.axles.min, LIMITS.axles.max),
    lengthMm: clamp(roundTo(requested.lengthMm, LIMITS.lengthMm.step), LIMITS.lengthMm.min, LIMITS.lengthMm.max),
    widthMm: clamp(roundTo(requested.widthMm, LIMITS.widthMm.step), LIMITS.widthMm.min, LIMITS.widthMm.max),
    deckHeightMm: clamp(
      roundTo(requested.deckHeightMm, LIMITS.deckHeightMm.step),
      LIMITS.deckHeightMm.min,
      LIMITS.deckHeightMm.max,
    ),
    steeringDeg: clamp(Math.round(requested.steeringDeg), LIMITS.steeringDeg.min, LIMITS.steeringDeg.max),
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
      adjustments.deckHeightMm = 'Auf die Mindesthöhe für Räder und Rahmen angehoben.';
      changed = true;
    }
    if (!changed) break;
    derived = computeDerived(c);
  }

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
