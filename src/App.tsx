import { Suspense, lazy, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildBom } from './trailer/bom';
import {
  COLORS,
  DECKS,
  DEFAULT_CONFIG,
  LIMITS,
  resolve,
  type DeckMaterial,
  type TrailerConfig,
} from './trailer/config';
import { trailerParts } from './trailer/parts';
import { BomDialog } from './ui/BomDialog';
import { saveBlob } from './ui/download';
import type { CameraPose } from './viewer/scene';
import { Viewer } from './viewer/Viewer';

// Rendering und CAD-Kern sind groß und werden erst bei Bedarf geladen.
const RenderDialog = lazy(() => import('./ui/RenderDialog'));

const nf = new Intl.NumberFormat('de-DE');
const mm = (v: number) => `${nf.format(v)} mm`;
const kg = (v: number) => `${nf.format(v)} kg`;
const steeringText = (deg: number) => (deg === 0 ? 'Geradeaus' : `${Math.abs(deg)}° ${deg < 0 ? 'links' : 'rechts'}`);

export function App() {
  // Gewünschte Werte; das Regelwerk leitet daraus die baubare Konfiguration ab.
  const [requested, setRequested] = useState<TrailerConfig>(DEFAULT_CONFIG);
  const [showDimensions, setShowDimensions] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);

  const { config, derived, adjustments } = useMemo(() => resolve(requested), [requested]);
  const set = <K extends keyof TrailerConfig>(key: K, value: TrailerConfig[K]) =>
    setRequested((current) => ({ ...current, [key]: value }));

  const color = COLORS.find((c) => c.id === config.colorId) ?? COLORS[0];
  const deck = DECKS.find((d) => d.id === config.deck) ?? DECKS[0];

  // Die Stückliste liefert auch das Eigengewicht für die Kennwerte.
  const bom = useMemo(() => buildBom(trailerParts(config, derived).parts), [config, derived]);
  const grossKg = config.payloadT * 1000 + bom.totalKg;

  const [dialog, setDialog] = useState<'render' | 'bom' | null>(null);
  const [pose, setPose] = useState<CameraPose | null>(null);
  const poseRef = useRef<(() => CameraPose) | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const [step, setStep] = useState<'idle' | 'working' | 'failed'>('idle');

  const summary = `${config.payloadT} t Traglast, ${config.axles} Achsen, ${mm(config.lengthMm)} × ${mm(config.widthMm)}, Ladehöhe ${mm(config.deckHeightMm)}, ${deck.name}, ${color.ral} ${color.name}`;
  const fileBase = `anhaenger-${config.payloadT}t-${config.lengthMm}x${config.widthMm}`;

  const openRender = () => {
    setPose(poseRef.current?.() ?? null);
    setDialog('render');
  };
  const saveStep = async () => {
    setStep('working');
    try {
      const { exportStep } = await import('./cad/exportStep');
      saveBlob(await exportStep(config, derived), `${fileBase}.step`);
      setStep('idle');
    } catch {
      setStep('failed');
    }
  };

  return (
    <div className="app">
      <section className="stage" aria-label="3D-Ansicht">
        <Viewer
          config={config}
          derived={derived}
          showDimensions={showDimensions}
          resetSignal={resetSignal}
          poseRef={poseRef}
        />
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
          <div className="actions">
            <button type="button" id="open-render" className="button primary" onClick={openRender}>
              Rendering
            </button>
            <button type="button" id="open-bom" className="button" onClick={() => setDialog('bom')}>
              Stückliste
            </button>
            <button type="button" id="save-step" className="button" disabled={step === 'working'} onClick={saveStep}>
              {step === 'working' ? 'STEP wird erzeugt …' : 'STEP-Modell'}
            </button>
          </div>
          {step === 'failed' && (
            <p className="note" role="alert">
              Das STEP-Modell konnte nicht erzeugt werden. Bitte Verbindung prüfen und erneut versuchen.
            </p>
          )}
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
          <Slider
            id="steering"
            label="Lenkeinschlag"
            value={config.steeringDeg}
            display={steeringText(config.steeringDeg)}
            {...LIMITS.steeringDeg}
            centered
            disabled={config.drawbarUp}
            note={adjustments.steeringDeg}
            onChange={(v) => set('steeringDeg', v)}
          />
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
            <Spec term="Eigengewicht" value={`ca. ${kg(bom.totalKg)}`} />
            <Spec term="Gesamtgewicht" value={`ca. ${kg(grossKg)}`} />
            <Spec
              term="Fahrwerk"
              value={`${config.axles} × ${derived.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse'}`}
            />
            <Spec term="Bereifung" value={`${derived.wheelCount} × Vollgummi Ø ${derived.wheelDiameterMm} mm`} />
            <Spec term="Radlast" value={`ca. ${kg(Math.round(grossKg / derived.wheelCount / 10) * 10)}`} />
            <Spec term="Rahmenhöhe" value={mm(derived.frameHeightMm)} />
            <Spec term="Einzelteile" value={nf.format(bom.pieceCount)} />
          </dl>
          <p className="footnote">
            Anschauungsmodell. Die Kennwerte sind Schätzungen nach Faustregeln und ersetzen keine technische
            Auslegung.
          </p>
        </Group>
      </aside>

      {dialog === 'bom' && <BomDialog bom={bom} summary={summary} fileBase={fileBase} onClose={closeDialog} />}
      {dialog === 'render' && (
        <Suspense fallback={null}>
          <RenderDialog
            config={config}
            derived={derived}
            summary={summary}
            fileBase={fileBase}
            pose={pose}
            onClose={closeDialog}
          />
        </Suspense>
      )}
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
  /** Füllung von der Mitte aus statt vom linken Rand. */
  centered?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function Slider({ id, label, value, display, min, max, step, note, centered, disabled, onChange }: SliderProps) {
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
        style={{ '--from': `${from}%`, '--to': `${to}%` } as React.CSSProperties}
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
