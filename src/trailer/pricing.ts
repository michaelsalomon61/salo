/**
 * Preismodell auf Schätzbasis.
 *
 * Alle Sätze und Stückpreise in dieser Datei sind Annahmen, keine Marktpreise.
 * Sie sind bewusst an einer Stelle gesammelt, damit sie sich durch echte
 * Kalkulationswerte ersetzen lassen. Beträge in Euro ohne Mehrwertsteuer.
 */
import { locale, msg, type Locale, type Msg } from '../i18n';
import type { TrailerConfig } from './config';
import { GROUPS, partMassKg, type Group, type Part } from './parts';

/** Fertigungspreis je Kilogramm nach Werkstoff: Material, Zuschnitt, Schweißen. */
const RATE_PER_KG: Record<string, number> = {
  'Stahl S355': 4.2,
  Hartholz: 2.2,
  Kiefer: 1.4,
  'Birke, phenolharzbeschichtet': 2.6,
  'Gummi, gerippt': 3.2,
  'Aluminium-Hohlkammerprofil': 11,
  Aluminium: 11,
};
/** Für Werkstoffe ohne eigenen Satz. */
const DEFAULT_RATE_PER_KG = 6;

/** Fläche einer Platte oder Plane in m²: die beiden größten Kanten. */
const area = (p: Part) => {
  if (p.kind !== 'box') return 0;
  const [a, b] = [...p.size].sort((m, n) => n - m);
  return a * b;
};
/** Raddurchmesser im Verhältnis zu 500 mm. */
const wheelScale = (p: Part) => (p.kind === 'wheel' ? (p.radius * 2) / 0.5 : 1);

/**
 * Stückpreise für Zukaufteile. Der erste Eintrag, mit dessen Namen die
 * Benennung des Bauteils beginnt, gilt. Alles andere wird nach Gewicht gerechnet.
 */
const PART_PRICES: [name: string, price: number | ((p: Part) => number)][] = [
  ['Rad Vollgummi', (p) => 780 * wheelScale(p) ** 1.7],
  ['Rad Super-Elastic', (p) => 900 * wheelScale(p) ** 1.7],
  ['Rad Luft', (p) => 420 * wheelScale(p) ** 1.7],
  ['Rad Polyurethan', (p) => 1250 * wheelScale(p) ** 1.7],
  ['Kugeldrehkranz', (p) => (p.kind === 'cylinder' ? 450 + 600 * p.radius * 2 : 1100)],
  ['Lenkdrehkranz', 420],
  ['Achsschenkel', 180],
  ['Spurstange', 160],
  ['Lenkschubstange', 190],
  ['Koppelstange', 240],
  ['Trommelbremse', (p) => (p.kind === 'cylinder' ? 480 * (p.radius / 0.105) : 480)],
  ['Elektromagnetbremse', (p) => (p.kind === 'cylinder' ? 650 * (p.radius / 0.105) : 650)],
  ['Membranbremszylinder', 95],
  ['Radbremszylinder', 60],
  ['Gummifederelement', 85],
  ['Blattfederpaket', 240],
  ['Luftfederbalg', 310],
  ['Bordwand Drahtgitter', (p) => 55 * area(p)],
  ['Scharnier', 9],
  ['Bordwandverschluss', 18],
  ['Dachplane', (p) => 28 * area(p)],
  ['Dachblech', (p) => 42 * area(p)],
  ['Seitenplane', (p) => 28 * area(p)],
  ['Stirnplane', (p) => 28 * area(p)],
  ['Vorhangplane', (p) => 45 * area(p)],
  ['Schutzgitter', (p) => 55 * area(p)],
  ['Deichselfeder', 190],
  ['Auflaufeinrichtung', 420],
  ['Druckluftbehälter', 180],
  ['Kupplungskopf', 28],
  ['Hydraulikanschluss', 35],
  ['Anschlussdose', 30],
  ['Feststellbremse', 260],
  ['Steckbolzenkupplung', 140],
  ['Automatische Anhängerkupplung', 620],
  ['Zurröse', 14],
  ['Mehrkammer-Rückleuchte', 75],
  ['Rückleuchte', 35],
  ['Begrenzungsleuchte', 18],
  ['Seitenmarkierungsleuchte', 14],
  ['Kennzeichenhalter', 12],
  ['Unterlegkeil doppelt', 34],
  ['Unterlegkeil einfach', 22],
  ['Keilhalter', 16],
  ['Klappenscharnier', 24],
];

