import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteSaved, importSaved, listSaved, loadDraft, saveConfig, saveDraft, type SavedConfig } from './storage/saved';
import { advise, performance } from './trailer/advice';
import { buildBom } from './trailer/bom';
import { COLORS, DEFAULT_CONFIG, LIMITS, OPTIONS, STEERING, hasBoardDeck, optionName, resolve, type TrailerConfig } from './trailer/config';
import { trailerParts } from './trailer/parts';
import { estimateQuote } from './trailer/pricing';
import { describeConfig, describeProse } from './trailer/summary';
import { BomDialog } from './ui/BomDialog';
import { Chips, Field, NumberField, Section, Segmented, Slider, Switch, TextArea } from './ui/controls';
import { saveBlob } from './ui/download';
import { QuoteDialog } from './ui/QuoteDialog';
import { SavedDialog } from './ui/SavedDialog';
import { SummaryDialog } from './ui/SummaryDialog';
import { Viewer } from './viewer/Viewer';

const nf = new Intl.NumberFormat('de-DE');
const mm = (v: number) => `${nf.format(v)} mm`;
const kg = (v: number) => `${nf.format(v)} kg`;
const steeringText = (deg: number) => (deg === 0 ? 'Geradeaus' : `${Math.abs(deg)}° ${deg < 0 ? 'links' : 'rechts'}`);

