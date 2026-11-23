/** Alle Angaben der Konfiguration als lesbare Liste, für Anzeige und Export. */
import { locale, msg, type Locale, type Msg } from '../i18n';
import { performance, type Performance } from './advice';
import { COLORS, optionName, type Derived, type TrailerConfig } from './config';
import { PARAMS, formatValue, isRelevant, labelOf, type ParamKey } from './params';
import type { TrailerParts } from './parts';

export interface SummarySection {
  /** Kennung des Abschnitts, unabhängig von der Sprache. */
  id: 'basics' | 'body' | 'use' | 'load' | 'running' | 'deck' | 'drawbar' | 'equipment' | 'tow' | 'figures' | 'notes';
  title: string;
  items: [label: string, value: string][];
}

/** Was eine berechnete Angabe zur Verfügung hat. */
interface Context {
  c: TrailerConfig;
  d: Derived;
  L: Locale;
  description: Pick<TrailerParts, 'bed' | 'height'>;
  tareKg: number;
  pieceCount: number;
  perf: Performance;
}

/** Angabe, die mehrere Parameter zusammenfasst oder aus der Auslegung stammt. */
interface Computed {
  label: Msg | ((c: TrailerConfig) => Msg);
  /** Parameter, die in dieser Angabe aufgehen. */
  covers?: ParamKey[];
  when?: (ctx: Context) => boolean;
  value: (ctx: Context) => string;
}

interface SectionLayout {
  id: SummarySection['id'];
  title: Msg;
  when?: (c: TrailerConfig) => boolean;
  items: (ParamKey | Computed)[];
}

const approx = (L: Locale, value: string) => L.t('ca. {value}', { value: { raw: value } });
/** Meter aus dem Modell als gerundete Länge in Millimetern. */
const metres = (L: Locale, value: number) => L.mm(Math.round(value * 100) * 10);

/**
 * Gliederung der Zusammenfassung. Einzelne Parameter erscheinen mit der
 * Beschriftung und unter der Bedingung aus der Parameterliste; hier stehen nur
 * die Reihenfolge und die Angaben, die mehrere Werte zusammenfassen.
 */
