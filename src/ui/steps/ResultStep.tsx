import type { ReactNode } from 'react';
import { useLocale } from '../../i18n/context';
import { Icon, type IconName } from '../Icon';
import { Subhead } from '../controls';

export type ResultAction = 'quote' | 'summary' | 'bom' | 'step' | 'mail' | 'share' | 'prompt';

interface Props {
  notices: string[];
  /** Kennwerte als Begriff und Wert. */
  specs: [string, string][];
  stepState: 'idle' | 'working' | 'failed';
  onAction: (action: ResultAction) => void;
}

/** Schritt 5: Kennwerte der Konfiguration und alles, was sich daraus erzeugen lässt. */
export function ResultStep({ notices, specs, stepState, onAction }: Props) {
  const { t } = useLocale();
  const row = (id: string, action: ResultAction, icon: IconName, title: string, hint: string, extra?: { main?: boolean; disabled?: boolean }) => (
    <button type="button" id={id} className={extra?.main ? 'row main' : 'row'} disabled={extra?.disabled} onClick={() => onAction(action)}>
      <span className="row-icon">
        <Icon name={icon} />
      </span>
      <span className="row-text">
        <b>{title}</b>
        <small>{hint}</small>
      </span>
      <Icon name="right" />
    </button>
  );
  const rows = (children: ReactNode) => <div className="rows">{children}</div>;

  return (
    <>
      {notices.length > 0 && (
        <ul className="notices" aria-label={t('Hinweise')}>
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <Subhead>{t('Unterlagen')}</Subhead>
      {rows(
        <>
          {row('open-quote', 'quote', 'doc', t('Angebot'), t('Beschreibung mit Richtpreis, druckbar'), { main: true })}
          {row('open-summary', 'summary', 'list', t('Zusammenfassung'), t('Alle Angaben und Kennwerte'))}
          {row('open-bom', 'bom', 'table', t('Stückliste'), t('Bauteile mit Mengen und Gewichten'))}
        </>,
      )}

      <Subhead>{t('Ausgeben')}</Subhead>
      {rows(
        <>
          {row('save-step', 'step', 'cube', t(stepState === 'working' ? 'Wird erzeugt …' : 'STEP-Modell'), t('CAD-Datei speichern'), { disabled: stepState === 'working' })}
          {row('open-mail', 'mail', 'mail', t('STEP per E-Mail'), t('Entwurf mit Modell im Anhang'))}
        </>,
      )}
      {stepState === 'failed' && (
        <p className="note" role="alert">
          {t('Das STEP-Modell konnte nicht erzeugt werden. Bitte Verbindung prüfen und erneut versuchen.')}
        </p>
      )}

      <Subhead>{t('Weitergeben')}</Subhead>
      {rows(
        <>
          {row('result-share', 'share', 'link', t('Link teilen'), t('Öffnet diese Konfiguration'))}
          {row('open-prompt', 'prompt', 'spark', t('KI-Bildprompt'), t('Für ChatGPT kopieren'))}
        </>,
      )}

      <Subhead>{t('Kennwerte')}</Subhead>
      <dl className="specs">
        {specs.map(([term, value]) => (
          <div className="spec" key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="footnote">{t('Anschauungsmodell. Kennwerte und Hinweise sind Schätzungen nach Faustregeln und ersetzen keine technische Auslegung.')}</p>
    </>
  );
}
