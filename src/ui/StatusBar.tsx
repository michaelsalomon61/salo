import { useLocale } from '../i18n/context';
import { Popover } from './Popover';

interface Props {
  /** Kennwerte als Begriff, Wert und optionaler Zusatz. */
  figures: { term: string; value: string; extra?: string }[];
  /** Selbsttätige Korrekturen des Regelwerks. */
  adjusted: string[];
  notices: string[];
  price: string;
  /** Kurzangabe für schmale Fenster, in denen die Kennwerte keinen Platz haben. */
  brief: string;
  back: (() => void) | null;
  /** Nächster Schritt mit Namen; null im letzten Schritt. */
  next: { name: string; go: () => void } | null;
}

/** Fußleiste: die Folgen der aktuellen Konfiguration und der Weg zum nächsten Schritt. */
export function StatusBar({ figures, adjusted, notices, price, brief, back, next }: Props) {
  const { t } = useLocale();
  const count = adjusted.length + notices.length;
  const countText = count === 1 ? t('1 Hinweis') : t('{count} Hinweise', { count });
  return (
    <footer className="bar">
      <dl className="bar-figures">
        {figures.map((f) => (
          <div key={f.term}>
            <dt>{f.term}</dt>
            <dd>
              {f.value}
              {f.extra && <small> {f.extra}</small>}
            </dd>
          </div>
        ))}
      </dl>
      {count > 0 ? (
        <Popover
          id="open-hints"
          buttonClass="hint"
          label={countText}
          up
          button={
            <>
              <span className="wide">{countText}</span>
              <span className="narrow">{count}</span>
            </>
          }
        >
          {() => (
            <div className="hints">
              {adjusted.length > 0 && (
                <>
                  <h3>{t('Selbsttätig angepasst')}</h3>
                  <ul>
                    {adjusted.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </>
              )}
              {notices.length > 0 && (
                <>
                  <h3>{t('Hinweise')}</h3>
                  <ul>
                    {notices.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </Popover>
      ) : (
        <span className="hint none">{t('Keine Hinweise')}</span>
      )}
      <div className="bar-end">
        <div className="bar-price">
          <small>{t('Richtpreis')}</small>
          <b>
            {price} <span>{t('netto')}</span>
          </b>
          <small className="bar-brief">{brief}</small>
        </div>
        <div className="bar-nav">
          {back && (
            <button type="button" id="step-back" className="button large" onClick={back}>
              {t('Zurück')}
            </button>
          )}
          {next && (
            <button type="button" id="step-next" className="button large primary" onClick={next.go}>
              <span className="wide">{t('Weiter: {step}', { step: { raw: next.name } })}</span>
              <span className="narrow">{t('Weiter')}</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
