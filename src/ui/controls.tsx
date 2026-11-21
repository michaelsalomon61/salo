import type { CSSProperties, ReactNode } from 'react';

/** Aufklappbarer Abschnitt der Konfiguration. */
export function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="section" open={open}>
      <summary>
        <h2>{title}</h2>
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Field({ label, value, note, children }: { label: string; value?: string; note?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {value && <span className="field-value">{value}</span>}
      </div>
      {children}
      {note && <p className="note">{note}</p>}
    </div>
  );
}

interface SliderProps {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  note?: string;
  /** Füllung von der Mitte aus statt vom linken Rand. */
  centered?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function Slider({ id, label, value, display, min, max, step, note, centered, disabled, onChange }: SliderProps) {
  const position = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const from = centered ? Math.min(50, position) : 0;
  const to = centered ? Math.max(50, position) : position;
  return (
    <div className="field">
      <div className="field-head">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <output className="field-value" htmlFor={id}>
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className={centered ? 'centered' : undefined}
        style={{ '--from': `${from}%`, '--to': `${to}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {note && <p className="note">{note}</p>}
    </div>
  );
}

interface ChoiceProps<T extends string | number> {
  id: string;
  label: string;
  value: T;
  options: readonly { id: T; name: string; disabled?: boolean }[];
  note?: string;
  onChange: (value: T) => void;
}

/** Auswahl aus wenigen kurzen Optionen in einer Zeile. */
export function Segmented<T extends string | number>({ id, label, value, options, note, onChange }: ChoiceProps<T>) {
  return (
    <Field label={label} note={note}>
      <div className="segmented" role="radiogroup" aria-label={label} id={id}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            id={`${id}-${o.id}`}
            role="radio"
            aria-checked={o.id === value}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
          >
            {o.name}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** Auswahl aus mehreren oder längeren Optionen, umbrechend. */
export function Chips<T extends string | number>({ id, label, value, options, note, onChange }: ChoiceProps<T>) {
  return (
    <Field label={label} note={note}>
      <div className="chips" role="radiogroup" aria-label={label} id={id}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            id={`${id}-${o.id}`}
            role="radio"
            aria-checked={o.id === value}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
          >
            {o.name}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function Switch({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="switch-row" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  unit: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | null) => void;
}

/** Freie Zahleneingabe; ein leeres Feld bedeutet "keine Angabe". */
export function NumberField({ id, label, unit, value, min = 0, max, step = 1, onChange }: NumberFieldProps) {
  return (
    <div className="number-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="number-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          placeholder="–"
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            onChange(v === null || Number.isNaN(v) ? null : Math.max(min, max === undefined ? v : Math.min(max, v)));
          }}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
}

export function TextArea({ id, label, value, placeholder, onChange }: { id: string; label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
