/**
 * Regelwerk: macht aus der gewünschten Konfiguration eine baubare.
 *
 * Jede Regel steht für sich, trägt einen Namen und prüft genau eine Bedingung.
 * Greift sie in eine Eingabe ein, liefert sie den Hinweis dazu; er erscheint am
 * betroffenen Feld und in der Hinweisliste. Die Grenzwerte stehen in
 * src/data/rules.json.
 */
import { msg, type Msg } from '../i18n';
import { LIMITS, MAX_AXLE_LOAD_T, STEERING, computeDerived, hasBoardDeck, minAxlesFor, moduleLengthMm, type Derived, type TrailerConfig } from './config';
import { ceilTo, clamp, roundTo } from './math';

/** Felder, an denen ein Hinweis des Regelwerks erscheinen kann. */
export type AdjustedField = 'axles' | 'lengthMm' | 'widthMm' | 'deckHeightMm' | 'steeringDeg' | 'bedHeightMm' | 'rearWheels' | 'ramp' | 'minLengthMm' | 'maxLengthMm';

/** Ergebnis einer Regel: der Hinweis zu einem Eingriff, true für eine stille Änderung, sonst nichts. */
type Outcome = Msg | boolean | void;

interface Rule<Context extends unknown[]> {
  id: string;
  /** Feld, an dem der Hinweis erscheint. */
  field?: AdjustedField;
  /** Passt die Konfiguration an, falls die Regel greift. */
  apply: (c: TrailerConfig, ...context: Context) => Outcome;
}

/** Regeln, die nur von den Eingaben abhängen. */
const CHOICE_RULES: Rule<[]>[] = [
  {
    // Bordwände, Kantenschutz und Dachaufbau gibt es nur auf der durchgehenden Plattform.
    id: 'platformOnlyBody',
    apply: (c) => {
      if (c.body === 'platform') return;
      const changed = c.wallType !== 'none' || c.roof !== 'none' || c.edgeProtection !== 'none';
      c.wallType = 'none';
      c.roof = 'none';
      c.edgeProtection = 'none';
      return changed;
    },
  },
  {
    id: 'steeredRearWheelsRunInside',
    field: 'rearWheels',
    apply: (c) => {
      if (c.body !== 'lowbed' || c.rearWheels !== 'outside' || STEERING[c.steering].rear === 'fixed') return;
      c.rearWheels = 'inside';
      return msg('Gelenkte Hinterachsen laufen innen unter einem Podest.');
    },
  },
  {
    id: 'rearRampNeedsOutsideWheels',
    field: 'ramp',
    apply: (c) => {
      if (c.body !== 'lowbed' || c.ramp !== 'rear' || c.rearWheels !== 'inside') return;
      c.ramp = 'none';
      return msg('Eine Auffahrklappe hinten setzt außen laufende Hinterräder voraus.');
    },
  },
  {
    // Eingeschlagen läge das Gelenk unter der Ladefläche, die Deichsel könnte nicht hochklappen.
    id: 'raisedDrawbarPointsStraight',
    field: 'steeringDeg',
    apply: (c) => {
      if (!c.drawbarUp || c.steeringDeg === 0) return;
      c.steeringDeg = 0;
      return msg('Hochgeklappt steht die Deichsel in Geradeausstellung.');
    },
  },
  {
    id: 'minAxlesForPayload',
    field: 'axles',
    apply: (c) => {
      const minAxles = minAxlesFor(c.payloadT);
      if (c.axles >= minAxles) return;
      c.axles = minAxles;
      return msg('Ab {from} t Traglast mindestens {axles} Achsen.', { from: (minAxles - 1) * MAX_AXLE_LOAD_T + 1, axles: minAxles });
    },
  },
];

/**
 * Mindestmaße aus Fahrwerk und Bereifung. Sie hängen voneinander ab und werden
 * deshalb wiederholt geprüft, bis sich nichts mehr ändert.
 */
