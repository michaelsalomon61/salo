/**
 * Prompt für einen KI-Bildgenerator (ChatGPT oder vergleichbar): beschreibt die
 * aktuelle Konfiguration so genau, dass daraus ein fotorealistisches Bild
 * entstehen kann. Der Text folgt der gewählten Sprache.
 */
import { locale, type Locale } from '../i18n';
import { COLORS, STEERING, optionName, type Derived, type TrailerConfig } from './config';
import type { TrailerParts } from './parts';
import { describeConfig, describeProse, type SummarySection } from './summary';

/** Abschnitte der Zusammenfassung, die das Aussehen bestimmen. */
const VISIBLE: SummarySection['id'][] = ['basics', 'body', 'running', 'deck', 'drawbar', 'equipment'];

export function buildImagePrompt(
  c: TrailerConfig,
  d: Derived,
  description: Pick<TrailerParts, 'bed' | 'height' | 'reach'>,
  tareKg: number,
  pieceCount: number,
  L: Locale = locale('de'),
): string {
  const { t, mm } = L;
  const color = COLORS.find((x) => x.id === c.colorId) ?? COLORS[0];
  const raw = (value: string) => ({ raw: value });
  const lines: string[] = [];
  const heading = (text: string) => lines.push('', t(text).toUpperCase());
  const bullet = (text: string) => lines.push(`- ${text}`);

  lines.push(
    t('Erstelle eine fotorealistische 3D-Visualisierung eines Industrieanhängers als Bild in der Qualität eines hochwertigen Produktrenderings. Halte dich genau an die folgende Spezifikation: Maße, Stückzahlen und Ausstattung müssen stimmen, und es darf nichts hinzuerfunden werden.'),
  );

  heading('Fahrzeug');
  lines.push(describeProse(c, d, L));

  heading('Spezifikation');
  for (const section of describeConfig(c, d, description, tareKg, pieceCount, L)) {
    if (!VISIBLE.includes(section.id)) continue;
    lines.push(`${section.title}:`);
    for (const [label, value] of section.items) bullet(`${label}: ${value}`);
  }

  heading('Aufbau und Proportionen');
  bullet(
    t('Länge {length}, Breite {width}, Höhe der Ladefläche über dem Boden {height}. Der Anhänger ist flach und lang gestreckt; größte Höhe insgesamt {total}.', {
      length: raw(mm(c.lengthMm)),
      width: raw(mm(c.widthMm)),
      height: raw(mm(c.deckHeightMm)),
      total: raw(mm(Math.round(description.height * 100) * 10)),
    }),
  );
  bullet(t('Tragender Stahlrahmen, {frame} hoch. An den Längsseiten sind die Außenträger als nach außen offenes U-Profil mit senkrechten Rippen sichtbar; die Ladefläche schließt oben bündig ab.', { frame: raw(mm(d.frameHeightMm)) }));
  if (c.body === 'lowbed') {
    bullet(t('Tieflader: Über den Achsen liegt die Ladefläche auf {height}; dazwischen ist sie als Tiefbett auf {bed} abgesenkt, verbunden über senkrechte Kröpfungen.', { height: raw(mm(c.deckHeightMm)), bed: raw(mm(c.bedHeightMm)) }));
  } else if (c.body === 'longload') {
    bullet(t('Langmaterialanhänger: zwei kurze Fahrgestellmodule mit je einem Rungenschemel und zwei senkrechten Rungen, verbunden nur durch ein mittiges Vierkantrohr. Es gibt keine durchgehende Ladefläche.'));
  }
  bullet(t('Anzahl der Achslinien vorn: {front}, hinten: {rear}. Die vordere Gruppe sitzt nahe der Stirnseite, die hintere nahe dem Heck; dazwischen ist der Unterbau frei.', { front: d.frontAxles, rear: d.rearAxles }));
  bullet(
    t(
      d.axleType === 'pendel'
        ? 'Jede Achslinie trägt 4 Räder: links und rechts je eine Pendelachse mit zwei eng nebeneinander stehenden Rädern. Insgesamt {count} Räder, Ø {diameter}, Reifenbreite {width}. Die Räder stehen vollständig unter dem Aufbau.'
        : 'Jede Achslinie trägt 2 Räder, eines je Seite. Insgesamt {count} Räder, Ø {diameter}, Reifenbreite {width}. Die Räder stehen vollständig unter dem Aufbau.',
      { count: d.wheelCount, diameter: raw(mm(d.wheelDiameterMm)), width: raw(mm(d.wheelWidthMm)) },
    ),
  );
  bullet(
    t(
      {
        solid: 'Reifen: massive Vollgummireifen ohne Profil auf schwarzen Stahlfelgen.',
        superElastic: 'Reifen: breite Super-Elastic-Reifen (Vollreifen in der Form eines Luftreifens) auf schwarzen Stahlfelgen.',
        pneumatic: 'Reifen: Luftreifen mit Profil auf silbergrauen Stahlfelgen.',
        polyurethane: 'Reifen: schmale, bernsteinfarbene Polyurethan-Bandagen auf grauen Stahlrädern.',
      }[c.tyre],
    ) + (c.tyre === 'polyurethane' ? '' : ` ${t(c.nonMarking ? 'Die Reifen sind hellgrau.' : 'Die Reifen sind schwarz.')}`),
  );
  bullet(
    t(
      STEERING[c.steering].front === 'bogie'
        ? 'Die Vorderachsen hängen an einem Drehschemel, einem drehbaren Unterwagen mit Drehkranz unter der Stirnseite; daran ist auch die Deichsel angelenkt.'
        : 'Die Vorderräder lenken einzeln über Achsschenkel; die Deichsel sitzt an einem Lenkbock unter der Stirnseite.',
    ),
  );
  bullet(
    t(c.drawbarUp ? 'Vorn mittig eine A-förmige Zugdeichsel aus Stahlprofilen, etwa {length} lang, mit {eye} an der Spitze. Die Deichsel ist senkrecht hochgeklappt.' : 'Vorn mittig eine A-förmige Zugdeichsel aus Stahlprofilen, etwa {length} lang, mit {eye} an der Spitze. Die Deichsel liegt waagerecht nach vorn.', {
      length: raw(mm(Math.round((description.reach - 0.18) * 100) * 10)),
      eye: optionName('towEye', c.towEye),
    }),
  );
  bullet(t('Lackierung des gesamten Stahlbaus: {ral} {color} (etwa {hex}), seidenglänzend. Achsen, Bolzen und Kleinteile sind dunkel.', { ral: raw(color.ral), color: color.name, hex: raw(color.hex) }));
  bullet(t('Auf beiden seitlichen Außenträgern steht mittig die Aufschrift „{payload} t“.', { payload: c.payloadT }));

  heading('Darstellung');
  bullet(t('Ansicht: Dreiviertelansicht von schräg vorn, Kamera leicht erhöht auf etwa 1,7 m, Brennweite etwa 50 mm. Der ganze Anhänger samt Deichsel ist im Bild, mit etwas Rand.'));
  bullet(t('Umgebung: ebener, heller Betonboden auf einem Werksgelände, im Hintergrund unscharf eine Industriehalle.'));
  bullet(t('Licht: Tageslicht bei leicht bewölktem Himmel, weiche Schatten unter dem Fahrzeug, realistische Reflexionen auf dem Lack.'));
  bullet(t('Format: Querformat 16:9, hohe Auflösung.'));

  heading('Nicht zeigen');
  bullet(t('Keine Personen, kein Zugfahrzeug, keine Ladung.'));
  bullet(t('Keine Firmenlogos, Kennzeichen oder Beschriftungen außer der genannten Traglastangabe.'));
  bullet(t('Keine zusätzlichen Achsen, Räder, Bordwände oder Aufbauten, die oben nicht genannt sind.'));

  lines.push('', t('Falls ein Referenzbild beiliegt: Übernimm Aufbau und Proportionen daraus und setze sie fotorealistisch um.'));
  return lines.join('\n').trim();
}
