import { quoteToCsv, type Quote } from '../trailer/pricing';
import type { SummarySection } from '../trailer/summary';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  /** Name der gespeicherten Konfiguration, falls vorhanden. */
  name: string | null;
  title: string;
  prose: string;
  sections: SummarySection[];
  quote: Quote;
  fileBase: string;
  onClose: () => void;
}

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' });

/** Abschnitte der Zusammenfassung, die die Ausführung beschreiben; Einsatzdaten und Kennwerte bleiben außen vor. */
const SPEC_SECTIONS = ['Grunddaten', 'Bauform', 'Fahrwerk', 'Ladefläche', 'Deichsel und Kupplung', 'Ausstattung'];

/** Angebot zur Konfiguration: Beschreibung und geschätzter Preis, ohne Adressdaten. */
export function QuoteDialog({ name, title, prose, sections, quote, fileBase, onClose }: Props) {
  const saveCsv = () => {
    // Das BOM-Zeichen sorgt dafür, dass Excel die Umlaute richtig liest.
    saveBlob(new Blob(['﻿', quoteToCsv(quote)], { type: 'text/csv;charset=utf-8' }), `${fileBase}-angebot.csv`);
  };

  return (
    <Dialog title="Angebot" subtitle="Unverbindliche Preisschätzung zur aktuellen Konfiguration" onClose={onClose}>
      <article className="quote">
        <header className="quote-head">
          <div>
            <p className="eyebrow">Angebot · Preisschätzung</p>
            <h2>{title}</h2>
            {name && <p className="lede">Konfiguration „{name}“</p>}
          </div>
          <p className="quote-date">Stand {dateFormat.format(new Date())}</p>
        </header>

        <p className="quote-prose">{prose}</p>

        <section>
          <h3>Ausführung</h3>
          <div className="summary-grid">
            {sections
              .filter((s) => SPEC_SECTIONS.includes(s.title))
              .map((s) => (
                <div key={s.title} className="summary-block">
                  <h4>{s.title}</h4>
                  <dl className="specs">
                    {s.items.map(([label, value]) => (
                      <div className="spec" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
          </div>
        </section>

        <section className="quote-price">
          <h3>Preis</h3>
          <div className="table-scroll">
            <table className="bom quote-table">
              <thead>
                <tr>
                  <th className="num">Pos.</th>
                  <th>Leistung</th>
                  <th>Erläuterung</th>
                  <th className="num">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line, i) => (
                  <tr key={line.label}>
                    <td className="num">{i + 1}</td>
                    <td>{line.label}</td>
                    <td>{line.detail}</td>
                    <td className="num">{eur.format(line.eur)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="num">{quote.lines.length + 1}</td>
                  <td>Gemeinkosten, Wagnis und Gewinn</td>
                  <td />
                  <td className="num">{eur.format(quote.overheadEur)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3} scope="row">
                    Nettopreis (Schätzung)
                  </th>
                  <td className="num">{eur.format(quote.netEur)}</td>
                </tr>
                <tr className="plain">
                  <th colSpan={3} scope="row">
                    Mehrwertsteuer 19 %
                  </th>
                  <td className="num">{eur.format(quote.vatEur)}</td>
                </tr>
                <tr className="plain">
                  <th colSpan={3} scope="row">
                    Bruttopreis (Schätzung)
                  </th>
                  <td className="num">{eur.format(quote.grossEur)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="quote-range">
            Erwartete Spanne: {eur.format(quote.lowEur)} bis {eur.format(quote.highEur)} netto.
          </p>
        </section>

        <section className="quote-terms">
          <h3>Hinweise</h3>
          <ul>
            <li>Der Preis ist eine automatische Schätzung auf Basis hinterlegter Richtwerte und kein verbindliches Angebot.</li>
            <li>Nicht enthalten: Fracht, Verpackung, Abnahmen und Zulassung, Sonderlackierungen sowie Ersatzteile.</li>
            <li>Maße, Gewichte und Ausführung richten sich nach dem Anschauungsmodell und werden in der Konstruktion festgelegt.</li>
          </ul>
        </section>
      </article>

      <div className="dialog-actions no-print">
        <p className="footnote">Zum Weitergeben als PDF: „Drucken“ wählen und als Ziel „Als PDF speichern“ einstellen.</p>
        <div className="actions">
          <button type="button" id="quote-csv" className="button" onClick={saveCsv}>
            Preis als CSV speichern
          </button>
          <button type="button" id="quote-print" className="button primary" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </div>
    </Dialog>
  );
}
