import { useLocale } from '../i18n/context';
import { summaryToCsv, type SummarySection } from '../trailer/summary';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  sections: SummarySection[];
  /** Hinweise, bereits in der gewählten Sprache. */
  notices: string[];
  fileBase: string;
  onClose: () => void;
}

/** Alle erfassten Angaben auf einen Blick, zum Prüfen und Weitergeben. */
export function SummaryDialog({ sections, notices, fileBase, onClose }: Props) {
  const L = useLocale();
  const { t } = L;
  const saveCsv = () => {
    // Das BOM-Zeichen sorgt dafür, dass Excel die Umlaute richtig liest.
    saveBlob(new Blob(['﻿', summaryToCsv(sections, L)], { type: 'text/csv;charset=utf-8' }), `${fileBase}-${t('konfiguration')}.csv`);
  };

  return (
    <Dialog title={t('Zusammenfassung')} subtitle={t('Alle Angaben dieser Konfiguration')} onClose={onClose}>
      {notices.length > 0 && (
        <ul className="notices">
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div className="summary-grid">
        {sections.map((s) => (
          <section key={s.id} className="summary-block">
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
        <p className="footnote">{t('Kennwerte und Hinweise beruhen auf Faustregeln und ersetzen keine technische Auslegung.')}</p>
        <button type="button" id="summary-save" className="button primary" onClick={saveCsv}>
          {t('Als CSV speichern')}
        </button>
      </div>
    </Dialog>
  );
}
