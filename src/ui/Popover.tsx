import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface Props {
  id: string;
  /** Inhalt der Schaltfläche, die das Feld öffnet. */
  button: ReactNode;
  buttonClass: string;
  /** Beschriftung für Vorlesehilfen, wenn die Schaltfläche selbst nicht genügt. */
  label?: string;
  /** Öffnet nach oben statt nach unten. */
  up?: boolean;
  /** Richtet das Feld an der rechten statt an der linken Kante der Schaltfläche aus. */
  end?: boolean;
  role?: 'menu' | 'dialog';
  children: (close: () => void) => ReactNode;
}

const MARGIN = 8;

/** Kleines Feld an einer Schaltfläche: Menü, Hinweisliste oder Einstellungen. Schließt mit Escape und beim Klick daneben. */
export function Popover({ id, button, buttonClass, label, up, end, role = 'dialog', children }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lage aus der Schaltfläche ableiten und im Fenster halten.
  useLayoutEffect(() => {
    if (!open) return setStyle({ visibility: 'hidden' });
    const place = () => {
      const anchor = buttonRef.current!.getBoundingClientRect();
      const panel = panelRef.current!.getBoundingClientRect();
      const wanted = end ? anchor.right - panel.width : anchor.left;
      const left = Math.max(MARGIN, Math.min(wanted, window.innerWidth - panel.width - MARGIN));
      const top = up ? Math.max(MARGIN, anchor.top - panel.height - MARGIN) : Math.min(anchor.bottom + MARGIN, window.innerHeight - panel.height - MARGIN);
      setStyle({ left, top });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, up, end]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="popover" ref={rootRef}>
      <button ref={buttonRef} type="button" id={id} className={buttonClass} aria-label={label} aria-haspopup={role} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {button}
      </button>
      {open && (
        <div ref={panelRef} className="popover-panel" role={role} aria-labelledby={id} style={style}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
