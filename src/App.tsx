import { useMemo, useState, type ReactNode } from 'react';
import {
  COLORS,
  DECKS,
  DEFAULT_CONFIG,
  LIMITS,
  resolve,
  type DeckMaterial,
  type TrailerConfig,
} from './trailer/config';
import { Viewer } from './viewer/Viewer';

const nf = new Intl.NumberFormat('de-DE');
const mm = (v: number) => `${nf.format(v)} mm`;
const kg = (v: number) => `${nf.format(v)} kg`;

export function App() {
  // Gewünschte Werte; das Regelwerk leitet daraus die baubare Konfiguration ab.
  const [requested, setRequested] = useState<TrailerConfig>(DEFAULT_CONFIG);
  const [showDimensions, setShowDimensions] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);

  const { config, derived, adjustments } = useMemo(() => resolve(requested), [requested]);
  const set = <K extends keyof TrailerConfig>(key: K, value: TrailerConfig[K]) =>
    setRequested((current) => ({ ...current, [key]: value }));

  const color = COLORS.find((c) => c.id === config.colorId) ?? COLORS[0];

  return (
    <div className="app">
      <section className="stage" aria-label="3D-Ansicht">
        <Viewer config={config} derived={derived} showDimensions={showDimensions} resetSignal={resetSignal} />
        <div className="stage-tools">
          <button
            type="button"
            id="toggle-dimensions"
            className="pill"
            aria-pressed={showDimensions}
            onClick={() => setShowDimensions((v) => !v)}
          >
            Maße
          </button>
          <button type="button" id="reset-view" className="pill" onClick={() => setResetSignal((n) => n + 1)}>
            Ansicht zurücksetzen
          </button>
        </div>
        <p className="stage-hint">Ziehen dreht das Modell, Scrollen oder Spreizen zoomt.</p>
      </section>

      <aside className="panel" aria-label="Konfiguration">
        <header className="panel-head">
          <p className="eyebrow">Konfigurator</p>
          <h1>Schwerlastanhänger</h1>
          <p className="lede">
            {config.payloadT} t Traglast, {config.axles} Achsen, {mm(config.lengthMm)} × {mm(config.widthMm)}
          </p>
        </header>

        <Group title="Traglast">
          <Slider
            id="payload"
            label="Nutzlast"
            value={config.payloadT}
            display={`${config.payloadT} t`}
            {...LIMITS.payloadT}
            onChange={(v) => set('payloadT', v)}
          />
          <Field label="Achsen" note={adjustments.axles}>
            <Segmented
              id="axles"
              value={config.axles}
              options={[2, 3, 4].map((n) => ({ value: n, label: String(n), disabled: n < derived.minAxles }))}
              onChange={(v) => set('axles', v)}
            />
          </Field>
        </Group>

        <Group title="Abmessungen">
          <Slider
            id="length"
            label="Länge"
            value={config.lengthMm}
            display={mm(config.lengthMm)}
            {...LIMITS.lengthMm}
            min={derived.minLengthMm}
            note={adjustments.lengthMm}
            onChange={(v) => set('lengthMm', v)}
          />
          <Slider
            id="width"
            label="Breite"
            value={config.widthMm}
            display={mm(config.widthMm)}
            {...LIMITS.widthMm}
            min={derived.minWidthMm}
            note={adjustments.widthMm}
            onChange={(v) => set('widthMm', v)}
          />
          <Slider
            id="deck-height"
            label="Ladehöhe"
            value={config.deckHeightMm}
            display={mm(config.deckHeightMm)}
            {...LIMITS.deckHeightMm}
            min={derived.minDeckHeightMm}
            note={adjustments.deckHeightMm}
            onChange={(v) => set('deckHeightMm', v)}
          />
        </Group>

        <Group title="Ausführung">
          <Field label="Ladefläche">
            <Segmented<DeckMaterial>
              id="deck"
              value={config.deck}
              options={DECKS.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(v) => set('deck', v)}
            />
          </Field>
          <Field label="Farbe" value={`${color.ral} ${color.name}`}>
            <div className="swatches" role="radiogroup" aria-label="Farbe">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  id={`color-${c.id}`}
                  role="radio"
                  aria-checked={c.id === config.colorId}
                  aria-label={`${c.ral} ${c.name}`}
                  title={`${c.ral} ${c.name}`}
                  className="swatch"
                  style={{ background: c.hex }}
                  onClick={() => set('colorId', c.id)}
                />
              ))}
            </div>
          </Field>
          <label className="switch-row" htmlFor="drawbar-up">
            <span>Deichsel hochgeklappt</span>
            <input
              id="drawbar-up"
              type="checkbox"
              role="switch"
              checked={config.drawbarUp}
              onChange={(e) => set('drawbarUp', e.target.checked)}
            />
          </label>
        </Group>

        <Group title="Kennwerte">
          <dl className="specs">
            <Spec term="Eigengewicht" value={`ca. ${kg(derived.tareKg)}`} />
            <Spec term="Gesamtgewicht" value={`ca. ${kg(derived.grossKg)}`} />
            <Spec
              term="Fahrwerk"
              value={`${config.axles} × ${derived.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse'}`}
            />
            <Spec term="Bereifung" value={`${derived.wheelCount} × Vollgummi Ø ${derived.wheelDiameterMm} mm`} />
            <Spec term="Radlast" value={`ca. ${kg(derived.wheelLoadKg)}`} />
            <Spec term="Rahmenhöhe" value={mm(derived.frameHeightMm)} />
          </dl>
          <p className="footnote">
            Anschauungsmodell. Die Kennwerte sind Schätzungen nach Faustregeln und ersetzen keine technische
            Auslegung.
          </p>
        </Group>
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, note, children }: { label: string; value?: string; note?: string; children: ReactNode }) {
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
  onChange: (value: number) => void;
}

function Slider({ id, label, value, display, min, max, step, note, onChange }: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
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
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {note && <p className="note">{note}</p>}
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  id: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}

function Segmented<T extends string | number>({ id, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" id={id}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          id={`${id}-${o.value}`}
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Spec({ term, value }: { term: string; value: string }) {
  return (
    <div className="spec">
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
