import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Msg } from '../i18n';
import { useLocale } from '../i18n/context';
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
  /** Unter neuem Namen speichern: das Namensfeld ist vorbelegt und ausgewählt. */
  saveAs?: boolean;
  /** Speichert die aktuelle Konfiguration; liefert eine Fehlermeldung, wenn es nicht klappt. */
  onSave: (name: string) => Msg | null;
  onLoad: (entry: SavedConfig) => void;
  onDelete: (id: string) => void;
  /** Liest eine Datei ein; liefert eine Meldung über das Ergebnis. */
  onImport: (text: string) => Msg;
  onNew: () => void;
  onClose: () => void;
}

export function SavedDialog({ saved, currentId, suggestedName, saveAs, onSave, onLoad, onDelete, onImport, onNew, onClose }: Props) {
  const L = useLocale();
  const { t } = L;
  const current = saved.find((e) => e.id === currentId);
  const [name, setName] = useState(() => {
    if (!saveAs) return current?.name ?? suggestedName;
    // Vorschlag, der noch nicht vergeben ist.
    const base = current ? t('{name} (Kopie)', { name: { raw: current.name } }) : suggestedName;
    let candidate = base;
    for (let i = 2; findByName(saved, candidate); i++) candidate = `${base} ${i}`;
    return candidate;
  });
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (saveAs) {
      nameRef.current?.focus();
      nameRef.current?.select();
    }
  }, [saveAs]);
  const [message, setMessage] = useState<Msg | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const existing = trimmed ? findByName(saved, trimmed) : undefined;
  const describe = (c: TrailerConfig) =>
    `${t(optionName('body', c.body))}, ${c.payloadT} t, ${L.nf(c.lengthMm)} × ${L.mm(c.widthMm)}, ${t(optionName('steering', c.steering))}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    setMessage(onSave(trimmed) ?? { text: '„{name}“ gespeichert.', vars: { name: { raw: trimmed } } });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(onImport(await file.text()));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog title={t('Konfigurationen')} subtitle={t('Speichern, laden und weitergeben')} onClose={onClose}>
      <form className="save-form" onSubmit={submit}>
        <div className="text-field">
          <label className="field-label" htmlFor="save-name">
            {t('Name der aktuellen Konfiguration')}
          </label>
          <input id="save-name" ref={nameRef} type="text" value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" id="save-submit" className="button primary" disabled={!trimmed}>
          {t(existing ? 'Überschreiben' : 'Speichern')}
        </button>
      </form>
      <p className="status" aria-live="polite">
        {message
          ? L.m(message)
          : existing
            ? t('Unter „{name}“ ist bereits eine Konfiguration gespeichert. Speichern ersetzt sie.', { name: { raw: existing.name } })
            : t('Dieser Name ist neu: Speichern legt einen weiteren Eintrag an, die anderen bleiben erhalten.')}
      </p>

      {saved.length === 0 ? (
        <p className="empty">{t('Noch keine Konfiguration gespeichert.')}</p>
      ) : (
        <ul className="saved-list">
          {saved.map((entry) => (
            <li key={entry.id} className="saved-item">
              <div className="saved-text">
                <p className="saved-name">
                  {entry.name}
                  {entry.id === currentId && <span className="badge">{t('Geladen')}</span>}
                </p>
                <p className="saved-meta">
                  {describe(entry.config)} · {t('gespeichert {date}', { date: { raw: L.dateTime(new Date(entry.savedAt)) } })}
                </p>
              </div>
              <div className="saved-actions">
                {confirmDelete === entry.id ? (
                  <>
                    <button type="button" className="button" onClick={() => setConfirmDelete(null)}>
                      {t('Behalten')}
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => {
                        onDelete(entry.id);
                        setConfirmDelete(null);
                        setMessage({ text: '„{name}“ gelöscht.', vars: { name: { raw: entry.name } } });
                      }}
                    >
                      {t('Endgültig löschen')}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="button" onClick={() => setConfirmDelete(entry.id)}>
                      {t('Löschen')}
                    </button>
                    <button type="button" className="button primary" onClick={() => onLoad(entry)}>
                      {t('Laden')}
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
          {t('Gespeichert wird in diesem Browser auf diesem Gerät. Für ein anderes Gerät oder zum Weitergeben die Konfigurationen als Datei sichern und dort einlesen.')}
        </p>
        <div className="actions">
          <button type="button" id="saved-new" className="button" onClick={onNew}>
            {t('Neue Konfiguration')}
          </button>
          <button type="button" id="saved-import" className="button" onClick={() => fileRef.current?.click()}>
            {t('Datei einlesen')}
          </button>
          <button
            type="button"
            id="saved-export"
            className="button"
            disabled={saved.length === 0}
            onClick={() => saveBlob(new Blob([exportSaved(saved)], { type: 'application/json' }), 'anhaenger-konfigurationen.json')}
          >
            {t('Als Datei sichern')}
          </button>
          <input ref={fileRef} id="saved-file" type="file" accept="application/json,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
        </div>
      </div>
    </Dialog>
  );
}
