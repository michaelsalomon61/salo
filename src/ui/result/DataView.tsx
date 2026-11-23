import { useLocale } from '../../i18n/context';
import type { SummarySection } from '../../trailer/summary';

/** Alle erfassten Angaben und Kennwerte, nach Themen geordnet. */
export function DataView({ sections }: { sections: SummarySection[] }) {
  const { t } = useLocale();
  return (
    <>
      <div className="summary-grid">
        {sections.map((s) => (
          <section key={s.id} className="summary-block">
            <h3>{s.title}</h3>
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
      <p className="footnote">{t('Kennwerte und Hinweise beruhen auf Faustregeln und ersetzen keine technische Auslegung.')}</p>
    </>
  );
}
