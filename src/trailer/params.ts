/**
 * Die Parameter des Konfigurators, je einmal beschrieben: Beschriftung, Art des
 * Bedienelements, Einheit, Einstellbereich und die Bedingung, unter der ein
 * Parameter eine Rolle spielt. Bedienung und Zusammenfassung entstehen aus
 * dieser Liste und zeigen deshalb dieselben Angaben unter denselben Bedingungen.
 *
 * Ein neuer Parameter braucht: den Eintrag in TrailerConfig mit Ausgangswert
 * (config.ts), einen Eintrag hier samt Platz in PANEL_LAYOUT und
 * SUMMARY_LAYOUT (summary.ts), die Übersetzungen und seine Wirkung im Modell.
 */
import { msg, type Locale, type Msg } from '../i18n';
import { COLORS, LIMITS, OPTIONS, hasBoardDeck, optionName, type Derived, type TrailerConfig } from './config';

export type ParamKey = keyof TrailerConfig;
type Text = Msg | ((c: TrailerConfig) => Msg);

interface Common {
  /** Kennung des Bedienelements auf der Seite. */
  id: string;
  label: Text;
  /** Kürzere Beschriftung für Zusammenfassung und Angebot, wo sie abweicht. */
  shortLabel?: Msg;
  /** Bedingung, unter der der Parameter eine Rolle spielt; ohne Angabe immer. */
  when?: (c: TrailerConfig) => boolean;
  /** Betrifft nur die Darstellung des Modells und liegt deshalb an der 3D-Ansicht. */
  view?: true;
}

export interface SliderParam extends Common {
  control: 'slider';
  unit: 'mm' | 't' | 'km/h' | '%' | '°' | '';
  /** Einstellbereich aus den Stammdaten; ohne Angabe der Eintrag mit dem Namen des Parameters. */
  limit?: keyof typeof LIMITS;
  /** Abweichungen vom Einstellbereich, die von der Konfiguration abhängen. */
  range?: (c: TrailerConfig, d: Derived) => { min?: number; max?: number; step?: number };
  /** Unterdrückt den Hinweis des Regelwerks am Feld. */
  quiet?: (c: TrailerConfig) => boolean;
}

export interface ChoiceParam extends Common {
  control: 'segmented' | 'chips' | 'cards';
  /** Feste Zahlenwerte statt einer Auswahlliste aus OPTIONS. */
  numbers?: readonly number[];
  disabled?: (id: string | number, c: TrailerConfig, d: Derived) => boolean;
  /** Karten: ein Stichwort je Option. */
  hints?: Record<string, Msg>;
}

export interface SwitchParam extends Common {
  control: 'switch';
}

export interface NumberParam extends Common {
  control: 'number';
  unit: string;
  step: number;
  max?: number;
}

export interface TextParam extends Common {
  control: 'text';
  placeholder?: Msg;
}

export interface ColorParam extends Common {
  control: 'color';
}

export type Param = SliderParam | ChoiceParam | SwitchParam | NumberParam | TextParam | ColorParam;

const platform = (c: TrailerConfig) => c.body === 'platform';
const lowbed = (c: TrailerConfig) => c.body === 'lowbed';
const longload = (c: TrailerConfig) => c.body === 'longload';
const boxLoad = (c: TrailerConfig) => c.loadType !== 'custom';
const roofed = (c: TrailerConfig) => platform(c) && c.roof !== 'none';
const walled = (c: TrailerConfig) => c.wallType !== 'none';