const SIZE_RULES: Rule<[Derived]>[] = [
  {
    id: 'minLengthForRunningGear',
    field: 'lengthMm',
    apply: (c, d) => {
      if (c.lengthMm >= d.minLengthMm) return;
      c.lengthMm = d.minLengthMm;
      return msg('Auf die Mindestlänge für dieses Fahrwerk angehoben.');
    },
  },
  {
    id: 'minWidthForTyres',
    field: 'widthMm',
    apply: (c, d) => {
      if (c.widthMm >= d.minWidthMm) return;
      c.widthMm = d.minWidthMm;
      return msg('Auf die Mindestbreite für diese Bereifung angehoben.');
    },
  },
  {
    id: 'minDeckHeightAboveWheels',
    field: 'deckHeightMm',
    apply: (c, d) => {
      if (c.deckHeightMm >= d.minDeckHeightMm) return;
      c.deckHeightMm = d.minDeckHeightMm;
      return msg('Auf die Mindesthöhe für Räder, Federung und Rahmen angehoben.');
    },
  },
];

/** Auszug, den das Langrohr bei einer Mindestlänge zulässt: höchstens seine nutzbare Länge. */
const longestFor = (minMm: number, c: TrailerConfig, d: Derived) =>
  Math.min(LIMITS.lengthMm.max, minMm + Math.max(0, Math.floor((minMm - 2 * moduleLengthMm(d) - 600) / c.rasterMm) * c.rasterMm));

/** Regeln, die auf den fertigen Hauptmaßen aufbauen. */
const DETAIL_RULES: Rule<[Derived]>[] = [
  {
    // Das Tiefbett liegt spürbar unter den Podesten und hat noch Bodenfreiheit.
    id: 'bedBelowPlatforms',
    field: 'bedHeightMm',
    apply: (c) => {
      if (c.body !== 'lowbed') return;
      const bed = clamp(roundTo(c.bedHeightMm, 10), LIMITS.bedHeightMm.min, Math.min(LIMITS.bedHeightMm.max, c.deckHeightMm - 200));
      if (bed === c.bedHeightMm) return;
      const lowered = bed < c.bedHeightMm;
      c.bedHeightMm = bed;
      return lowered ? msg('Das Tiefbett liegt mindestens 200 mm unter den Podesten.') : true;
    },
  },
  {
    // Das Langrohr verbindet zwei Fahrgestellmodule.
    id: 'longLoadShortestLength',
    field: 'minLengthMm',
    apply: (c, d) => {
      if (c.body !== 'longload') return;
      const shortest = ceilTo(2 * moduleLengthMm(d) + 1500, 100);
      const min = clamp(roundTo(c.minLengthMm, 100), shortest, LIMITS.lengthMm.max);
      if (min === c.minLengthMm) return;
      c.minLengthMm = min;
      return msg('Auf die kürzeste Länge für zwei Fahrgestellmodule angehoben.');
    },
  },
  {
    id: 'longLoadReach',
    field: 'maxLengthMm',
    apply: (c, d) => {
      if (c.body !== 'longload') return;
      const min = c.minLengthMm;
      const max = clamp(min + Math.round((c.maxLengthMm - min) / c.rasterMm) * c.rasterMm, min, longestFor(min, c, d));
      if (max === c.maxLengthMm) return;
      const shortened = max < c.maxLengthMm;
      c.maxLengthMm = max;
      return shortened ? msg('Auf den Auszug begrenzt, den das Langrohr bei dieser Mindestlänge zulässt.') : true;
    },
  },
  {
    id: 'longLoadLengthOnRaster',
    apply: (c) => {
      if (c.body !== 'longload') return;
      const length = clamp(c.minLengthMm + Math.round((c.lengthMm - c.minLengthMm) / c.rasterMm) * c.rasterMm, c.minLengthMm, c.maxLengthMm);
      if (length === c.lengthMm) return;
      c.lengthMm = length;
      return true;
    },
  },
  {
    // Die Last passt höchstens auf die Ladefläche.
    id: 'loadFitsDeck',
    apply: (c) => {
      const before = [c.loadLengthMm, c.loadWidthMm, c.loadHeightMm].join();
      c.loadLengthMm = clamp(roundTo(c.loadLengthMm, 100), LIMITS.loadLengthMm.min, c.lengthMm);
      c.loadWidthMm = clamp(roundTo(c.loadWidthMm, 50), LIMITS.loadWidthMm.min, c.widthMm);
      c.loadHeightMm = withinLimit('loadHeightMm', c.loadHeightMm);
      return before !== [c.loadLengthMm, c.loadWidthMm, c.loadHeightMm].join();
    },
  },
];