export const SUMMARY_LAYOUT: SectionLayout[] = [
  {
    id: 'basics',
    title: msg('Grunddaten'),
    items: [
      'payloadT',
      {
        label: (c) => (c.body === 'longload' ? msg('Eingestellte Länge × Breite') : msg('Ladefläche (L × B)')),
        covers: ['lengthMm', 'widthMm'],
        value: ({ c, L }) => `${L.mm(c.lengthMm)} × ${L.mm(c.widthMm)}`,
      },
      'deckHeightMm',
      { label: msg('Achsen'), covers: ['axles'], value: ({ c, d, L }) => `${c.axles} × ${L.t(d.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse')}` },
    ],
  },
  {
    id: 'body',
    title: msg('Bauform'),
    items: [
      'body',
      'bedHeightMm',
      'rearWheels',
      'ramp',
      {
        label: msg('Tiefbett (L × B)'),
        when: ({ c, description }) => c.body === 'lowbed' && !!description.bed,
        value: ({ L, description }) => `${metres(L, description.bed!.length)} × ${metres(L, description.bed!.width)}`,
      },
      'minLengthMm',
      'maxLengthMm',
      'rasterMm',
      'roof',
      'roofShape',
      'roofClearMm',
      'roofSides',
    ],
  },
  { id: 'use', title: msg('Einsatz'), items: ['speedKmh', 'site', 'publicRoads', 'ground', 'slopePct', 'obstacleMm', 'aisleWidthMm', 'curveRadiusMm', 'hoursLoadedPerDay', 'distanceKmPerDay'] },
  {
    id: 'load',
    title: msg('Last'),
    items: [
      'loadType',
      'loadNote',
      {
        label: msg('Abmessungen der Last (L × B × H)'),
        covers: ['loadLengthMm', 'loadWidthMm', 'loadHeightMm'],
        when: ({ c }) => c.loadType !== 'custom',
        value: ({ c, L }) => `${L.mm(c.loadLengthMm)} × ${L.mm(c.loadWidthMm)} × ${L.mm(c.loadHeightMm)}`,
      },
    ],
  },
  {
    id: 'running',
    title: msg('Fahrwerk'),
    items: [
      'steering',
      { label: msg('Bereifung'), covers: ['tyre', 'nonMarking'], value: ({ c, L }) => `${L.t(optionName('tyre', c.tyre))}${c.nonMarking ? L.t(', spurfrei') : ''}` },
      { label: msg('Räder'), value: ({ d, L }) => `${d.wheelCount} × Ø ${L.mm(d.wheelDiameterMm)}` },
      'suspension',
      'brake',
      'parkingBrake',
    ],
  },
  { id: 'deck', title: msg('Ladefläche'), items: ['deck', 'edgeProtection', 'wallType', 'wallMaterial', 'wallHeightMm', 'lashingRings'] },
  { id: 'drawbar', title: msg('Deichsel und Kupplung'), items: ['towEye', 'drawbarSpring', 'rearCoupling'] },
  { id: 'equipment', title: msg('Ausstattung'), items: ['lighting', 'chocks', 'colorId'] },
  { id: 'tow', title: msg('Zugfahrzeug'), items: ['towWeightKg', 'couplingHeightMm', 'towForceN', 'trailersInTrain'] },
  {
    id: 'figures',
    title: msg('Kennwerte (Schätzung)'),
    items: [
      { label: msg('Eigengewicht'), value: ({ L, tareKg }) => approx(L, L.kg(tareKg)) },
      { label: msg('Gesamtgewicht'), value: ({ L, perf }) => approx(L, L.kg(perf.grossKg)) },
      { label: msg('Radlast'), value: ({ L, perf }) => approx(L, L.kg(perf.wheelLoadKg)) },
      { label: msg('Zugkraftbedarf'), value: ({ L, perf }) => approx(L, `${L.nf(perf.pullN)} N`) },
      { label: msg('Rahmenhöhe'), value: ({ d, L }) => L.mm(d.frameHeightMm) },
      { label: msg('Gesamthöhe'), value: ({ L, description }) => metres(L, description.height) },
      { label: msg('Einzelteile'), value: ({ L, pieceCount }) => L.nf(pieceCount) },
    ],
  },
  { id: 'notes', title: msg('Anmerkungen'), when: (c) => !!c.notes.trim(), items: ['notes'] },
];

export function describeConfig(
  c: TrailerConfig,
  d: Derived,
  description: Pick<TrailerParts, 'bed' | 'height'>,
  tareKg: number,
  pieceCount: number,
  L: Locale = locale('de'),
): SummarySection[] {
  const ctx: Context = { c, d, L, description, tareKg, pieceCount, perf: performance(c, d, tareKg) };
  const sections: SummarySection[] = [];
  for (const section of SUMMARY_LAYOUT) {
    if (section.when && !section.when(c)) continue;
    const items: SummarySection['items'] = [];
    for (const item of section.items) {
      if (typeof item === 'string') {
        if (isRelevant(item, c)) items.push([L.m(PARAMS[item].shortLabel ?? labelOf(item, c)), formatValue(item, c, L)]);
      } else if (!item.when || item.when(ctx)) {
        items.push([L.m(typeof item.label === 'function' ? item.label(c) : item.label), item.value(ctx)]);
      }
    }
    sections.push({ id: section.id, title: L.m(section.title), items });
  }
  return sections;
}

