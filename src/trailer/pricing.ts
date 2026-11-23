/**
 * Preismodell auf Schätzbasis.
 *
 * Die Sätze und Stückpreise stehen in src/data/prices.json. Es sind Annahmen,
 * keine Marktpreise; die Datei lässt sich ohne Eingriff in den Programmcode
 * durch echte Kalkulationswerte ersetzen. Beträge in Euro ohne Mehrwertsteuer.
 */
import { PRICE_DATA } from '../data';
import { locale, msg, type Locale, type Msg } from '../i18n';
import type { TrailerConfig } from './config';
import { GROUPS, partMassKg, type Group, type Part } from './parts';

/** Aufbau der Datendatei mit den Sätzen und Stückpreisen. */
export interface PriceData {
  /** Fertigungspreis je Kilogramm nach Werkstoff; 'default' für alle übrigen. */
  ratePerKg: Record<string, number>;
  parts: {
    wheel: { referenceDiameterMm: number; exponent: number };
    drum: { referenceRadiusMm: number };
    list: PartPrice[];
  };
  wiring: Record<TrailerConfig['lighting'], number>;
  brakeLines: Record<TrailerConfig['brake'], number>;
  /** Verbindungsmittel und Kleinteile als Anteil an Material und Fertigung. */
  smallPartsShare: number;
  /** Strahlen, Grundieren und Decklack je Kilogramm lackierter Stahlbau. */
  paintPerKg: number;
  assembly: { baseHours: number; hoursPerPiece: number; ratePerHour: number };
  engineering: { base: number; specialBody: number; roof: number; specialSteering: number };
  /** Gemeinkosten, Wagnis und Gewinn als Aufschlag auf die Selbstkosten. */
  overheadShare: number;
  vatShare: number;
  /** Unsicherheit der Schätzung nach oben und unten. */
  spread: number;
}

/** Stückpreis eines Zukaufteils und seine Bezugsgröße. */
export interface PartPrice {
  /** Anfang der Benennung des Bauteils. */
  name: string;
  eur: number;
  per?: 'piece' | 'm2' | 'wheel' | 'drum' | 'slewRing';
  /** Nur slewRing: Betrag je Meter Durchmesser und Preis, falls der Durchmesser fehlt. */
  eurPerMeter?: number;
  fallbackEur?: number;
}

export const PRICES = PRICE_DATA as unknown as PriceData;

/** Fläche einer Platte oder Plane in m²: die beiden größten Kanten. */
const area = (p: Part) => {
  if (p.kind !== 'box') return 0;
  const [a, b] = [...p.size].sort((m, n) => n - m);
  return a * b;
};

/** Preis eines Zukaufteils nach seiner Bezugsgröße. */
function listedPriceEur(entry: PartPrice, p: Part): number {
  switch (entry.per) {
    case 'wheel': {
      const scale = p.kind === 'wheel' ? (p.radius * 2) / (PRICES.parts.wheel.referenceDiameterMm / 1000) : 1;
      return entry.eur * scale ** PRICES.parts.wheel.exponent;
    }
    case 'drum':
      return p.kind === 'cylinder' ? entry.eur * (p.radius / (PRICES.parts.drum.referenceRadiusMm / 1000)) : entry.eur;
    case 'slewRing':
      return p.kind === 'cylinder' ? entry.eur + (entry.eurPerMeter ?? 0) * p.radius * 2 : (entry.fallbackEur ?? entry.eur);
    case 'm2':
      return entry.eur * area(p);
    default:
      return entry.eur;
  }
}

/** Geschätzter Preis eines einzelnen Bauteils. */
export function partPriceEur(p: Part): number {
  const listed = PRICES.parts.list.find((entry) => p.name.startsWith(entry.name));
  if (listed) return listedPriceEur(listed, p);
  return partMassKg(p) * (PRICES.ratePerKg[p.material] ?? PRICES.ratePerKg.default);
}

export interface QuoteLine {
  /** Leistung; wird erst bei der Anzeige übersetzt. */
  label: Msg;
  /** Erläuterung, z. B. Stückzahl oder Stunden. */
  detail?: Msg;
  eur: number;
}

