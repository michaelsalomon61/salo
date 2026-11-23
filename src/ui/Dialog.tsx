import { useEffect, useRef, type ReactNode } from 'react';
import { useLocale } from '../i18n/context';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Fenster über dem Konfigurator für kurze Abläufe; schließt mit Escape oder einem Klick daneben. */
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
    <div className="dialog" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-inner" role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="lede">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" className="button" onClick={onClose}>
            {t('Schließen')}
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