/** Pauschalen für Leitungen und Kleinteile, die nicht als Bauteile modelliert sind. */
const WIRING = { internal: 180, stvzo: 420, none: 0 } as const;
const BRAKE_LINES = { none: 0, overrun: 120, air: 350, hydraulic: 220, electric: 160 } as const;
/** Verbindungsmittel und Kleinteile als Anteil an Material und Fertigung. */
const SMALL_PARTS_SHARE = 0.02;

/** Strahlen, Grundieren und Decklack je Kilogramm lackierter Stahlbau. */
const PAINT_PER_KG = 0.45;
/** Montage und Endprüfung: Grundzeit plus Zeit je Einzelteil, zum Stundensatz. */
const ASSEMBLY = { baseHours: 8, hoursPerPiece: 0.1, ratePerHour: 78 };
/** Konstruktion und Auftragsabwicklung als Anteil der Herstellkosten. */
const ENGINEERING = { base: 0.05, specialBody: 0.03, roof: 0.015, specialSteering: 0.02 };
/** Gemeinkosten, Wagnis und Gewinn als Aufschlag auf die Selbstkosten. */
const OVERHEAD_SHARE = 0.2;
const VAT_SHARE = 0.19;
/** Unsicherheit der Schätzung nach oben und unten. */
const SPREAD = 0.15;

/** Geschätzter Preis eines einzelnen Bauteils. */
export function partPriceEur(p: Part): number {
  const listed = PART_PRICES.find(([name]) => p.name.startsWith(name));
  if (listed) return typeof listed[1] === 'number' ? listed[1] : listed[1](p);
  return partMassKg(p) * (RATE_PER_KG[p.material] ?? DEFAULT_RATE_PER_KG);
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

  const extras = WIRING[config.lighting] + BRAKE_LINES[config.brake] + material * SMALL_PARTS_SHARE;
  lines.push({ label: msg('Leitungen und Kleinteile'), detail: msg('Elektrik, Bremsleitungen, Verbindungsmittel'), eur: round(extras) });

  const paintedKg = counted.filter((p) => p.look === 'paint').reduce((sum, p) => sum + partMassKg(p), 0);
  const color = config.colorId.replace('ral', 'RAL ');
  lines.push({ label: msg('Lackierung'), detail: msg('Strahlen, Grundierung, Decklack {color}', { color: { raw: color } }), eur: round(paintedKg * PAINT_PER_KG) });

  const hours = round(ASSEMBLY.baseHours + ASSEMBLY.hoursPerPiece * counted.length, 0.5);
  lines.push({ label: msg('Montage und Endprüfung'), detail: msg('{hours} Stunden', { hours }), eur: round(hours * ASSEMBLY.ratePerHour) });

  const manufacturing = lines.reduce((sum, l) => sum + l.eur, 0);
  const engineeringShare =
    ENGINEERING.base +
    (config.body !== 'platform' ? ENGINEERING.specialBody : 0) +
    (config.roof !== 'none' ? ENGINEERING.roof : 0) +
    (config.steering !== 'turntable' ? ENGINEERING.specialSteering : 0);
  lines.push({
    label: msg('Konstruktion und Auftragsabwicklung'),
    detail: msg('{share} % der Herstellkosten', { share: Math.round(engineeringShare * 1000) / 10 }),
    eur: round(manufacturing * engineeringShare),
  });

  const costEur = lines.reduce((sum, l) => sum + l.eur, 0);
  // Der Nettopreis wird auf volle 10 Euro gerundet; der Aufschlag ergibt sich daraus.
  const netEur = round(costEur * (1 + OVERHEAD_SHARE), 10);
  const vatEur = round(netEur * VAT_SHARE);
  return {
    lines,
    costEur,
    overheadEur: netEur - costEur,
    netEur,
    vatEur,
    grossEur: netEur + vatEur,
    lowEur: round(netEur * (1 - SPREAD), 100),
    highEur: round(netEur * (1 + SPREAD), 100),
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
