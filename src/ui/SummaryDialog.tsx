import { summaryToCsv, type SummarySection } from '../trailer/summary';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  sections: SummarySection[];
  notices: string[];
  fileBase: string;
  onClose: () => void;
}

/** Alle erfassten Angaben auf einen Blick, zum Prüfen und Weitergeben. */
export function SummaryDialog({ sections, notices, fileBase, onClose }: Props) {
  const saveCsv = () => {
    // Das BOM-Zeichen sorgt dafür, dass Excel die Umlaute richtig liest.
    saveBlob(new Blob(['﻿', summaryToCsv(sections)], { type: 'text/csv;charset=utf-8' }), `${fileBase}-konfiguration.csv`);
  };

  return (
    <Dialog title="Zusammenfassung" subtitle="Alle Angaben dieser Konfiguration" onClose={onClose}>
      {notices.length > 0 && (
        <ul className="notices">
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div className="summary-grid">
        {sections.map((s) => (
          <section key={s.title} className="summary-block">
            <h2>{s.title}</h2>
            <dl className="specs">
              {s.items.map(([label, value]) => (
                <div className="spec" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="dialog-actions">
        <p className="footnote">Kennwerte und Hinweise beruhen auf Faustregeln und ersetzen keine technische Auslegung.</p>
        <button type="button" id="summary-save" className="button primary" onClick={saveCsv}>
          Als CSV speichern
        </button>
      </div>
    </Dialog>
  );
}