export interface Quote {
  /** Material und Fertigung je Baugruppe, dann Leitungen, Lackierung, Montage, Konstruktion. */
  lines: QuoteLine[];
  /** Summe der Positionen: Selbstkosten. */
  costEur: number;
  overheadEur: number;
  netEur: number;
  vatEur: number;
  grossEur: number;
  /** Spanne der Schätzung, netto. */
  lowEur: number;
  highEur: number;
}

const round = (v: number, step = 1) => Math.round(v / step) * step;

export function estimateQuote(config: TrailerConfig, parts: Part[]): Quote {
  const counted = parts.filter((p) => !p.detail);
  const lines: QuoteLine[] = [];

  const byGroup = new Map<Group, { eur: number; pieces: number }>();
  for (const p of counted) {
    const entry = byGroup.get(p.group) ?? { eur: 0, pieces: 0 };
    entry.eur += partPriceEur(p);
    entry.pieces += 1;
    byGroup.set(p.group, entry);
  }
  let material = 0;
  for (const group of GROUPS) {
    const entry = byGroup.get(group);
    if (!entry) continue;
    material += entry.eur;
    lines.push({ label: msg(group), detail: msg('{pieces} Teile, Material und Fertigung', { pieces: entry.pieces }), eur: round(entry.eur) });
  }

  const extras = PRICES.wiring[config.lighting] + PRICES.brakeLines[config.brake] + material * PRICES.smallPartsShare;
  lines.push({ label: msg('Leitungen und Kleinteile'), detail: msg('Elektrik, Bremsleitungen, Verbindungsmittel'), eur: round(extras) });

  const paintedKg = counted.filter((p) => p.look === 'paint').reduce((sum, p) => sum + partMassKg(p), 0);
  const color = config.colorId.replace('ral', 'RAL ');
  lines.push({ label: msg('Lackierung'), detail: msg('Strahlen, Grundierung, Decklack {color}', { color: { raw: color } }), eur: round(paintedKg * PRICES.paintPerKg) });

  const hours = round(PRICES.assembly.baseHours + PRICES.assembly.hoursPerPiece * counted.length, 0.5);
  lines.push({ label: msg('Montage und Endprüfung'), detail: msg('{hours} Stunden', { hours }), eur: round(hours * PRICES.assembly.ratePerHour) });

  const manufacturing = lines.reduce((sum, l) => sum + l.eur, 0);
  const engineeringShare =
    PRICES.engineering.base +
    (config.body !== 'platform' ? PRICES.engineering.specialBody : 0) +
    (config.roof !== 'none' ? PRICES.engineering.roof : 0) +
    (config.steering !== 'turntable' ? PRICES.engineering.specialSteering : 0);
  lines.push({
    label: msg('Konstruktion und Auftragsabwicklung'),
    detail: msg('{share} % der Herstellkosten', { share: Math.round(engineeringShare * 1000) / 10 }),
    eur: round(manufacturing * engineeringShare),
  });

  const costEur = lines.reduce((sum, l) => sum + l.eur, 0);
  // Der Nettopreis wird auf volle 10 Euro gerundet; der Aufschlag ergibt sich daraus.
  const netEur = round(costEur * (1 + PRICES.overheadShare), 10);
  const vatEur = round(netEur * PRICES.vatShare);
  return {
    lines,
    costEur,
    overheadEur: netEur - costEur,
    netEur,
    vatEur,
    grossEur: netEur + vatEur,
    lowEur: round(netEur * (1 - PRICES.spread), 100),
    highEur: round(netEur * (1 + PRICES.spread), 100),
  };
}

/** Die Preisaufstellung als CSV für Excel (Semikolon, Dezimalkomma). */
export function quoteToCsv(quote: Quote, L: Locale = locale('de')): string {
  const { t } = L;
  const num = (v: number) => v.toFixed(2).replace('.', ',');
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows: [string, string, string][] = [
    [t('Position'), t('Erläuterung'), t('Betrag (EUR)')],
    ...quote.lines.map((l): [string, string, string] => [L.m(l.label), l.detail ? L.m(l.detail) : '', num(l.eur)]),
    [t('Gemeinkosten, Wagnis und Gewinn'), '', num(quote.overheadEur)],
    [t('Nettopreis (Schätzung)'), '', num(quote.netEur)],
    [t('Mehrwertsteuer 19 %'), '', num(quote.vatEur)],
    [t('Bruttopreis (Schätzung)'), '', num(quote.grossEur)],
  ];
  return rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
