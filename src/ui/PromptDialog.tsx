import { useRef, useState } from 'react';
import { useLocale } from '../i18n/context';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  prompt: string;
  /** Ob das Kopieren beim Öffnen schon geklappt hat. */
  copied: boolean;
  /** Liefert die aktuelle 3D-Ansicht als PNG, falls verfügbar. */
  capture: (() => string | null) | null;
  fileBase: string;
  onClose: () => void;
}

/** Prompt für einen KI-Bildgenerator mit der Spezifikation der aktuellen Konfiguration. */
export function PromptDialog({ prompt, copied, capture, fileBase, onClose }: Props) {
  const { t } = useLocale();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState(copied ? 'Der Prompt liegt in der Zwischenablage.' : 'Der Prompt ist noch nicht kopiert. Bitte „Prompt kopieren“ wählen.');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage('Der Prompt liegt in der Zwischenablage.');
    } catch {
      // Ohne Zugriff auf die Zwischenablage: Text markieren, damit er von Hand kopiert werden kann.
      textRef.current?.select();
      setMessage('Der Text ist markiert. Bitte mit Strg+C bzw. Cmd+C kopieren.');
    }
  };
  const saveImage = async () => {
    const url = capture?.();
    if (!url) return setMessage('Die 3D-Ansicht steht gerade nicht als Bild zur Verfügung.');
    saveBlob(await (await fetch(url)).blob(), `${fileBase}-3d.png`);
  };

  return (
    <Dialog title={t('KI-Bildprompt')} subtitle={t('Fotorealistisches Bild der Konfiguration mit ChatGPT oder einem anderen Bildgenerator erzeugen')} onClose={onClose}>
      <p className="status" aria-live="polite">
        {t(message)}
      </p>
      <textarea id="prompt-text" ref={textRef} className="prompt-text" readOnly rows={18} value={prompt} onFocus={(e) => e.target.select()} />
      <div className="dialog-actions">
        <ol className="plain-list">
          <li>{t('ChatGPT oder einen anderen Bildgenerator öffnen und den Prompt einfügen.')}</li>
          <li>{t('Für ein genaueres Ergebnis das Bild der 3D-Ansicht speichern und als Vorlage mit hochladen.')}</li>
          <li>{t('Das Ergebnis ist eine Illustration der KI. Einzelheiten können von der Konfiguration abweichen.')}</li>
        </ol>
        <div className="actions">
          {capture && (
            <button type="button" id="prompt-image" className="button" onClick={() => void saveImage()}>
              {t('3D-Ansicht als Bild speichern')}
            </button>
          )}
          <button type="button" id="prompt-copy" className="button primary" onClick={() => void copy()}>
            {t('Prompt kopieren')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
