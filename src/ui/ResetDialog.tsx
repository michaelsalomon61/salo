import { useState } from 'react';
import { useLocale } from '../i18n/context';
import { Dialog } from './Dialog';

interface Props {
  /** Anzahl der gespeicherten Konfigurationen. */
  savedCount: number;
  onReset: (deleteSaved: boolean) => void;
  onClose: () => void;
}

/** Rückfrage vor dem Neustart des Konfigurators. */
export function ResetDialog({ savedCount, onReset, onClose }: Props) {
  const { t } = useLocale();
  const [deleteSaved, setDeleteSaved] = useState(false);

  return (
    <Dialog title={t('Zurücksetzen')} subtitle={t('Von vorn beginnen wie beim ersten Öffnen')} onClose={onClose}>
      <ul className="plain-list">
        <li>{t('Alle Eingaben gehen auf die Ausgangswerte zurück, ungespeicherte Änderungen gehen verloren.')}</li>
        <li>{t('Ansicht, Maße und aufgeklappte Abschnitte werden zurückgestellt.')}</li>
        <li>{t('Die gewählte Sprache bleibt erhalten.')}</li>
      </ul>
      {savedCount > 0 && (
        <label className="switch-row reset-option" htmlFor="reset-delete-saved">
          <span>{t('Auch die gespeicherten Konfigurationen löschen ({count})', { count: savedCount })}</span>
          <input id="reset-delete-saved" type="checkbox" role="switch" checked={deleteSaved} onChange={(e) => setDeleteSaved(e.target.checked)} />
        </label>
      )}
      <div className="dialog-actions">
        <p className="footnote">
          {t(deleteSaved ? 'Gespeicherte Konfigurationen werden unwiderruflich gelöscht.' : 'Gespeicherte Konfigurationen bleiben erhalten.')}
        </p>
        <div className="actions">
          <button type="button" id="reset-cancel" className="button" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button type="button" id="reset-confirm" className="button danger" onClick={() => onReset(deleteSaved)}>
            {t('Zurücksetzen')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
