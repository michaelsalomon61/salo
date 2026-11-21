/** Alle Angaben der Konfiguration als lesbare Liste, für Anzeige und Export. */
import { performance } from './advice';
import { COLORS, hasBoardDeck, optionName, type Derived, type TrailerConfig } from './config';

export interface SummarySection {
  title: string;
  items: [label: string, value: string][];
}

const nf = new Intl.NumberFormat('de-DE');
const mm = (v: number) => `${nf.format(v)} mm`;
const yesNo = (v: boolean) => (v ? 'Ja' : 'Nein');
const optional = (v: number | null, unit: string) => (v === null ? 'Keine Angabe' : `${nf.format(v)} ${unit}`);

export function describeConfig(c: TrailerConfig, d: Derived, tareKg: number, pieceCount: number): SummarySection[] {
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

  return [
    {
      title: 'Grunddaten',
      items: [
        ['Nutzlast', `${c.payloadT} t`],
        ['Ladefläche (L × B)', `${mm(c.lengthMm)} × ${mm(c.widthMm)}`],
        ['Ladehöhe', mm(c.deckHeightMm)],
        ['Achsen', `${c.axles} × ${d.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse'}`],
      ],
    },
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
        ['Lenkung', 'Drehschemellenkung'],
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
