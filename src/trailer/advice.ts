/**
 * Kennwerte und Hinweise, die vom Eigengewicht aus der Stückliste abhängen.
 * Die Hinweise sind Faustregeln: Sie machen auf Unstimmigkeiten aufmerksam,
 * ändern die Konfiguration aber nicht.
 */
import { msg, type Msg } from '../i18n';
import { ADVICE_LIMITS, GROUND_FACTOR, TYRES, optionName, type Derived, type TrailerConfig } from './config';

export interface Performance {
  grossKg: number;
  wheelLoadKg: number;
  /** Zugkraftbedarf am Haken in Newton für den ganzen Zugverband, bei Konstantfahrt. */
  pullN: number;
}

export function performance(config: TrailerConfig, derived: Derived, tareKg: number): Performance {
  const grossKg = config.payloadT * 1000 + tareKg;
  const resistance = TYRES[config.tyre].rolling * GROUND_FACTOR[config.ground] + config.slopePct / 100;
  return {
    grossKg,
    wheelLoadKg: Math.round(grossKg / derived.wheelCount / 10) * 10,
    pullN: Math.round((grossKg * 9.81 * resistance * config.trailersInTrain) / 10) * 10,
  };
}

/** Was eine Hinweisregel zu sehen bekommt. */
interface AdviceContext {
  config: TrailerConfig;
  derived: Derived;
  perf: Performance;
  tyre: (typeof TYRES)[keyof typeof TYRES];
  /** Name der Bereifung als Ausgangstext; wird bei der Anzeige übersetzt. */
  tyreName: string;
}

interface AdviceRule {
  id: string;
  /** Liefert den Hinweis, wenn die Regel anschlägt. */
  check: (ctx: AdviceContext) => Msg | false | null | undefined;
}

const hardTyre = (c: TrailerConfig) => c.tyre === 'solid' || c.tyre === 'polyurethane';

/** Die Hinweise in der Reihenfolge, in der sie erscheinen. Die Schwellen stehen in src/data/rules.json. */
export const ADVICE_RULES: AdviceRule[] = [
  {
    id: 'wheelLoadWithinCapacity',
    check: ({ perf, derived, tyreName }) =>
      perf.wheelLoadKg > derived.wheelCapacityKg &&
      msg('Die Radlast von {load} kg übersteigt die Tragfähigkeit der Bereifung {tyre} ({capacity} kg je Rad). Mehr Achsen oder eine andere Bereifung wählen.', {
        load: perf.wheelLoadKg,
        tyre: tyreName,
        capacity: derived.wheelCapacityKg,
      }),
  },
  {
    id: 'tyreSuitsSpeed',
    check: ({ config, tyre, tyreName }) =>
      config.speedKmh > tyre.maxSpeedKmh && msg('Die Bereifung {tyre} ist nur bis etwa {max} km/h geeignet, geplant sind {speed} km/h.', { tyre: tyreName, max: tyre.maxSpeedKmh, speed: config.speedKmh }),
  },
  {
    id: 'tyreSuitsGround',
    check: ({ config }) => (config.ground === 'paving' || config.ground === 'unpaved') && hardTyre(config) && msg('Für unebenen Untergrund sind Luft- oder Super-Elastic-Reifen besser geeignet.'),
  },
  {
    id: 'obstacleWithinWheelSize',
    check: ({ config, derived }) =>
      config.obstacleMm > derived.wheelDiameterMm * ADVICE_LIMITS.obstacleShareOfWheel &&
      msg('Ein Hindernis von {obstacle} mm ist für Räder mit Ø {diameter} mm zu hoch (Richtwert: höchstens {limit} mm).', {
        obstacle: config.obstacleMm,
        diameter: derived.wheelDiameterMm,
        limit: Math.floor(derived.wheelDiameterMm * ADVICE_LIMITS.obstacleShareOfWheel),
      }),
  },
  { id: 'publicRoadsNeedBrake', check: ({ config }) => config.publicRoads && config.brake === 'none' && msg('Öffentliche Verkehrswege: Es ist eine Betriebsbremse erforderlich.') },
  { id: 'publicRoadsNeedLighting', check: ({ config }) => config.publicRoads && config.lighting !== 'stvzo' && msg('Öffentliche Verkehrswege: Es ist eine Beleuchtung nach StVZO erforderlich.') },
  { id: 'publicRoadsNeedChocks', check: ({ config }) => config.publicRoads && config.chocks === 'none' && msg('Öffentliche Verkehrswege: Unterlegkeile mitführen.') },
  { id: 'publicRoadsPreferSoftTyres', check: ({ config }) => config.publicRoads && hardTyre(config) && msg('Öffentliche Verkehrswege: Üblich sind Luft- oder Super-Elastic-Reifen.') },
  {
    id: 'brakeAtHigherSpeed',
    check: ({ config }) =>
      !config.publicRoads && config.brake === 'none' && config.speedKmh > ADVICE_LIMITS.brakeAboveKmh && msg('Bei {speed} km/h ist eine Betriebsbremse zu empfehlen.', { speed: config.speedKmh }),
  },
  {
    id: 'secureOnSlope',
    check: ({ config }) =>
      config.slopePct >= ADVICE_LIMITS.secureFromSlopePct &&
      !config.parkingBrake &&
      config.chocks === 'none' &&
      msg('Bei {slope} % Steigung den Anhänger mit Feststellbremse oder Unterlegkeilen sichern.', { slope: config.slopePct }),
  },
  {
    id: 'rearRampHidesCoupling',
    check: ({ config }) =>
      config.body === 'lowbed' && config.ramp === 'rear' && config.rearCoupling !== 'none' && msg('Die Auffahrklappe hinten verdeckt die Kupplung hinten. Eines von beiden abwählen.'),
  },
  {
    id: 'trainNeedsRearCoupling',
    check: ({ config }) => config.trailersInTrain > 1 && config.rearCoupling === 'none' && msg('Für den Zugverband mit mehreren Anhängern ist eine Kupplung hinten nötig.'),
  },
  {
    id: 'towForceSufficient',
    check: ({ config, perf }) =>
      config.towForceN !== null &&
      config.towForceN < perf.pullN &&
      msg('Die Zugkraft des Zugfahrzeugs ({force} N) liegt unter dem Bedarf von etwa {need} N.', { force: config.towForceN, need: perf.pullN }),
  },
  {
    id: 'unbrakedLoadWithinTowWeight',
    check: ({ config, perf }) =>
      config.towWeightKg !== null &&
      config.brake === 'none' &&
      perf.grossKg * config.trailersInTrain > config.towWeightKg * ADVICE_LIMITS.unbrakedTowRatio &&
      msg('Die ungebremste Anhängelast ist deutlich höher als das Gewicht des Zugfahrzeugs. Eine Betriebsbremse ist zu empfehlen.'),
  },
];

/** Alle Hinweise, die für diese Konfiguration anschlagen. */
export function advise(config: TrailerConfig, derived: Derived, tareKg: number): Msg[] {
  const ctx: AdviceContext = { config, derived, perf: performance(config, derived, tareKg), tyre: TYRES[config.tyre], tyreName: optionName('tyre', config.tyre) };
  return ADVICE_RULES.map((rule) => rule.check(ctx)).filter((hint): hint is Msg => !!hint);
}
