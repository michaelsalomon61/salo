/**
 * Kennwerte und Hinweise, die vom Eigengewicht aus der Stückliste abhängen.
 * Die Hinweise sind Faustregeln: Sie machen auf Unstimmigkeiten aufmerksam,
 * ändern die Konfiguration aber nicht.
 */
import { TYRES, optionName, type Derived, type Ground, type TrailerConfig } from './config';

/** Zuschlag auf den Rollwiderstand je nach Untergrund. */
const GROUND_FACTOR: Record<Ground, number> = { smooth: 1, asphalt: 1.3, paving: 1.8, unpaved: 3 };

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

export function advise(config: TrailerConfig, derived: Derived, tareKg: number): string[] {
  const nf = new Intl.NumberFormat('de-DE');
  const p = performance(config, derived, tareKg);
  const tyre = TYRES[config.tyre];
  const tyreName = optionName('tyre', config.tyre);
  const notes: string[] = [];

  if (p.wheelLoadKg > derived.wheelCapacityKg) {
    notes.push(
      `Die Radlast von ${nf.format(p.wheelLoadKg)} kg übersteigt die Tragfähigkeit der Bereifung ${tyreName} (${nf.format(derived.wheelCapacityKg)} kg je Rad). Mehr Achsen oder eine andere Bereifung wählen.`,
    );
  }
  if (config.speedKmh > tyre.maxSpeedKmh) {
    notes.push(`Die Bereifung ${tyreName} ist nur bis etwa ${tyre.maxSpeedKmh} km/h geeignet, geplant sind ${config.speedKmh} km/h.`);
  }
  if ((config.ground === 'paving' || config.ground === 'unpaved') && (config.tyre === 'solid' || config.tyre === 'polyurethane')) {
    notes.push('Für unebenen Untergrund sind Luft- oder Super-Elastic-Reifen besser geeignet.');
  }
  if (config.obstacleMm > derived.wheelDiameterMm * 0.12) {
    notes.push(
      `Ein Hindernis von ${config.obstacleMm} mm ist für Räder mit Ø ${derived.wheelDiameterMm} mm zu hoch (Richtwert: höchstens ${Math.floor(derived.wheelDiameterMm * 0.12)} mm).`,
    );
  }

  if (config.publicRoads) {
    if (config.brake === 'none') notes.push('Öffentliche Verkehrswege: Es ist eine Betriebsbremse erforderlich.');
    if (config.lighting !== 'stvzo') notes.push('Öffentliche Verkehrswege: Es ist eine Beleuchtung nach StVZO erforderlich.');
    if (config.chocks === 'none') notes.push('Öffentliche Verkehrswege: Unterlegkeile mitführen.');
    if (config.tyre === 'solid' || config.tyre === 'polyurethane') {
      notes.push('Öffentliche Verkehrswege: Üblich sind Luft- oder Super-Elastic-Reifen.');
    }
  } else if (config.brake === 'none' && config.speedKmh > 10) {
    notes.push(`Bei ${config.speedKmh} km/h ist eine Betriebsbremse zu empfehlen.`);
  }
  if (config.slopePct >= 3 && !config.parkingBrake && config.chocks === 'none') {
    notes.push(`Bei ${config.slopePct} % Steigung den Anhänger mit Feststellbremse oder Unterlegkeilen sichern.`);
  }

  if (config.body === 'lowbed' && config.ramp === 'rear' && config.rearCoupling !== 'none') {
    notes.push('Die Auffahrklappe hinten verdeckt die Kupplung hinten. Eines von beiden abwählen.');
  }
  if (config.trailersInTrain > 1 && config.rearCoupling === 'none') {
    notes.push('Für den Zugverband mit mehreren Anhängern ist eine Kupplung hinten nötig.');
  }
  if (config.towForceN !== null && config.towForceN < p.pullN) {
    notes.push(
      `Die Zugkraft des Zugfahrzeugs (${nf.format(config.towForceN)} N) liegt unter dem Bedarf von etwa ${nf.format(p.pullN)} N.`,
    );
  }
  if (config.towWeightKg !== null && config.brake === 'none' && p.grossKg * config.trailersInTrain > config.towWeightKg * 1.5) {
    notes.push('Die ungebremste Anhängelast ist deutlich höher als das Gewicht des Zugfahrzeugs. Eine Betriebsbremse ist zu empfehlen.');
  }
  return notes;
}
