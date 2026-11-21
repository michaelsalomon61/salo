/** Alle Angaben der Konfiguration als lesbare Liste, für Anzeige und Export. */
import { locale, type Locale } from '../i18n';
import { performance } from './advice';
import { COLORS, hasBoardDeck, optionName, type Derived, type TrailerConfig } from './config';
import type { TrailerParts } from './parts';

export interface SummarySection {
  /** Kennung des Abschnitts, unabhängig von der Sprache. */
  id: 'basics' | 'body' | 'use' | 'load' | 'running' | 'deck' | 'drawbar' | 'equipment' | 'tow' | 'figures' | 'notes';
  title: string;
  items: [label: string, value: string][];
}

export function describeConfig(
  c: TrailerConfig,
  d: Derived,
  description: Pick<TrailerParts, 'bed' | 'height'>,
  tareKg: number,
  pieceCount: number,
  L: Locale = locale('de'),
): SummarySection[] {
  const { t, mm, nf } = L;
  const yesNo = (v: boolean) => t(v ? 'Ja' : 'Nein');
  const optional = (v: number | null, unit: string) => (v === null ? t('Keine Angabe') : `${nf(v)} ${unit}`);
  const approx = (value: string) => t('ca. {value}', { value: { raw: value } });
  const color = COLORS.find((x) => x.id === c.colorId) ?? COLORS[0];
  const p = performance(c, d, tareKg);

  const load: SummarySection['items'] = [[t('Lastart'), t(optionName('loadType', c.loadType))]];
  if (c.loadType === 'custom') load.push([t('Beschreibung'), c.loadNote.trim() || t('Keine Angabe')]);
  else load.push([t('Abmessungen der Last (L × B × H)'), `${mm(c.loadLengthMm)} × ${mm(c.loadWidthMm)} × ${mm(c.loadHeightMm)}`]);

  const deck: SummarySection['items'] = [[t('Belag'), t(optionName('deck', c.deck))]];
  if (hasBoardDeck(c.deck) && c.body === 'platform') deck.push([t('Kantenschutz'), t(optionName('edgeProtection', c.edgeProtection))]);
  if (c.body === 'platform') deck.push([t('Bordwände'), t(optionName('wallType', c.wallType))]);
  if (c.wallType !== 'none') {
    deck.push([t('Material der Bordwände'), t(optionName('wallMaterial', c.wallMaterial))], [t('Höhe der Bordwände'), mm(c.wallHeightMm)]);
  }
  if (c.body !== 'longload') deck.push([t('Verzurrösen'), yesNo(c.lashingRings)]);

  const body: SummarySection['items'] = [[t('Bauform'), t(optionName('body', c.body))]];
  if (c.body === 'lowbed') {
    body.push([t('Ladehöhe Tiefbett'), mm(c.bedHeightMm)], [t('Hinterräder'), t(optionName('rearWheels', c.rearWheels))], [t('Auffahrklappe'), t(optionName('ramp', c.ramp))]);
    if (description.bed) {
      body.push([t('Tiefbett (L × B)'), `${mm(Math.round(description.bed.length * 100) * 10)} × ${mm(Math.round(description.bed.width * 100) * 10)}`]);
    }
  } else if (c.body === 'longload') {
    body.push([t('Mindestlänge'), mm(c.minLengthMm)], [t('Maximallänge'), mm(c.maxLengthMm)], [t('Längenrasterung'), mm(c.rasterMm)]);
  } else {
    body.push([t('Dachaufbau'), t(optionName('roof', c.roof))]);
    if (c.roof !== 'none') {
      body.push([t('Dachform'), t(optionName('roofShape', c.roofShape))], [t('Lichte Höhe'), mm(c.roofClearMm)], [t('Seiten'), t(optionName('roofSides', c.roofSides))]);
    }
  }

  const sections: SummarySection[] = [
    {
      id: 'basics',
      title: t('Grunddaten'),
      items: [
        [t('Nutzlast'), `${c.payloadT} t`],
        [t(c.body === 'longload' ? 'Eingestellte Länge × Breite' : 'Ladefläche (L × B)'), `${mm(c.lengthMm)} × ${mm(c.widthMm)}`],
        [t(c.body === 'lowbed' ? 'Höhe über den Achsen' : 'Ladehöhe'), mm(c.deckHeightMm)],
        [t('Achsen'), `${c.axles} × ${t(d.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse')}`],
      ],
    },
    { id: 'body', title: t('Bauform'), items: body },
    {
      id: 'use',
      title: t('Einsatz'),
      items: [
        [t('Geschwindigkeit'), `${c.speedKmh} km/h`],
        [t('Einsatzort'), t(optionName('site', c.site))],
        [t('Öffentliche Verkehrswege (StVZO)'), yesNo(c.publicRoads)],
        [t('Untergrund'), t(optionName('ground', c.ground))],
        [t('Größte Steigung'), `${c.slopePct} %`],
        [t('Höhe des größten Hindernisses'), mm(c.obstacleMm)],
        [t('Gangbreite'), optional(c.aisleWidthMm, 'mm')],
        [t('Kurvenradius'), optional(c.curveRadiusMm, 'mm')],
        [t('Stunden mit Last pro Tag'), optional(c.hoursLoadedPerDay, 'h')],
        [t('Wegstrecke pro Tag'), optional(c.distanceKmPerDay, 'km')],
      ],
    },
    { id: 'load', title: t('Last'), items: load },
    {
      id: 'running',
      title: t('Fahrwerk'),
      items: [
        [t('Lenkung'), t(optionName('steering', c.steering))],
        [t('Bereifung'), `${t(optionName('tyre', c.tyre))}${c.nonMarking ? t(', spurfrei') : ''}`],
        [t('Räder'), `${d.wheelCount} × Ø ${mm(d.wheelDiameterMm)}`],
        [t('Federung'), t(optionName('suspension', c.suspension))],
        [t('Bremse'), t(optionName('brake', c.brake))],
        [t('Feststellbremse'), yesNo(c.parkingBrake)],
      ],
    },
    { id: 'deck', title: t('Ladefläche'), items: deck },
    {
      id: 'drawbar',
      title: t('Deichsel und Kupplung'),
      items: [
        [t('Zugöse'), t(optionName('towEye', c.towEye))],
        [t('Gefederte Höheneinstellung'), yesNo(c.drawbarSpring)],
        [t('Kupplung hinten'), t(optionName('rearCoupling', c.rearCoupling))],
      ],
    },
    {
      id: 'equipment',
      title: t('Ausstattung'),
      items: [
        [t('Beleuchtung'), t(optionName('lighting', c.lighting))],
        [t('Unterlegkeile'), t(optionName('chocks', c.chocks))],
        [t('Lackierung'), `${color.ral} ${t(color.name)}`],
      ],
    },
    {
      id: 'tow',
      title: t('Zugfahrzeug'),
      items: [
        [t('Gesamtgewicht'), optional(c.towWeightKg, 'kg')],
        [t('Kupplungshöhe'), optional(c.couplingHeightMm, 'mm')],
        [t('Zugkraft am Haken'), optional(c.towForceN, 'N')],
        [t('Anhänger im Zug'), String(c.trailersInTrain)],
      ],
    },
    {
      id: 'figures',
      title: t('Kennwerte (Schätzung)'),
      items: [
        [t('Eigengewicht'), approx(L.kg(tareKg))],
        [t('Gesamtgewicht'), approx(L.kg(p.grossKg))],
        [t('Radlast'), approx(L.kg(p.wheelLoadKg))],
        [t('Zugkraftbedarf'), approx(`${nf(p.pullN)} N`)],
        [t('Rahmenhöhe'), mm(d.frameHeightMm)],
        [t('Gesamthöhe'), mm(Math.round(description.height * 100) * 10)],
        [t('Einzelteile'), nf(pieceCount)],
      ],
    },
  ];
  if (c.notes.trim()) sections.push({ id: 'notes', title: t('Anmerkungen'), items: [[t('Text'), c.notes.trim()]] });
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
