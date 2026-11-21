import { useRef, useState } from 'react';
import { useLocale } from '../i18n/context';
import { Dialog } from './Dialog';

interface Props {
  url: string;
  /** Kurzbeschreibung der Konfiguration für die Betreffzeile beim Teilen. */
  title: string;
  onClose: () => void;
}

/** Link zur Konfiguration zum Kopieren und Versenden. */
export function ShareDialog({ url, title, onClose }: Props) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Link kopiert.');
    } catch {
      // Ohne Zugriff auf die Zwischenablage: Link markieren, damit er von Hand kopiert werden kann.
      inputRef.current?.select();
      setMessage('Der Link ist markiert. Bitte mit Strg+C bzw. Cmd+C kopieren.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // Abgebrochen oder vom Gerät nicht unterstützt; der Link bleibt zum Kopieren stehen.
    }
  };

  return (
    <Dialog title={t('Link teilen')} subtitle={title} onClose={onClose}>
      <div className="save-form">
        <div className="text-field">
          <label className="field-label" htmlFor="share-url">
            {t('Link zu dieser Konfiguration')}
          </label>
          <input id="share-url" ref={inputRef} type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
        </div>
        {typeof navigator.share === 'function' && (
          <button type="button" id="share-native" className="button" onClick={() => void share()}>
            {t('Senden …')}
          </button>
        )}
        <button type="button" id="share-copy" className="button primary" onClick={() => void copy()}>
          {t('Link kopieren')}
        </button>
      </div>
      <p className="status" aria-live="polite">
        {t(message ?? 'Jeder, der diesen Link hat, kann die Konfiguration öffnen. Ein Konto ist nicht nötig.')}
      </p>
      <ul className="plain-list">
        <li>{t('Der Link enthält den Stand von jetzt. Spätere Änderungen brauchen einen neuen Link.')}</li>
        <li>{t('Der Empfänger kann die Konfiguration ansehen, ändern und bei sich speichern. Ihre gespeicherte Konfiguration bleibt davon unberührt.')}</li>
        <li>{t('Alle Angaben stehen im Link selbst, auch der Text unter „Anmerkungen“.')}</li>
      </ul>
    </Dialog>
  );
}
