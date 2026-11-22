import { useEffect, useState } from 'react';
import { useLocale } from '../i18n/context';
import { buildEml, parseRecipients } from '../mail/eml';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  /** Erzeugt das STEP-Modell der aktuellen Konfiguration. */
  createStep: () => Promise<Blob>;
  fileBase: string;
  subject: string;
  body: string;
  onClose: () => void;
}

const STEP_TYPE = 'model/step';

/** STEP-Modell als Anhang eines E-Mail-Entwurfs oder über das Teilen-Menü des Geräts. */
export function MailDialog({ createStep, fileBase, subject, body, onClose }: Props) {
  const { t, nf } = useLocale();
  const [model, setModel] = useState<Blob | 'working' | 'failed'>('working');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createStep().then(
      (blob) => active && setModel(blob),
      () => active && setModel('failed'),
    );
    return () => {
      active = false;
    };
    // Das Modell gehört zum Stand beim Öffnen; es wird genau einmal erzeugt.
  }, []);

  const ready = model instanceof Blob;
  const recipients = parseRecipients(to);
  const stepFile = ready ? new File([model], `${fileBase}.step`, { type: STEP_TYPE }) : null;
  // Auf Telefonen und Tablets führt das Teilen-Menü direkt in die Mail-App.
  const canShare = !!stepFile && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [stepFile] });
  const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  const saveDraft = async () => {
    if (!ready || !recipients) return;
    const bytes = new Uint8Array(await model.arrayBuffer());
    saveBlob(buildEml({ to: recipients, subject, body, attachment: { name: `${fileBase}.step`, bytes, type: STEP_TYPE } }), `${fileBase}.eml`);
    setMessage('Der Entwurf ist gespeichert. Bitte die Datei öffnen: Das Mailprogramm zeigt die Nachricht mit dem STEP-Modell im Anhang.');
  };
  const share = async () => {
    if (!stepFile) return;
    try {
      await navigator.share({ files: [stepFile], title: subject, text: body });
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      setMessage('Dieser Browser gibt STEP-Dateien nicht an andere Apps weiter. Bitte den E-Mail-Entwurf verwenden.');
    }
  };

  const status =
    message ??
    (model === 'working'
      ? 'Das STEP-Modell wird erzeugt …'
      : model === 'failed'
        ? 'Das STEP-Modell konnte nicht erzeugt werden. Bitte Verbindung prüfen und erneut versuchen.'
        : 'Das STEP-Modell ist fertig.');

  return (
    <Dialog title={t('STEP-Modell per E-Mail')} subtitle={subject} onClose={onClose}>
      <form
        className="save-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
      >
        <div className="text-field">
          <label className="field-label" htmlFor="mail-to">
            {t('Empfänger (optional)')}
          </label>
          <input id="mail-to" type="text" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" placeholder="name@example.com" value={to} aria-invalid={!recipients} onChange={(e) => setTo(e.target.value)} />
        </div>
        {canShare && (
          <button type="button" id="mail-share" className={touch ? 'button primary' : 'button'} disabled={!ready} onClick={() => void share()}>
            {t('An Mail-App übergeben …')}
          </button>
        )}
        <button type="submit" id="mail-draft" className={canShare && touch ? 'button' : 'button primary'} disabled={!ready || !recipients}>
          {t('E-Mail-Entwurf erstellen')}
        </button>
      </form>
      <p className="status" role={model === 'failed' ? 'alert' : undefined} aria-live="polite">
        {t(recipients ? status : 'Bitte eine gültige E-Mail-Adresse eingeben oder das Feld leer lassen.')}
      </p>
      <ul className="plain-list">
        <li>{t('Der Entwurf ist eine Datei mit der Endung .eml. Beim Öffnen zeigt das Mailprogramm (etwa Outlook, Thunderbird oder Apple Mail) die Nachricht mit Anhang; dort prüfen, ergänzen und senden.')}</li>
        <li>{t('Zeigt das Mailprogramm die Nachricht nur zum Lesen an, „Weiterleiten“ wählen: Der Anhang bleibt erhalten.')}</li>
        <li>{t('Bei Webmail im Browser das STEP-Modell speichern und von Hand anhängen.')}</li>
        <li>{t('Die Seite selbst versendet nichts. Es werden keine Daten an einen Server übertragen.')}</li>
      </ul>
      <div className="dialog-actions">
        <p className="footnote">{`${fileBase}.step${ready ? ` · ${nf(Math.round(model.size / 1e5) / 10)} MB` : ''}`}</p>
        <div className="actions">
          <button type="button" id="mail-save-step" className="button" disabled={!ready} onClick={() => ready && saveBlob(model, `${fileBase}.step`)}>
            {t('Nur STEP-Modell speichern')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
