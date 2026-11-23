import { useLocale } from '../../i18n/context';

interface Props {
  /** Selbsttätige Korrekturen des Regelwerks. */
  adjusted: string[];
  notices: string[];
}

/** Was das Regelwerk angepasst hat und worauf bei dieser Konfiguration zu achten ist. */
export function HintsView({ adjusted, notices }: Props) {
  const { t } = useLocale();
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <section className="summary-block">
        <h3>{title}</h3>
        <ul className="notices">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    );
  return (
    <>
      {adjusted.length + notices.length === 0 && <p className="empty">{t('Zu dieser Konfiguration gibt es keine Hinweise.')}</p>}
      {list(t('Selbsttätig angepasst'), adjusted)}
      {list(t('Hinweise'), notices)}
      <p className="footnote">{t('Anschauungsmodell. Kennwerte und Hinweise sind Schätzungen nach Faustregeln und ersetzen keine technische Auslegung.')}</p>
    </>
  );
}
