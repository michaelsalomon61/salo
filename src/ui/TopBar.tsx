import { LANGUAGES, type Lang } from '../i18n';
import { useLocale } from '../i18n/context';
import { Icon } from './Icon';
import { Popover } from './Popover';
import { STEPS, type StepId } from './steps';
import { useMediaQuery } from './useMediaQuery';

interface Props {
  step: StepId;
  onStep: (step: StepId) => void;
  /** Name der gespeicherten Konfiguration oder ein Platzhalter. */
  name: string;
  /** Speicherstand in wenigen Worten; leer, solange es Ungespeichertes gibt. */
  status: string;
  canSave: boolean;
  savedCount: number;
  lang: Lang;
  onLang: (lang: Lang) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenSaved: () => void;
  onReset: () => void;
  onShare: () => void;
}

/** Kopfzeile: Konfiguration mit Speicherstand, Schritte, Teilen und Sprache. */
export function TopBar({ step, onStep, name, status, canSave, savedCount, lang, onLang, onSave, onSaveAs, onOpenSaved, onReset, onShare }: Props) {
  const L = useLocale();
  const { t } = L;
  const active = STEPS.findIndex((s) => s.id === step);
  const compact = useMediaQuery('(max-width: 860px)');
  return (
    <header className="top">
      <div className="top-start">
        <span className="brand">{t('Schwerlastanhänger')}</span>
        <Popover
          id="config-menu"
          buttonClass="doc"
          role="menu"
          label={`${t('Konfiguration verwalten')}: ${name}`}
          button={
            <>
              <span className="doc-name">{name}</span>
              <Icon name="down" />
            </>
          }
        >
          {(close) => {
            const item = (id: string, label: string, action: () => void) => (
              <button
                type="button"
                id={id}
                role="menuitem"
                onClick={() => {
                  close();
                  action();
                }}
              >
                {label}
              </button>
            );
            return (
              <div className="menu">
                {item('save-as', t('Speichern unter …'), onSaveAs)}
                {item('open-saved', `${t('Gespeicherte Konfigurationen')}${savedCount > 0 ? ` (${savedCount})` : ''}`, onOpenSaved)}
                <hr />
                {item('open-reset', t('Neu beginnen …'), onReset)}
              </div>
            );
          }}
        </Popover>
        <span className="doc-status" aria-live="polite" title={status}>
          {status}
        </span>
        {canSave && (
          <button type="button" id="quick-save" className="button small" onClick={onSave}>
            {t('Speichern')}
          </button>
        )}
      </div>

      <nav className="steps" aria-label={t('Schritte')}>
        {STEPS.map((s, i) => (
          <button key={s.id} type="button" id={`step-${s.id}`} className={i < active ? 'done' : undefined} aria-current={s.id === step ? 'step' : undefined} onClick={() => onStep(s.id)}>
            <em>{i < active ? <Icon name="check" /> : i + 1}</em>
            {L.m(s.name)}
          </button>
        ))}
      </nav>

      <div className="top-end">
        <button type="button" id="open-share" className="button" onClick={onShare}>
          <Icon name="share" />
          <span>{t('Teilen')}</span>
        </button>
        <select id="language" className="button select" aria-label={t('Sprache')} value={lang} onChange={(e) => onLang(e.target.value as Lang)}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {compact ? l.id.toUpperCase() : l.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