export const PARAMS: Record<ParamKey, Param> = {
  // Aufgabe
  payloadT: { id: 'payload', control: 'slider', unit: 't', label: msg('Nutzlast') },
  loadType: { id: 'load-type', control: 'segmented', label: msg('Lastart') },
  loadNote: { id: 'load-note', control: 'text', label: msg('Beschreibung der Last'), shortLabel: msg('Beschreibung'), placeholder: msg('z. B. vier Auflagepunkte, Schwerpunkt außermittig'), when: (c) => !boxLoad(c) },
  loadLengthMm: { id: 'load-length', control: 'slider', unit: 'mm', label: msg('Länge der Last'), when: boxLoad, range: (c) => ({ max: c.lengthMm }) },
  loadWidthMm: { id: 'load-width', control: 'slider', unit: 'mm', label: msg('Breite der Last'), when: boxLoad, range: (c) => ({ max: c.widthMm }) },
  loadHeightMm: { id: 'load-height', control: 'slider', unit: 'mm', label: msg('Höhe der Last'), when: boxLoad },
  showLoad: { id: 'show-load', control: 'switch', label: msg('Ladung'), view: true },
  site: { id: 'site', control: 'segmented', label: msg('Einsatzort') },
  ground: { id: 'ground', control: 'chips', label: msg('Untergrund') },
  speedKmh: { id: 'speed', control: 'slider', unit: 'km/h', label: msg('Geschwindigkeit') },
  slopePct: { id: 'slope', control: 'slider', unit: '%', label: msg('Größte Steigung') },
  publicRoads: { id: 'public-roads', control: 'switch', label: msg('Öffentliche Verkehrswege (StVZO)') },
  obstacleMm: { id: 'obstacle', control: 'slider', unit: 'mm', label: msg('Höhe des größten Hindernisses') },
  aisleWidthMm: { id: 'aisle', control: 'number', unit: 'mm', step: 50, label: msg('Gangbreite') },
  curveRadiusMm: { id: 'curve', control: 'number', unit: 'mm', step: 50, label: msg('Kurvenradius') },
  hoursLoadedPerDay: { id: 'hours', control: 'number', unit: 'h', step: 0.5, max: 24, label: msg('Stunden mit Last pro Tag') },
  distanceKmPerDay: { id: 'distance', control: 'number', unit: 'km', step: 0.5, label: msg('Wegstrecke pro Tag') },
  towWeightKg: { id: 'tow-weight', control: 'number', unit: 'kg', step: 50, label: msg('Gesamtgewicht') },
  couplingHeightMm: { id: 'coupling-height', control: 'number', unit: 'mm', step: 10, max: 1500, label: msg('Kupplungshöhe') },
  towForceN: { id: 'tow-force', control: 'number', unit: 'N', step: 100, label: msg('Zugkraft am Haken') },
  trailersInTrain: { id: 'train', control: 'slider', unit: '', label: msg('Anhänger im Zug') },
  notes: { id: 'notes', control: 'text', label: msg('Sonstige Anforderungen und Wünsche'), shortLabel: msg('Text') },

  // Fahrzeug
  body: {
    id: 'body',
    control: 'cards',
    label: msg('Bauform'),
    hints: { platform: msg('durchgehend'), lowbed: msg('mit Tiefbett'), longload: msg('ausziehbar') },
  },
  lengthMm: {
    id: 'length',
    control: 'slider',
    unit: 'mm',
    label: (c) => (longload(c) ? msg('Eingestellte Länge') : msg('Länge')),
    // Beim Langmaterial bewegt sich die Länge zwischen Mindest- und Maximallänge im Raster.
    range: (c, d) => (longload(c) ? { min: c.minLengthMm, max: c.maxLengthMm, step: c.rasterMm } : { min: d.minLengthMm }),
    quiet: longload,
  },
  widthMm: { id: 'width', control: 'slider', unit: 'mm', label: msg('Breite'), range: (_, d) => ({ min: d.minWidthMm }) },
  deckHeightMm: {
    id: 'deck-height',
    control: 'slider',
    unit: 'mm',
    label: (c) => (lowbed(c) ? msg('Höhe über den Achsen') : msg('Ladehöhe')),
    range: (_, d) => ({ min: d.minDeckHeightMm }),
  },
  axles: { id: 'axles', control: 'segmented', label: msg('Achsen'), numbers: [2, 3, 4], disabled: (id, _, d) => Number(id) < d.minAxles },
  bedHeightMm: { id: 'bed-height', control: 'slider', unit: 'mm', label: msg('Ladehöhe Tiefbett'), when: lowbed, range: (c) => ({ max: Math.min(LIMITS.bedHeightMm.max, c.deckHeightMm - 200) }) },
  rearWheels: { id: 'rear-wheels', control: 'segmented', label: msg('Hinterräder'), when: lowbed },
  ramp: { id: 'ramp', control: 'segmented', label: msg('Auffahrklappe'), when: lowbed, disabled: (id, c) => id === 'rear' && c.rearWheels === 'inside' },
  minLengthMm: { id: 'min-length', control: 'slider', unit: 'mm', label: msg('Mindestlänge'), when: longload, limit: 'lengthMm', range: () => ({ step: 100 }) },
  maxLengthMm: { id: 'max-length', control: 'slider', unit: 'mm', label: msg('Maximallänge'), when: longload, limit: 'lengthMm', range: () => ({ step: 100 }) },
  rasterMm: { id: 'raster', control: 'segmented', label: msg('Längenrasterung'), when: longload },
  roof: { id: 'roof', control: 'segmented', label: msg('Dachaufbau'), when: platform },
  roofShape: { id: 'roof-shape', control: 'segmented', label: msg('Dachform'), when: roofed },
  roofClearMm: { id: 'roof-clear', control: 'slider', unit: 'mm', label: msg('Lichte Höhe'), when: roofed },
  roofSides: { id: 'roof-sides', control: 'chips', label: msg('Seiten'), when: roofed },

  // Fahrwerk
  steering: { id: 'steering-type', control: 'chips', label: msg('Lenkung') },
  tyre: { id: 'tyre', control: 'chips', label: msg('Bereifung') },
  nonMarking: { id: 'non-marking', control: 'switch', label: msg('Spurfreie Bereifung') },
  suspension: { id: 'suspension', control: 'chips', label: msg('Federung') },
  brake: { id: 'brake', control: 'chips', label: msg('Betriebsbremse'), shortLabel: msg('Bremse') },
  parkingBrake: { id: 'parking-brake', control: 'switch', label: msg('Feststellbremse') },

  // Aufbau
  deck: { id: 'deck', control: 'chips', label: msg('Belag') },
  edgeProtection: { id: 'edge', control: 'segmented', label: msg('Kantenschutz'), when: (c) => hasBoardDeck(c.deck) && platform(c) },
  wallType: { id: 'wall-type', control: 'segmented', label: msg('Bordwände'), when: platform },
  wallMaterial: { id: 'wall-material', control: 'segmented', label: msg('Material der Bordwände'), when: walled },
  wallHeightMm: { id: 'wall-height', control: 'segmented', label: msg('Höhe der Bordwände'), when: walled },
  lashingRings: { id: 'lashing', control: 'switch', label: msg('Verzurrösen zur Ladungssicherung'), shortLabel: msg('Verzurrösen'), when: (c) => !longload(c) },
  colorId: { id: 'color', control: 'color', label: msg('Lackierung') },
  towEye: { id: 'tow-eye', control: 'segmented', label: msg('Zugöse') },
  drawbarSpring: { id: 'drawbar-spring', control: 'switch', label: msg('Gefederte Höheneinstellung') },
  rearCoupling: { id: 'rear-coupling', control: 'chips', label: msg('Kupplung hinten') },
  lighting: { id: 'lighting', control: 'segmented', label: msg('Beleuchtung') },
  chocks: { id: 'chocks', control: 'chips', label: msg('Unterlegkeile') },

  // Stellung des Modells
  steeringDeg: { id: 'steering', control: 'slider', unit: '°', label: msg('Lenkung'), view: true },
  drawbarUp: { id: 'drawbar-up', control: 'switch', label: msg('Deichsel hoch'), view: true },
};