/** Alle Regeln in der Reihenfolge, in der sie angewandt werden. */
export const RULES = { choices: CHOICE_RULES, sizes: SIZE_RULES, details: DETAIL_RULES };

export interface Resolved {
  config: TrailerConfig;
  derived: Derived;
  /** Hinweise zu den Feldern, in die das Regelwerk eingegriffen hat. */
  adjustments: Partial<Record<AdjustedField, Msg>>;
  /** Namen der Regeln, die etwas geändert haben. */
  applied: string[];
}

function withinLimit(key: keyof typeof LIMITS, value: number): number {
  const l: { min: number; max: number; step?: number } = LIMITS[key];
  return clamp(roundTo(value, l.step ?? 1), l.min, l.max);
}

/** Zahlenwerte auf ihre Einstellbereiche und Schrittweiten bringen. */
function withinLimits(requested: TrailerConfig): TrailerConfig {
  const maxDeg = STEERING[requested.steering].maxDeg;
  return {
    ...requested,
    payloadT: withinLimit('payloadT', requested.payloadT),
    axles: withinLimit('axles', requested.axles),
    lengthMm: withinLimit('lengthMm', requested.lengthMm),
    widthMm: withinLimit('widthMm', requested.widthMm),
    deckHeightMm: withinLimit('deckHeightMm', requested.deckHeightMm),
    steeringDeg: clamp(Math.round(requested.steeringDeg), -maxDeg, maxDeg),
    speedKmh: withinLimit('speedKmh', requested.speedKmh),
    slopePct: withinLimit('slopePct', requested.slopePct),
    obstacleMm: withinLimit('obstacleMm', requested.obstacleMm),
    trailersInTrain: withinLimit('trailersInTrain', requested.trailersInTrain),
    // Ein Kantenschutz setzt einen Belag aus Holz oder Platten voraus.
    edgeProtection: hasBoardDeck(requested.deck) ? requested.edgeProtection : 'none',
    roofClearMm: withinLimit('roofClearMm', requested.roofClearMm),
  };
}

/**
 * Macht aus der gewünschten Konfiguration eine baubare: Werte werden auf die
 * Grenzen begrenzt und dort angehoben, wo Traglast und Fahrwerk es verlangen.
 * Die Eingabe bleibt unverändert, damit ein angehobener Wert wieder zurückgeht,
 * sobald die Ursache entfällt.
 */
export function resolve(requested: TrailerConfig): Resolved {
  const c = withinLimits(requested);
  const adjustments: Resolved['adjustments'] = {};
  const applied: string[] = [];
  const run = <Context extends unknown[]>(rule: Rule<Context>, ...context: Context): boolean => {
    const outcome = rule.apply(c, ...context);
    if (!outcome) return false;
    if (!applied.includes(rule.id)) applied.push(rule.id);
    if (outcome !== true && rule.field) adjustments[rule.field] = outcome;
    return true;
  };

  for (const rule of CHOICE_RULES) run(rule);

  let derived = computeDerived(c);
  for (let pass = 0; pass < 6; pass++) {
    // Alle Mindestmaße gegen denselben Stand prüfen, dann neu auslegen.
    const changed = SIZE_RULES.map((rule) => run(rule, derived)).some(Boolean);
    if (!changed) break;
    derived = computeDerived(c);
  }

  for (const rule of DETAIL_RULES) run(rule, derived);
  return { config: c, derived: computeDerived(c), adjustments, applied };
}