export function App() {
  // Gewünschte Werte; das Regelwerk leitet daraus die baubare Konfiguration ab.
  // Der Arbeitsstand der letzten Sitzung wird beim Öffnen wiederhergestellt.
  const [draft] = useState(loadDraft);
  const [requested, setRequested] = useState<TrailerConfig>(draft?.config ?? DEFAULT_CONFIG);
  const [saved, setSaved] = useState<SavedConfig[]>(listSaved);
  const [currentId, setCurrentId] = useState<string | null>(draft?.currentId ?? null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const current = saved.find((e) => e.id === currentId) ?? null;
  const unsaved = current ? JSON.stringify(current.config) !== JSON.stringify(requested) : true;

  useEffect(() => {
    saveDraft({ config: requested, currentId });
  }, [requested, currentId]);
  const [showDimensions, setShowDimensions] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [dialog, setDialog] = useState<'summary' | 'bom' | 'saved' | 'quote' | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const [step, setStep] = useState<'idle' | 'working' | 'failed'>('idle');

  const { config, derived, adjustments } = useMemo(() => resolve(requested), [requested]);
  const set = <K extends keyof TrailerConfig>(key: K, value: TrailerConfig[K]) => {
    setSaveStatus(null);
    setRequested((previous) => ({ ...previous, [key]: value }));
  };

  /** Speichert die Eingaben unter einem Namen; liefert eine Fehlermeldung, wenn der Browser es verweigert. */
  const save = (name: string): string | null => {
    try {
      const result = saveConfig(name, requested);
      setSaved(result.list);
      setCurrentId(result.entry.id);
      setSaveStatus('Gespeichert');
      return null;
    } catch {
      return 'Speichern nicht möglich: Der Browser lässt keinen lokalen Speicher zu.';
    }
  };
  const quickSave = () => {
    if (!current) return setDialog('saved');
    const error = save(current.name);
    if (error) setSaveStatus(error);
  };

  // Die Stückliste liefert auch das Eigengewicht für Kennwerte und Hinweise.
  const description = useMemo(() => trailerParts(config, derived), [config, derived]);
  const bom = useMemo(() => buildBom(description.parts), [description]);
  const perf = performance(config, derived, bom.totalKg);
  const quote = useMemo(() => estimateQuote(config, description.parts), [config, description]);
  const notices = useMemo(() => advise(config, derived, bom.totalKg), [config, derived, bom]);

  const color = COLORS.find((c) => c.id === config.colorId) ?? COLORS[0];
  const headline = `${config.payloadT} t Traglast, ${config.axles} Achsen, ${mm(config.lengthMm)} × ${mm(config.widthMm)}`;
  const summary = `${headline}, Ladehöhe ${mm(config.deckHeightMm)}, ${optionName('deck', config.deck)}, ${color.ral} ${color.name}`;
  const fileBase = `anhaenger-${config.payloadT}t-${config.lengthMm}x${config.widthMm}`;

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
          <p className="lede">{headline}</p>
          <div className="actions">
            <button type="button" id="open-quote" className="button primary" onClick={() => setDialog('quote')}>
              Angebot
            </button>
            <button type="button" id="open-summary" className="button" onClick={() => setDialog('summary')}>
              Zusammenfassung
            </button>
            <button type="button" id="open-bom" className="button" onClick={() => setDialog('bom')}>
              Stückliste
            </button>
            <button type="button" id="save-step" className="button" disabled={step === 'working'} onClick={saveStep}>
              {step === 'working' ? 'Wird erzeugt …' : 'STEP-Modell'}
            </button>
          </div>
          {step === 'failed' && (
            <p className="note" role="alert">
              Das STEP-Modell konnte nicht erzeugt werden. Bitte Verbindung prüfen und erneut versuchen.
            </p>
          )}
          <div className="save-bar">
            <div className="save-state">
              <p className="save-name">{current ? current.name : 'Nicht gespeichert'}</p>
              <p className="save-hint" aria-live="polite">
                {saveStatus ?? (current ? (unsaved ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert') : 'Noch ohne Namen')}
              </p>
            </div>
            <button type="button" id="quick-save" className="button" disabled={!!current && !unsaved} onClick={quickSave}>
              Speichern
            </button>
            <button type="button" id="open-saved" className="button" onClick={() => setDialog('saved')}>
              Konfigurationen{saved.length > 0 ? ` (${saved.length})` : ''}
            </button>
          </div>
        </header>

        <div className="sections">
          <Section title="Grunddaten" open>
            <Slider id="payload" label="Nutzlast" value={config.payloadT} display={`${config.payloadT} t`} {...LIMITS.payloadT} onChange={(v) => set('payloadT', v)} />
            <Segmented
              id="axles"
              label="Achsen"
              value={config.axles}
              note={adjustments.axles}
              options={[2, 3, 4].map((n) => ({ id: n, name: String(n), disabled: n < derived.minAxles }))}
              onChange={(v) => set('axles', v)}
            />
            {config.body === 'longload' ? (
              <Slider id="length" label="Eingestellte Länge" value={config.lengthMm} display={mm(config.lengthMm)} min={config.minLengthMm} max={config.maxLengthMm} step={config.rasterMm} onChange={(v) => set('lengthMm', v)} />
            ) : (
              <Slider id="length" label="Länge" value={config.lengthMm} display={mm(config.lengthMm)} {...LIMITS.lengthMm} min={derived.minLengthMm} note={adjustments.lengthMm} onChange={(v) => set('lengthMm', v)} />
            )}
            <Slider id="width" label="Breite" value={config.widthMm} display={mm(config.widthMm)} {...LIMITS.widthMm} min={derived.minWidthMm} note={adjustments.widthMm} onChange={(v) => set('widthMm', v)} />
            <Slider id="deck-height" label={config.body === 'lowbed' ? 'Höhe über den Achsen' : 'Ladehöhe'} value={config.deckHeightMm} display={mm(config.deckHeightMm)} {...LIMITS.deckHeightMm} min={derived.minDeckHeightMm} note={adjustments.deckHeightMm} onChange={(v) => set('deckHeightMm', v)} />
          </Section>

          <Section title="Bauform">
            <Segmented id="body" label="Bauform" value={config.body} options={OPTIONS.body} onChange={(v) => set('body', v)} />
            {config.body === 'lowbed' && (
              <>
                <Slider id="bed-height" label="Ladehöhe Tiefbett" value={config.bedHeightMm} display={mm(config.bedHeightMm)} {...LIMITS.bedHeightMm} max={Math.min(LIMITS.bedHeightMm.max, config.deckHeightMm - 200)} note={adjustments.bedHeightMm} onChange={(v) => set('bedHeightMm', v)} />
                <Segmented id="rear-wheels" label="Hinterräder" value={config.rearWheels} options={OPTIONS.rearWheels} note={adjustments.rearWheels} onChange={(v) => set('rearWheels', v)} />
                <Segmented
                  id="ramp"
                  label="Auffahrklappe"
                  value={config.ramp}
                  note={adjustments.ramp}
                  options={OPTIONS.ramp.map((o) => ({ ...o, disabled: o.id === 'rear' && config.rearWheels === 'inside' }))}
                  onChange={(v) => set('ramp', v)}
                />
              </>
            )}
            {config.body === 'longload' && (
              <>
                <Slider id="min-length" label="Mindestlänge" value={config.minLengthMm} display={mm(config.minLengthMm)} min={LIMITS.lengthMm.min} max={LIMITS.lengthMm.max} step={100} note={adjustments.minLengthMm} onChange={(v) => set('minLengthMm', v)} />
                <Slider id="max-length" label="Maximallänge" value={config.maxLengthMm} display={mm(config.maxLengthMm)} min={LIMITS.lengthMm.min} max={LIMITS.lengthMm.max} step={100} note={adjustments.maxLengthMm} onChange={(v) => set('maxLengthMm', v)} />
                <Segmented id="raster" label="Längenrasterung" value={config.rasterMm} options={OPTIONS.rasterMm} onChange={(v) => set('rasterMm', v)} />
              </>
            )}
            {config.body === 'platform' && (
              <>
                <Segmented id="roof" label="Dachaufbau" value={config.roof} options={OPTIONS.roof} onChange={(v) => set('roof', v)} />
                {config.roof !== 'none' && (
                  <>
                    <Segmented id="roof-shape" label="Dachform" value={config.roofShape} options={OPTIONS.roofShape} onChange={(v) => set('roofShape', v)} />
                    <Slider id="roof-clear" label="Lichte Höhe" value={config.roofClearMm} display={mm(config.roofClearMm)} {...LIMITS.roofClearMm} onChange={(v) => set('roofClearMm', v)} />
                    <Chips id="roof-sides" label="Seiten" value={config.roofSides} options={OPTIONS.roofSides} onChange={(v) => set('roofSides', v)} />
                  </>
                )}
              </>
            )}
          </Section>

          <Section title="Einsatz">
            <Slider id="speed" label="Geschwindigkeit" value={config.speedKmh} display={`${config.speedKmh} km/h`} {...LIMITS.speedKmh} onChange={(v) => set('speedKmh', v)} />
            <Segmented id="site" label="Einsatzort" value={config.site} options={OPTIONS.site} onChange={(v) => set('site', v)} />
            <Switch id="public-roads" label="Öffentliche Verkehrswege (StVZO)" checked={config.publicRoads} onChange={(v) => set('publicRoads', v)} />
            <Chips id="ground" label="Untergrund" value={config.ground} options={OPTIONS.ground} onChange={(v) => set('ground', v)} />
            <Slider id="slope" label="Größte Steigung" value={config.slopePct} display={`${config.slopePct} %`} {...LIMITS.slopePct} onChange={(v) => set('slopePct', v)} />
            <Slider id="obstacle" label="Höhe des größten Hindernisses" value={config.obstacleMm} display={mm(config.obstacleMm)} {...LIMITS.obstacleMm} onChange={(v) => set('obstacleMm', v)} />
            <div className="number-grid">
              <NumberField id="aisle" label="Gangbreite" unit="mm" step={50} value={config.aisleWidthMm} onChange={(v) => set('aisleWidthMm', v)} />
              <NumberField id="curve" label="Kurvenradius" unit="mm" step={50} value={config.curveRadiusMm} onChange={(v) => set('curveRadiusMm', v)} />
              <NumberField id="hours" label="Stunden mit Last pro Tag" unit="h" max={24} step={0.5} value={config.hoursLoadedPerDay} onChange={(v) => set('hoursLoadedPerDay', v)} />
              <NumberField id="distance" label="Wegstrecke pro Tag" unit="km" step={0.5} value={config.distanceKmPerDay} onChange={(v) => set('distanceKmPerDay', v)} />
            </div>
          </Section>

          <Section title="Last">
            <Segmented id="load-type" label="Lastart" value={config.loadType} options={OPTIONS.loadType} onChange={(v) => set('loadType', v)} />
            {config.loadType === 'custom' ? (
              <TextArea id="load-note" label="Beschreibung der Last" value={config.loadNote} placeholder="z. B. vier Auflagepunkte, Schwerpunkt außermittig" onChange={(v) => set('loadNote', v)} />
            ) : (
              <>
                <Slider id="load-length" label="Länge der Last" value={config.loadLengthMm} display={mm(config.loadLengthMm)} {...LIMITS.loadLengthMm} max={config.lengthMm} onChange={(v) => set('loadLengthMm', v)} />
                <Slider id="load-width" label="Breite der Last" value={config.loadWidthMm} display={mm(config.loadWidthMm)} {...LIMITS.loadWidthMm} max={config.widthMm} onChange={(v) => set('loadWidthMm', v)} />
                <Slider id="load-height" label="Höhe der Last" value={config.loadHeightMm} display={mm(config.loadHeightMm)} {...LIMITS.loadHeightMm} onChange={(v) => set('loadHeightMm', v)} />
                <Switch id="show-load" label="Last im Modell zeigen" checked={config.showLoad} onChange={(v) => set('showLoad', v)} />
              </>
            )}
          </Section>

          <Section title="Fahrwerk">
            <Chips id="steering-type" label="Lenkung" value={config.steering} options={OPTIONS.steering} onChange={(v) => set('steering', v)} />
            <Chips id="tyre" label="Bereifung" value={config.tyre} options={OPTIONS.tyre} onChange={(v) => set('tyre', v)} />
            <Switch id="non-marking" label="Spurfreie Bereifung" checked={config.nonMarking} onChange={(v) => set('nonMarking', v)} />
            <Chips id="suspension" label="Federung" value={config.suspension} options={OPTIONS.suspension} onChange={(v) => set('suspension', v)} />
            <Chips id="brake" label="Betriebsbremse" value={config.brake} options={OPTIONS.brake} onChange={(v) => set('brake', v)} />
            <Switch id="parking-brake" label="Feststellbremse" checked={config.parkingBrake} onChange={(v) => set('parkingBrake', v)} />
          </Section>

          <Section title="Ladefläche">
            <Chips id="deck" label="Belag" value={config.deck} options={OPTIONS.deck} onChange={(v) => set('deck', v)} />
            {hasBoardDeck(config.deck) && config.body === 'platform' && (
              <Segmented id="edge" label="Kantenschutz" value={config.edgeProtection} options={OPTIONS.edgeProtection} onChange={(v) => set('edgeProtection', v)} />
            )}
            {config.body === 'platform' && (
              <Segmented id="wall-type" label="Bordwände" value={config.wallType} options={OPTIONS.wallType} onChange={(v) => set('wallType', v)} />
            )}
            {config.wallType !== 'none' && (
              <>
                <Segmented id="wall-material" label="Material der Bordwände" value={config.wallMaterial} options={OPTIONS.wallMaterial} onChange={(v) => set('wallMaterial', v)} />
                <Segmented id="wall-height" label="Höhe der Bordwände" value={config.wallHeightMm} options={OPTIONS.wallHeightMm} onChange={(v) => set('wallHeightMm', v)} />
              </>
            )}
            {config.body !== 'longload' && (
              <Switch id="lashing" label="Verzurrösen zur Ladungssicherung" checked={config.lashingRings} onChange={(v) => set('lashingRings', v)} />
            )}
          </Section>

          <Section title="Deichsel und Kupplung">
            <Segmented id="tow-eye" label="Zugöse" value={config.towEye} options={OPTIONS.towEye} onChange={(v) => set('towEye', v)} />
            <Switch id="drawbar-spring" label="Gefederte Höheneinstellung" checked={config.drawbarSpring} onChange={(v) => set('drawbarSpring', v)} />
            <Slider
              id="steering"
              label="Lenkeinschlag"
              value={config.steeringDeg}
              display={steeringText(config.steeringDeg)}
              {...LIMITS.steeringDeg}
              min={-STEERING[config.steering].maxDeg}
              max={STEERING[config.steering].maxDeg}
              centered
              disabled={config.drawbarUp}
              note={adjustments.steeringDeg}
              onChange={(v) => set('steeringDeg', v)}
            />
            <Switch id="drawbar-up" label="Deichsel hochgeklappt" checked={config.drawbarUp} onChange={(v) => set('drawbarUp', v)} />
            <Chips id="rear-coupling" label="Kupplung hinten" value={config.rearCoupling} options={OPTIONS.rearCoupling} onChange={(v) => set('rearCoupling', v)} />
          </Section>

          <Section title="Ausstattung">
            <Segmented id="lighting" label="Beleuchtung" value={config.lighting} options={OPTIONS.lighting} onChange={(v) => set('lighting', v)} />
            <Chips id="chocks" label="Unterlegkeile" value={config.chocks} options={OPTIONS.chocks} onChange={(v) => set('chocks', v)} />
            <Field label="Lackierung" value={`${color.ral} ${color.name}`}>
              <div className="swatches" role="radiogroup" aria-label="Lackierung">
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
          </Section>

          <Section title="Zugfahrzeug">
            <div className="number-grid">
              <NumberField id="tow-weight" label="Gesamtgewicht" unit="kg" step={50} value={config.towWeightKg} onChange={(v) => set('towWeightKg', v)} />
              <NumberField id="coupling-height" label="Kupplungshöhe" unit="mm" step={10} max={1500} value={config.couplingHeightMm} onChange={(v) => set('couplingHeightMm', v)} />
              <NumberField id="tow-force" label="Zugkraft am Haken" unit="N" step={100} value={config.towForceN} onChange={(v) => set('towForceN', v)} />
            </div>
            <Slider id="train" label="Anhänger im Zug" value={config.trailersInTrain} display={String(config.trailersInTrain)} {...LIMITS.trailersInTrain} onChange={(v) => set('trailersInTrain', v)} />
          </Section>

          <Section title="Anmerkungen">
            <TextArea id="notes" label="Sonstige Anforderungen und Wünsche" value={config.notes} onChange={(v) => set('notes', v)} />
          </Section>
        </div>

        {notices.length > 0 && (
          <section className="group" aria-label="Hinweise">
            <h2>Hinweise</h2>
            <ul className="notices">
              {notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="group">
          <h2>Kennwerte</h2>
          <dl className="specs">
            <Spec term="Eigengewicht" value={`ca. ${kg(bom.totalKg)}`} />
            <Spec term="Gesamtgewicht" value={`ca. ${kg(perf.grossKg)}`} />
            <Spec term="Fahrwerk" value={`${config.axles} × ${derived.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse'}`} />
            <Spec term="Bereifung" value={`${derived.wheelCount} × ${optionName('tyre', config.tyre)} Ø ${derived.wheelDiameterMm} mm`} />
            <Spec term="Radlast" value={`ca. ${kg(perf.wheelLoadKg)}`} />
            <Spec term="Zugkraftbedarf" value={`ca. ${nf.format(perf.pullN)} N`} />
            <Spec term="Rahmenhöhe" value={mm(derived.frameHeightMm)} />
            <Spec term="Gesamthöhe" value={mm(Math.round(description.height * 100) * 10)} />
            {description.bed && (
              <Spec term="Tiefbett (L × B)" value={`${mm(Math.round(description.bed.length * 100) * 10)} × ${mm(Math.round(description.bed.width * 100) * 10)}`} />
            )}
            <Spec term="Einzelteile" value={nf.format(bom.pieceCount)} />
            <Spec term="Richtpreis netto" value={`ca. ${nf.format(quote.netEur)} €`} />
          </dl>
          <p className="footnote">
            Anschauungsmodell. Kennwerte und Hinweise sind Schätzungen nach Faustregeln und ersetzen keine technische
            Auslegung.
          </p>
        </section>
      </aside>

      {dialog === 'bom' && <BomDialog bom={bom} summary={summary} fileBase={fileBase} onClose={closeDialog} />}
      {dialog === 'saved' && (
        <SavedDialog
          saved={saved}
          currentId={currentId}
          suggestedName={`${optionName('body', config.body)} ${config.payloadT} t, ${nf.format(config.lengthMm)} × ${nf.format(config.widthMm)}`}
          onSave={save}
          onLoad={(entry) => {
            setRequested(entry.config);
            setCurrentId(entry.id);
            setSaveStatus(null);
            setDialog(null);
          }}
          onDelete={(id) => {
            try {
              setSaved(deleteSaved(id));
              if (id === currentId) setCurrentId(null);
            } catch {
              setSaveStatus('Löschen nicht möglich: Der Browser lässt keinen lokalen Speicher zu.');
            }
          }}
          onImport={(text) => {
            try {
              const result = importSaved(text);
              setSaved(result.list);
              return result.imported === 1 ? '1 Konfiguration eingelesen.' : `${result.imported} Konfigurationen eingelesen.`;
            } catch {
              return 'Die Datei enthält keine Konfigurationen aus diesem Konfigurator.';
            }
          }}
          onNew={() => {
            setRequested(DEFAULT_CONFIG);
            setCurrentId(null);
            setSaveStatus(null);
            setDialog(null);
          }}
          onClose={closeDialog}
        />
      )}
      {dialog === 'quote' && (
        <QuoteDialog
          name={current && !unsaved ? current.name : null}
          title={`Schwerlastanhänger ${optionName('body', config.body)}, ${config.payloadT} t`}
          prose={describeProse(config, derived)}
          sections={describeConfig(config, derived, description, bom.totalKg, bom.pieceCount)}
          quote={quote}
          fileBase={fileBase}
          onClose={closeDialog}
        />
      )}
      {dialog === 'summary' && (
        <SummaryDialog
          sections={describeConfig(config, derived, description, bom.totalKg, bom.pieceCount)}
          notices={notices}
          fileBase={fileBase}
          onClose={closeDialog}
        />
      )}
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