/** Gruppe seltener gebrauchter Einstellungen, die sich aufklappen lässt. */
export interface MoreGroup {
  title: Msg;
  /** Stichworte zum Inhalt oder der aktuelle Stand. */
  hint: Text;
  items: (ParamKey | { grid: ParamKey[] })[];
}

export type LayoutItem = ParamKey | { subhead: Msg } | { grid: ParamKey[] } | { more: MoreGroup };
export type PanelStep = 'task' | 'vehicle' | 'running' | 'body';

/** Reihenfolge und Gliederung der Parameter in den Schritten der Bedienung. */
export const PANEL_LAYOUT: Record<PanelStep, LayoutItem[]> = {
  task: [
    'payloadT',
    { subhead: msg('Last') },
    'loadType',
    'loadNote',
    'loadLengthMm',
    'loadWidthMm',
    'loadHeightMm',
    { subhead: msg('Einsatz') },
    'site',
    'ground',
    'speedKmh',
    'slopePct',
    'publicRoads',
    { more: { title: msg('Wege und Betrieb'), hint: msg('Hindernisse, Gangbreite, Laufleistung'), items: ['obstacleMm', { grid: ['aisleWidthMm', 'curveRadiusMm', 'hoursLoadedPerDay', 'distanceKmPerDay'] }] } },
    { more: { title: msg('Zugfahrzeug'), hint: msg('Gewicht, Kupplungshöhe, Zugkraft'), items: [{ grid: ['towWeightKg', 'couplingHeightMm', 'towForceN'] }, 'trailersInTrain'] } },
    { more: { title: msg('Anmerkungen'), hint: msg('Sonstige Anforderungen und Wünsche'), items: ['notes'] } },
  ],
  vehicle: [
    'body',
    'lengthMm',
    'widthMm',
    'deckHeightMm',
    'axles',
    'bedHeightMm',
    'rearWheels',
    'ramp',
    'minLengthMm',
    'maxLengthMm',
    'rasterMm',
    { more: { title: msg('Dachaufbau'), hint: (c) => msg(optionName('roof', c.roof)), items: ['roof', 'roofShape', 'roofClearMm', 'roofSides'] } },
  ],
  running: ['steering', 'tyre', 'nonMarking', 'suspension', 'brake', 'parkingBrake'],
  body: [
    'deck',
    'edgeProtection',
    'wallType',
    'wallMaterial',
    'wallHeightMm',
    'lashingRings',
    'colorId',
    { subhead: msg('Deichsel und Kupplung') },
    'towEye',
    'drawbarSpring',
    'rearCoupling',
    { subhead: msg('Ausstattung') },
    'lighting',
    'chocks',
  ],
};

