import { useLocale } from '../i18n/context';
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

/** Abschnitte der Zusammenfassung, die die Ausführung beschreiben; Einsatzdaten und Kennwerte bleiben außen vor. */
const SPEC_SECTIONS: SummarySection['id'][] = ['basics', 'body', 'running', 'deck', 'drawbar', 'equipment'];

/** Angebot zur Konfiguration: Beschreibung und geschätzter Preis, ohne Adressdaten. */
export function QuoteDialog({ name, title, prose, sections, quote, fileBase, onClose }: Props) {
  const L = useLocale();
  const { t, eur } = L;
  const saveCsv = () => {
    // Das BOM-Zeichen sorgt dafür, dass Excel die Umlaute richtig liest.
    saveBlob(new Blob(['﻿', quoteToCsv(quote, L)], { type: 'text/csv;charset=utf-8' }), `${fileBase}-${t('angebot')}.csv`);
  };

  return (
    <Dialog title={t('Angebot')} subtitle={t('Unverbindliche Preisschätzung zur aktuellen Konfiguration')} onClose={onClose}>
      <article className="quote">
        <header className="quote-head">
          <div>
            <p className="eyebrow">{t('Angebot · Preisschätzung')}</p>
            <h2>{title}</h2>
            {name && <p className="lede">{t('Konfiguration „{name}“', { name: { raw: name } })}</p>}
          </div>
          <p className="quote-date">{t('Stand {date}', { date: { raw: L.date(new Date()) } })}</p>
        </header>

        <p className="quote-prose">{prose}</p>

        <section>
          <h3>{t('Ausführung')}</h3>
          <div className="summary-grid">
            {sections
              .filter((s) => SPEC_SECTIONS.includes(s.id))
              .map((s) => (
                <div key={s.id} className="summary-block">
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
          <h3>{t('Preis')}</h3>
          <div className="table-scroll">
            <table className="bom quote-table">
              <thead>
                <tr>
                  <th className="num">{t('Pos.')}</th>
                  <th>{t('Leistung')}</th>
                  <th>{t('Erläuterung')}</th>
                  <th className="num">{t('Betrag')}</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line, i) => (
                  <tr key={line.label.text}>
                    <td className="num">{i + 1}</td>
                    <td>{L.m(line.label)}</td>
                    <td>{line.detail && L.m(line.detail)}</td>
                    <td className="num">{eur(line.eur)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="num">{quote.lines.length + 1}</td>
                  <td>{t('Gemeinkosten, Wagnis und Gewinn')}</td>
                  <td />
                  <td className="num">{eur(quote.overheadEur)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3} scope="row">
                    {t('Nettopreis (Schätzung)')}
                  </th>
                  <td className="num">{eur(quote.netEur)}</td>
                </tr>
                <tr className="plain">
                  <th colSpan={3} scope="row">
                    {t('Mehrwertsteuer 19 %')}
                  </th>
                  <td className="num">{eur(quote.vatEur)}</td>
                </tr>
                <tr className="plain">
                  <th colSpan={3} scope="row">
                    {t('Bruttopreis (Schätzung)')}
                  </th>
                  <td className="num">{eur(quote.grossEur)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="quote-range">{t('Erwartete Spanne: {low} bis {high} netto.', { low: { raw: eur(quote.lowEur) }, high: { raw: eur(quote.highEur) } })}</p>
        </section>

        <section className="quote-terms">
          <h3>{t('Hinweise')}</h3>
          <ul>
            <li>{t('Der Preis ist eine automatische Schätzung auf Basis hinterlegter Richtwerte und kein verbindliches Angebot.')}</li>
            <li>{t('Nicht enthalten: Fracht, Verpackung, Abnahmen und Zulassung, Sonderlackierungen sowie Ersatzteile.')}</li>
            <li>{t('Maße, Gewichte und Ausführung richten sich nach dem Anschauungsmodell und werden in der Konstruktion festgelegt.')}</li>
          </ul>
        </section>
      </article>

      <div className="dialog-actions no-print">
        <p className="footnote">{t('Zum Weitergeben als PDF: „Drucken“ wählen und als Ziel „Als PDF speichern“ einstellen.')}</p>
        <div className="actions">
          <button type="button" id="quote-csv" className="button" onClick={saveCsv}>
            {t('Preis als CSV speichern')}
          </button>
          <button type="button" id="quote-print" className="button primary" onClick={() => window.print()}>
            {t('Drucken')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
