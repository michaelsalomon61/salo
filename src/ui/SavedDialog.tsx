import { useRef, useState, type FormEvent } from 'react';
import { exportSaved, findByName, type SavedConfig } from '../storage/saved';
import { optionName, type TrailerConfig } from '../trailer/config';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  saved: SavedConfig[];
  /** Der Eintrag, aus dem die aktuelle Konfiguration geladen wurde. */
  currentId: string | null;
  /** Vorschlag für den Namen einer neuen Konfiguration. */
  suggestedName: string;
  /** Speichert die aktuelle Konfiguration; liefert eine Fehlermeldung, wenn es nicht klappt. */
  onSave: (name: string) => string | null;
  onLoad: (entry: SavedConfig) => void;
  onDelete: (id: string) => void;
  /** Liest eine Datei ein; liefert eine Meldung über das Ergebnis. */
  onImport: (text: string) => string;
  onNew: () => void;
  onClose: () => void;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const nf = new Intl.NumberFormat('de-DE');

const describe = (c: TrailerConfig) =>
  `${optionName('body', c.body)}, ${c.payloadT} t, ${nf.format(c.lengthMm)} × ${nf.format(c.widthMm)} mm, ${optionName('steering', c.steering)}`;

export function SavedDialog({ saved, currentId, suggestedName, onSave, onLoad, onDelete, onImport, onNew, onClose }: Props) {
  const current = saved.find((e) => e.id === currentId);
  const [name, setName] = useState(current?.name ?? suggestedName);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const existing = trimmed ? findByName(saved, trimmed) : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    setMessage(onSave(trimmed) ?? `„${trimmed}“ gespeichert.`);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(onImport(await file.text()));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog title="Konfigurationen" subtitle="Speichern, laden und weitergeben" onClose={onClose}>
      <form className="save-form" onSubmit={submit}>
        <div className="text-field">
          <label className="field-label" htmlFor="save-name">
            Name der aktuellen Konfiguration
          </label>
          <input id="save-name" type="text" value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" id="save-submit" className="button primary" disabled={!trimmed}>
          {existing ? 'Überschreiben' : 'Speichern'}
        </button>
      </form>
      <p className="status" aria-live="polite">
        {message ?? (existing ? `Unter „${existing.name}“ ist bereits eine Konfiguration gespeichert. Speichern ersetzt sie.` : 'Ein neuer Name legt einen neuen Eintrag an.')}
      </p>

      {saved.length === 0 ? (
        <p className="empty">Noch keine Konfiguration gespeichert.</p>
      ) : (
        <ul className="saved-list">
          {saved.map((entry) => (
            <li key={entry.id} className="saved-item">
              <div className="saved-text">
                <p className="saved-name">
                  {entry.name}
                  {entry.id === currentId && <span className="badge">Geladen</span>}
                </p>
                <p className="saved-meta">
                  {describe(entry.config)} · gespeichert {dateFormat.format(new Date(entry.savedAt))}
                </p>
              </div>
              <div className="saved-actions">
                {confirmDelete === entry.id ? (
                  <>
                    <button type="button" className="button" onClick={() => setConfirmDelete(null)}>
                      Behalten
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => {
                        onDelete(entry.id);
                        setConfirmDelete(null);
                        setMessage(`„${entry.name}“ gelöscht.`);
                      }}
                    >
                      Endgültig löschen
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="button" onClick={() => setConfirmDelete(entry.id)}>
                      Löschen
                    </button>
                    <button type="button" className="button primary" onClick={() => onLoad(entry)}>
                      Laden
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="dialog-actions">
        <p className="footnote">
          Gespeichert wird in diesem Browser auf diesem Gerät. Für ein anderes Gerät oder zum Weitergeben die
          Konfigurationen als Datei sichern und dort einlesen.
        </p>
        <div className="actions">
          <button type="button" id="saved-new" className="button" onClick={onNew}>
            Neue Konfiguration
          </button>
          <button type="button" id="saved-import" className="button" onClick={() => fileRef.current?.click()}>
            Datei einlesen
          </button>
          <button
            type="button"
            id="saved-export"
            className="button"
            disabled={saved.length === 0}
            onClick={() => saveBlob(new Blob([exportSaved(saved)], { type: 'application/json' }), 'anhaenger-konfigurationen.json')}
          >
            Als Datei sichern
          </button>
          <input ref={fileRef} id="saved-file" type="file" accept="application/json,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
        </div>
      </div>
    </Dialog>
  );
}
