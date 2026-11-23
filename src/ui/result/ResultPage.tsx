import type { ReactNode } from 'react';
import { msg, type Msg } from '../../i18n';
import { useLocale } from '../../i18n/context';
import { Icon, type IconName } from '../Icon';

export type ResultTab = 'quote' | 'bom' | 'data' | 'hints';
export type ResultAction = 'print' | 'csv' | 'step' | 'mail' | 'share' | 'prompt';

const TABS: readonly { id: ResultTab; name: Msg }[] = [
  { id: 'quote', name: msg('Angebot') },
  { id: 'bom', name: msg('Stückliste') },
  { id: 'data', name: msg('Technische Daten') },
  { id: 'hints', name: msg('Hinweise') },
];

/** Überblick neben dem Bild: Bezeichnung und die wichtigsten Kennwerte als Kacheln. */
export function ResultOverview({ title, subtitle, tiles, onEdit }: { title: string; subtitle: string; tiles: { term: string; value: string; extra?: string }[]; onEdit: () => void }) {
  const { t } = useLocale();
  return (
    <section className="result-overview">
      <h1>{title}</h1>
      <p className="lede">{subtitle}</p>
      <dl className="tiles">
        {tiles.map((tile) => (
          <div key={tile.term}>
            <dt>{tile.term}</dt>
            <dd>
              {tile.value}
              {tile.extra && <small> {tile.extra}</small>}
            </dd>
          </div>
        ))}
      </dl>
      <button type="button" id="result-edit" className="text-link" onClick={onEdit}>
        {t('Konfiguration ändern')}
      </button>
    </section>
  );
}

/** Die Unterlagen zur Konfiguration als Reiter. */
export function ResultDoc({ tab, onTab, hintCount, children }: { tab: ResultTab; onTab: (tab: ResultTab) => void; hintCount: number; children: ReactNode }) {
  const { t, m } = useLocale();
  return (
    <section className="result-doc" aria-label={t('Unterlagen')}>
      <div className="tabs" role="tablist" aria-label={t('Unterlagen')}>
        {TABS.map((item) => (
          <button key={item.id} type="button" id={`tab-${item.id}`} role="tab" aria-selected={item.id === tab} aria-controls="result-content" onClick={() => onTab(item.id)}>
            {m(item.name)}
            {item.id === 'hints' && hintCount > 0 && <i>{hintCount}</i>}
          </button>
        ))}
      </div>
      <div id="result-content" role="tabpanel" aria-labelledby={`tab-${tab}`} className="result-content">
        {children}
      </div>
    </section>
  );
}

/** Was sich aus der Konfiguration erzeugen und weitergeben lässt. */
export function ResultOut({ tab, stepState, onAction }: { tab: ResultTab; stepState: 'idle' | 'working' | 'failed'; onAction: (action: ResultAction) => void }) {
  const { t, m } = useLocale();
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
  return (
    <aside className="result-out">
      <h2>{t('Ausgeben')}</h2>
      <div className="rows">
        {row('result-print', 'print', 'doc', t('Angebot drucken'), t('oder als PDF speichern'), { main: true })}
        {row('save-step', 'step', 'cube', t(stepState === 'working' ? 'Wird erzeugt …' : 'STEP-Modell'), t('CAD-Datei speichern'), { disabled: stepState === 'working' })}
        {row('open-mail', 'mail', 'mail', t('STEP per E-Mail'), t('Entwurf mit Modell im Anhang'))}
        {row('result-csv', 'csv', 'table', t('Tabelle als CSV'), tab === 'hints' ? t('für Angebot, Stückliste oder Daten') : m(TABS.find((x) => x.id === tab)!.name), { disabled: tab === 'hints' })}
      </div>
      {stepState === 'failed' && (
        <p className="note" role="alert">
          {t('Das STEP-Modell konnte nicht erzeugt werden. Bitte Verbindung prüfen und erneut versuchen.')}
        </p>
      )}
      <h2>{t('Weitergeben')}</h2>
      <div className="rows">
        {row('result-share', 'share', 'link', t('Link teilen'), t('Öffnet diese Konfiguration'))}
        {row('open-prompt', 'prompt', 'spark', t('KI-Bildprompt'), t('Für ChatGPT kopieren'))}
      </div>
    </aside>
  );
}
