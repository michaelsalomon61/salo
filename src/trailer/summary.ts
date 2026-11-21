/** Alle Angaben der Konfiguration als lesbare Liste, für Anzeige und Export. */
import { performance } from './advice';
import { COLORS, hasBoardDeck, optionName, type Derived, type TrailerConfig } from './config';
import type { TrailerParts } from './parts';

export interface SummarySection {
  title: string;
  items: [label: string, value: string][];
}

const nf = new Intl.NumberFormat('de-DE');
const mm = (v: number) => `${nf.format(v)} mm`;
const yesNo = (v: boolean) => (v ? 'Ja' : 'Nein');
const optional = (v: number | null, unit: string) => (v === null ? 'Keine Angabe' : `${nf.format(v)} ${unit}`);

export function describeConfig(
  c: TrailerConfig,
  d: Derived,
  description: Pick<TrailerParts, 'bed' | 'height'>,
  tareKg: number,
  pieceCount: number,
): SummarySection[] {
  const color = COLORS.find((x) => x.id === c.colorId) ?? COLORS[0];
  const p = performance(c, d, tareKg);

  const load: SummarySection['items'] = [['Lastart', optionName('loadType', c.loadType)]];
  if (c.loadType === 'custom') load.push(['Beschreibung', c.loadNote.trim() || 'Keine Angabe']);
  else load.push(['Abmessungen der Last (L × B × H)', `${mm(c.loadLengthMm)} × ${mm(c.loadWidthMm)} × ${mm(c.loadHeightMm)}`]);

  const deck: SummarySection['items'] = [['Belag', optionName('deck', c.deck)]];
  if (hasBoardDeck(c.deck)) deck.push(['Kantenschutz', optionName('edgeProtection', c.edgeProtection)]);
  deck.push(['Bordwände', optionName('wallType', c.wallType)]);
  if (c.wallType !== 'none') {
    deck.push(['Material der Bordwände', optionName('wallMaterial', c.wallMaterial)], ['Höhe der Bordwände', mm(c.wallHeightMm)]);
  }
  deck.push(['Verzurrösen', yesNo(c.lashingRings)]);

  const body: SummarySection['items'] = [['Bauform', optionName('body', c.body)]];
  if (c.body === 'lowbed') {
    body.push(['Ladehöhe Tiefbett', mm(c.bedHeightMm)], ['Hinterräder', optionName('rearWheels', c.rearWheels)], ['Auffahrklappe', optionName('ramp', c.ramp)]);
    if (description.bed) {
      body.push(['Tiefbett (L × B)', `${mm(Math.round(description.bed.length * 100) * 10)} × ${mm(Math.round(description.bed.width * 100) * 10)}`]);
    }
  } else if (c.body === 'longload') {
    body.push(['Mindestlänge', mm(c.minLengthMm)], ['Maximallänge', mm(c.maxLengthMm)], ['Längenrasterung', mm(c.rasterMm)]);
  } else {
    body.push(['Dachaufbau', optionName('roof', c.roof)]);
    if (c.roof !== 'none') {
      body.push(
        ['Dachform', optionName('roofShape', c.roofShape)],
        ['Lichte Höhe', mm(c.roofClearMm)],
        ['Seiten', optionName('roofSides', c.roofSides)],
      );
    }
  }

  return [
    {
      title: 'Grunddaten',
      items: [
        ['Nutzlast', `${c.payloadT} t`],
        [c.body === 'longload' ? 'Eingestellte Länge × Breite' : 'Ladefläche (L × B)', `${mm(c.lengthMm)} × ${mm(c.widthMm)}`],
        [c.body === 'lowbed' ? 'Höhe über den Achsen' : 'Ladehöhe', mm(c.deckHeightMm)],
        ['Achsen', `${c.axles} × ${d.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse'}`],
      ],
    },
    { title: 'Bauform', items: body },
    {
      title: 'Einsatz',
      items: [
        ['Geschwindigkeit', `${c.speedKmh} km/h`],
        ['Einsatzort', optionName('site', c.site)],
        ['Öffentliche Verkehrswege (StVZO)', yesNo(c.publicRoads)],
        ['Untergrund', optionName('ground', c.ground)],
        ['Größte Steigung', `${c.slopePct} %`],
        ['Höhe des größten Hindernisses', mm(c.obstacleMm)],
        ['Gangbreite', optional(c.aisleWidthMm, 'mm')],
        ['Kurvenradius', optional(c.curveRadiusMm, 'mm')],
        ['Stunden mit Last pro Tag', optional(c.hoursLoadedPerDay, 'h')],
        ['Wegstrecke pro Tag', optional(c.distanceKmPerDay, 'km')],
      ],
    },
    { title: 'Last', items: load },
    {
      title: 'Fahrwerk',
      items: [
        ['Lenkung', optionName('steering', c.steering)],
        ['Bereifung', `${optionName('tyre', c.tyre)}${c.nonMarking ? ', spurfrei' : ''}`],
        ['Räder', `${d.wheelCount} × Ø ${d.wheelDiameterMm} mm`],
        ['Federung', optionName('suspension', c.suspension)],
        ['Bremse', optionName('brake', c.brake)],
        ['Feststellbremse', yesNo(c.parkingBrake)],
      ],
    },
    { title: 'Ladefläche', items: deck },
    {
      title: 'Deichsel und Kupplung',
      items: [
        ['Zugöse', optionName('towEye', c.towEye)],
        ['Gefederte Höheneinstellung', yesNo(c.drawbarSpring)],
        ['Kupplung hinten', optionName('rearCoupling', c.rearCoupling)],
      ],
    },
    {
      title: 'Ausstattung',
      items: [
        ['Beleuchtung', optionName('lighting', c.lighting)],
        ['Unterlegkeile', optionName('chocks', c.chocks)],
        ['Lackierung', `${color.ral} ${color.name}`],
      ],
    },
    {
      title: 'Zugfahrzeug',
      items: [
        ['Gesamtgewicht', optional(c.towWeightKg, 'kg')],
        ['Kupplungshöhe', optional(c.couplingHeightMm, 'mm')],
        ['Zugkraft am Haken', optional(c.towForceN, 'N')],
        ['Anhänger im Zug', String(c.trailersInTrain)],
      ],
    },
    {
      title: 'Kennwerte (Schätzung)',
      items: [
        ['Eigengewicht', `ca. ${nf.format(tareKg)} kg`],
        ['Gesamtgewicht', `ca. ${nf.format(p.grossKg)} kg`],
        ['Radlast', `ca. ${nf.format(p.wheelLoadKg)} kg`],
        ['Zugkraftbedarf', `ca. ${nf.format(p.pullN)} N`],
        ['Rahmenhöhe', mm(d.frameHeightMm)],
        ['Gesamthöhe', mm(Math.round(description.height * 100) * 10)],
        ['Einzelteile', nf.format(pieceCount)],
      ],
    },
    ...(c.notes.trim() ? [{ title: 'Anmerkungen', items: [['Text', c.notes.trim()] as [string, string]] }] : []),
  ];
}

/** Zusammenfassung als CSV für Excel (Semikolon). */
export function summaryToCsv(sections: SummarySection[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [['Abschnitt', 'Angabe', 'Wert']];
  for (const s of sections) for (const [label, value] of s.items) lines.push([s.title, label, value]);
  return lines.map((line) => line.map(cell).join(';')).join('\r\n');
}