/** Ob ein Parameter bei dieser Konfiguration eine Rolle spielt. */
export const isRelevant = (key: ParamKey, c: TrailerConfig) => PARAMS[key].when?.(c) ?? true;

export const labelOf = (key: ParamKey, c: TrailerConfig): Msg => {
  const label = PARAMS[key].label;
  return typeof label === 'function' ? label(c) : label;
};

/** Einstellbereich eines Schiebereglers für diese Konfiguration. */
export function rangeOf(key: ParamKey, c: TrailerConfig, d: Derived): { min: number; max: number; step: number } {
  const param = PARAMS[key] as SliderParam;
  const base: { min: number; max: number; step?: number } = LIMITS[param.limit ?? (key as keyof typeof LIMITS)];
  return { step: 1, ...base, ...param.range?.(c, d) };
}

/** Die Optionen einer Auswahl, mit Namen in der gewählten Sprache. */
export function optionsOf(key: ParamKey, L: Locale): { id: string | number; name: string }[] {
  const param = PARAMS[key] as ChoiceParam;
  if (param.numbers) return param.numbers.map((n) => ({ id: n, name: String(n) }));
  const list: readonly { id: string | number; name: string }[] = OPTIONS[key as keyof typeof OPTIONS];
  // Auswahllisten aus Maßen tragen die Zahl als Kennung und werden als Länge geschrieben.
  return list.map((o) => ({ id: o.id, name: typeof o.id === 'number' ? L.mm(o.id) : L.t(o.name) }));
}

/** Der Wert eines Parameters als Text, wie er in Bedienung und Zusammenfassung steht. */
export function formatValue(key: ParamKey, c: TrailerConfig, L: Locale): string {
  const param = PARAMS[key];
  const value = c[key];
  switch (param.control) {
    case 'slider':
      return param.unit === 'mm' ? L.mm(value as number) : param.unit ? `${value} ${param.unit}` : String(value);
    case 'segmented':
    case 'chips':
    case 'cards':
      return optionsOf(key, L).find((o) => o.id === value)?.name ?? String(value);
    case 'switch':
      return L.t(value ? 'Ja' : 'Nein');
    case 'number':
      return value === null ? L.t('Keine Angabe') : `${L.nf(value as number)} ${param.unit}`;
    case 'text':
      return (value as string).trim() || L.t('Keine Angabe');
    case 'color': {
      const color = COLORS.find((x) => x.id === value) ?? COLORS[0];
      return `${color.ral} ${L.t(color.name)}`;
    }
  }
}