/** Kurzbeschreibung der Konfiguration in ganzen Sätzen, für das Angebot. */
export function describeProse(c: TrailerConfig, d: Derived, L: Locale = locale('de')): string {
  const { t, mm } = L;
  const color = COLORS.find((x) => x.id === c.colorId) ?? COLORS[0];
  const type = { platform: 'Schwerlast-Plattformanhänger', lowbed: 'Schwerlast-Tiefladeanhänger', longload: 'Schwerlast-Langmaterialanhänger' }[c.body];
  const sentences = [t('{type} mit Zugdeichsel für {payload} t Nutzlast.', { type, payload: c.payloadT })];

  if (c.body === 'longload') {
    sentences.push(
      t('Zwei Fahrgestellmodule mit Rungenschemeln, verbunden durch ein Langrohr, ausziehbar von {min} bis {max} im Raster von {raster}; Breite {width}, Auflagehöhe {height}.', {
        min: { raw: mm(c.minLengthMm) },
        max: { raw: mm(c.maxLengthMm) },
        raster: { raw: mm(c.rasterMm) },
        width: { raw: mm(c.widthMm) },
        height: { raw: mm(c.deckHeightMm + 140) },
      }),
    );
  } else if (c.body === 'lowbed') {
    sentences.push(
      t('Gesamtlänge {length}, Breite {width}, Ladehöhe im Tiefbett {bed}, Hinterräder: {wheels}, Auffahrklappe: {ramp}.', {
        length: { raw: mm(c.lengthMm) },
        width: { raw: mm(c.widthMm) },
        bed: { raw: mm(c.bedHeightMm) },
        wheels: optionName('rearWheels', c.rearWheels),
        ramp: optionName('ramp', c.ramp),
      }),
    );
  } else {
    sentences.push(t('Ladefläche {length} × {width}, Ladehöhe {height}.', { length: { raw: mm(c.lengthMm) }, width: { raw: mm(c.widthMm) }, height: { raw: mm(c.deckHeightMm) } }));
  }

  // Aufzählungen aus einzelnen Angaben, damit sie sich in jeder Sprache sauber fügen.
  const list = (items: string[]) => `${items.filter(Boolean).join('; ')}.`;
  sentences.push(
    list([
      t('Belag: {deck}', { deck: optionName('deck', c.deck) }),
      c.edgeProtection !== 'none' ? t('Kantenschutz: {edge}', { edge: optionName('edgeProtection', c.edgeProtection) }) : '',
      c.wallType !== 'none'
        ? t('Bordwände: {type}, {material}, {height}', { type: optionName('wallType', c.wallType), material: optionName('wallMaterial', c.wallMaterial), height: { raw: mm(c.wallHeightMm) } })
        : '',
      c.roof !== 'none'
        ? t('Dachaufbau: {cover}, {shape}, lichte Höhe {clear}', { cover: optionName('roof', c.roof), shape: optionName('roofShape', c.roofShape), clear: { raw: mm(c.roofClearMm) } })
        : '',
      c.lashingRings && c.body !== 'longload' ? t('Verzurrösen') : '',
    ]),
  );

  sentences.push(
    list([
      t('Fahrwerk: {axles} × {axle}, {wheels} Räder {tyre} Ø {diameter}', {
        axles: c.axles,
        axle: d.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse',
        wheels: d.wheelCount,
        tyre: { raw: `${t(optionName('tyre', c.tyre))}${c.nonMarking ? t(', spurfrei') : ''}` },
        diameter: { raw: mm(d.wheelDiameterMm) },
      }),
      t('Lenkung: {steering}', { steering: optionName('steering', c.steering) }),
      t('Federung: {suspension}', { suspension: optionName('suspension', c.suspension) }),
      t('Bremse: {brake}', { brake: optionName('brake', c.brake) }),
      c.parkingBrake ? t('Feststellbremse') : '',
    ]),
  );

  sentences.push(
    list([
      t(optionName('towEye', c.towEye)),
      c.drawbarSpring ? t('Gefederte Höheneinstellung') : '',
      c.rearCoupling !== 'none' ? t('Kupplung hinten: {coupling}', { coupling: optionName('rearCoupling', c.rearCoupling) }) : '',
      c.lighting !== 'none' ? t('Beleuchtung: {lighting}', { lighting: optionName('lighting', c.lighting) }) : '',
      c.chocks !== 'none' ? t('Unterlegkeile: {chocks}', { chocks: optionName('chocks', c.chocks) }) : '',
      t('Lackierung: {ral} {color}', { ral: { raw: color.ral }, color: color.name }),
    ]),
  );
  return sentences.join(' ');
}

/** Zusammenfassung als CSV für Excel (Semikolon). */
export function summaryToCsv(sections: SummarySection[], L: Locale = locale('de')): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [[L.t('Abschnitt'), L.t('Angabe'), L.t('Wert')]];
  for (const s of sections) for (const [label, value] of s.items) lines.push([s.title, label, value]);
  return lines.map((line) => line.map(cell).join(';')).join('\r\n');
}
