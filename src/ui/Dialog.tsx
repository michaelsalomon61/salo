import { useEffect, useRef, type ReactNode } from 'react';
import { useLocale } from '../i18n/context';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bildschirmfüllende Ansicht über dem Konfigurator, schließt mit Escape. */
export function Dialog({ title, subtitle, onClose, children }: Props) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog-inner">
        <header className="dialog-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="lede">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" className="button" onClick={onClose}>
            {t('Zurück zur Konfiguration')}
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
